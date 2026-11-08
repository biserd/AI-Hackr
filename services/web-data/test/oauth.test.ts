import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { OAuth } from "../src/oauth.js";
import { createApp } from "../src/http.js";
import { allScopes } from "../src/store.js";
import { harness } from "./helpers.js";
import { once } from "node:events";
import express from "express";
test("OAuth resource verification rejects wrong issuer, audience, scopes, expiry and revoked bindings", async (t) => {
  const h = await harness();
  t.after(h.close);
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: "fixture",
    alg: "RS256",
    use: "sig",
  };
  const jwksApp = express();
  jwksApp.get("/jwks", (_req, res) => res.json({ keys: [jwk] }));
  const jwks = jwksApp.listen(0, "127.0.0.1");
  await once(jwks, "listening");
  t.after(() => new Promise<void>((r) => jwks.close(() => r())));
  const jwksUrl = `http://127.0.0.1:${(jwks.address() as any).port}/jwks`;
  const issuer = "https://auth.aihackr.test/realms/test",
    oauth = new OAuth(h.store, {
      issuer,
      linkClientId: "dashboard",
      agentClientId: "plugin",
      callback: "https://api.aihackr.test/oauth/callback",
      dashboardOrigin: "https://aihackr.test",
    });
  await h.db.tx(async (q) => {
    await q.query(
      "INSERT INTO wd_connections(tenant,id,scopes) VALUES($1,$2,$3)",
      [h.a.tenant, "oauth-test", JSON.stringify(allScopes)],
    );
    await q.query("INSERT INTO wd_oauth_bindings VALUES($1,$2,$3,$4,$5)", [
      issuer,
      "fixture-sub",
      "plugin",
      h.a.tenant,
      "oauth-test",
    ]);
  });
  const api = createApp(
    h.service,
    {
      origin: "https://api.aihackr.test",
      dashboardOrigin: "https://aihackr.test",
      oauthIssuer: issuer,
      oauthJwks: jwksUrl,
    },
    undefined,
    oauth,
  ).listen(0, "127.0.0.1");
  await once(api, "listening");
  t.after(() => new Promise<void>((r) => api.close(() => r())));
  const url = `http://127.0.0.1:${(api.address() as any).port}`;
  const token = async (overrides: any = {}) =>
    new SignJWT({ azp: "plugin", scope: allScopes.join(" "), ...overrides })
      .setProtectedHeader({ alg: "RS256", kid: "fixture" })
      .setIssuer(overrides.iss ?? issuer)
      .setSubject(overrides.sub ?? "fixture-sub")
      .setAudience(overrides.aud ?? "https://api.aihackr.test/mcp")
      .setIssuedAt()
      .setExpirationTime(overrides.exp ?? "5m")
      .sign(privateKey);
  const get = async (t: string) =>
    fetch(url + "/v1/usage", { headers: { Authorization: `Bearer ${t}` } });
  assert.equal((await get(await token())).status, 200);
  for (const override of [
    { iss: "https://other.test" },
    { aud: "wrong" },
    { exp: 1 },
    { sub: "unlinked" },
    { azp: "unregistered" },
  ])
    assert.equal((await get(await token(override))).status, 401);
  assert.equal((await get(await token({ scope: "web:read" }))).status, 403);
  await h.db.tx((q) =>
    q.query(
      "UPDATE wd_connections SET revoked=true WHERE tenant=$1 AND id=$2",
      [h.a.tenant, "oauth-test"],
    ),
  );
  assert.equal((await get(await token())).status, 401);
  await assert.rejects(
    oauth.callback(
      new URL("https://api.aihackr.test/oauth/callback?code=bad&state=unknown"),
    ),
    (e: any) => e.code === "AUTH_REQUIRED",
  );
});
