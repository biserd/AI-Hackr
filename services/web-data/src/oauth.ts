import * as oidc from "openid-client";
import { AppError, id, type Principal } from "./contracts.js";
import { allScopes, keyHash, type Store } from "./store.js";
import { target } from "./security.js";
export type OAuthConfig = {
  issuer: string;
  linkClientId: string;
  linkClientSecret?: string;
  agentClientId: string;
  callback: string;
  dashboardOrigin: string;
};
export class OAuth {
  private configuration?: Promise<oidc.Configuration>;
  constructor(
    public store: Store,
    public config: OAuthConfig,
  ) {
    for (const url of [config.issuer, config.callback])
      if (target(url).protocol !== "https:")
        throw new Error(
          "OAuth requires public HTTPS issuer and callback URLs.",
        );
  }
  async client() {
    return (this.configuration ??= oidc.discovery(
      new URL(this.config.issuer),
      this.config.linkClientId,
      this.config.linkClientSecret,
    ));
  }
  async start(p: Principal) {
    if (!p.owner)
      throw new AppError(
        "SCOPE_REQUIRED",
        "Link an agent from the verified owner dashboard.",
        403,
      );
    const verifier = oidc.randomPKCECodeVerifier(),
      state = oidc.randomState(),
      nonce = oidc.randomNonce();
    const challenge = await oidc.calculatePKCECodeChallenge(verifier);
    await this.store.db.tx((q) =>
      q.query(
        "INSERT INTO wd_oauth_states(hash,tenant,verifier,nonce) VALUES($1,$2,$3,$4)",
        [keyHash(state), p.tenant, verifier, nonce],
      ),
    );
    const url = oidc.buildAuthorizationUrl(await this.client(), {
      redirect_uri: this.config.callback,
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "login",
    });
    return {
      authorizationUrl: url.href,
      consent:
        "Link this identity to the selected AIHackr workspace. Agent requests use prepaid credits, capped at 50 per operation and 200 per UTC day by default.",
    };
  }
  async callback(url: URL) {
    const state = url.searchParams.get("state");
    if (!state)
      throw new AppError("AUTH_REQUIRED", "OAuth state missing.", 401);
    const row = await this.store.db.tx(
      async (q) =>
        (
          await q.query(
            "DELETE FROM wd_oauth_states WHERE hash=$1 AND expires_at>now() RETURNING *",
            [keyHash(state)],
          )
        ).rows[0],
    );
    if (!row)
      throw new AppError(
        "AUTH_REQUIRED",
        "OAuth state expired or already used.",
        401,
      );
    let tokens: Awaited<ReturnType<typeof oidc.authorizationCodeGrant>>;
    try {
      tokens = await oidc.authorizationCodeGrant(await this.client(), url, {
        pkceCodeVerifier: row.verifier,
        expectedState: state,
        expectedNonce: row.nonce,
        idTokenExpected: true,
      });
    } catch {
      throw new AppError(
        "AUTH_REQUIRED",
        "OAuth authorization could not be verified.",
        401,
      );
    }
    const claims = tokens.claims();
    if (!claims?.sub || claims.email_verified !== true)
      throw new AppError(
        "AUTH_REQUIRED",
        "A verified provider identity is required.",
        401,
      );
    await this.store.db.tx(async (q) => {
      const prior = (
        await q.query(
          "SELECT * FROM wd_oauth_bindings WHERE issuer=$1 AND subject=$2 AND client=$3",
          [this.config.issuer, claims.sub, this.config.agentClientId],
        )
      ).rows[0];
      if (prior && prior.tenant !== row.tenant)
        throw new AppError(
          "IDEMPOTENCY_CONFLICT",
          "Unlink the prior workspace before linking this identity to another.",
          409,
        );
      if (!prior) {
        const connection = id("oauth");
        await q.query(
          "INSERT INTO wd_connections(tenant,id,scopes) VALUES($1,$2,$3)",
          [row.tenant, connection, JSON.stringify(allScopes)],
        );
        await q.query("INSERT INTO wd_oauth_bindings VALUES($1,$2,$3,$4,$5)", [
          this.config.issuer,
          claims.sub,
          this.config.agentClientId,
          row.tenant,
          connection,
        ]);
      }
    });
    return `${this.config.dashboardOrigin}/web-data?oauth=linked`;
  }
  async principal(
    subject: string,
    client: string,
    scopes: string[],
  ): Promise<Principal> {
    if (client !== this.config.agentClientId)
      throw new AppError(
        "AUTH_REQUIRED",
        "OAuth client is not registered.",
        401,
      );
    return this.store.db.tx(async (q) => {
      const b = (
        await q.query(
          "SELECT b.tenant,b.connection,c.scopes FROM wd_oauth_bindings b JOIN wd_connections c ON c.tenant=b.tenant AND c.id=b.connection WHERE b.issuer=$1 AND b.subject=$2 AND b.client=$3 AND c.revoked=false",
          [this.config.issuer, subject, client],
        )
      ).rows[0];
      if (!b)
        throw new AppError(
          "AUTH_REQUIRED",
          "Link this identity to a workspace in the owner dashboard.",
          401,
        );
      return {
        tenant: b.tenant,
        connection: b.connection,
        scopes: scopes.filter((s) => b.scopes.includes(s)),
      };
    });
  }
}
