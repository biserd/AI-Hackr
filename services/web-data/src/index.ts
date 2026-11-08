import { mkdir, writeFile } from "node:fs/promises";
import { Database } from "./db.js";
import { Store } from "./store.js";
import { Providers } from "./providers.js";
import { Service } from "./service.js";
import { createApp } from "./http.js";
import { Billing } from "./billing.js";
import { Extraction } from "./extraction.js";
import { OAuth } from "./oauth.js";
import { cloudflareStore } from "./cloudflare-store.js";
const fixture = process.env.DEV_FIXTURES === "true";
const cloudflare = process.env.WEB_DATA_STORAGE === "cloudflare";
if (fixture && process.env.NODE_ENV === "production")
  throw new Error("Fixture credentials are forbidden in production.");
if (
  !cloudflare &&
  !process.env.DATABASE_URL &&
  process.env.NODE_ENV === "production"
)
  throw new Error("Production requires PostgreSQL DATABASE_URL.");
if (!cloudflare && !fixture && !process.env.DATABASE_URL)
  throw new Error(
    "Set DEV_FIXTURES=true for local mode, or supply DATABASE_URL.",
  );
if (fixture) await mkdir(".local", { recursive: true });
const db = cloudflare
  ? cloudflareStore().db
  : await Database.open(
      process.env.DATABASE_URL,
      fixture ? ".local/postgres" : undefined,
    );
await db.migrate();
const store = cloudflare ? cloudflareStore() : new Store(db);
const providers = new Providers({
  fixture,
  httpEnabled: process.env.LIVE_HTTP_ENABLED === "true",
  httpCost: Number(process.env.HTTP_COST_MICRO_USD ?? 100),
  searchKey: process.env.BRAVE_SEARCH_API_KEY,
  searchCost: Number(process.env.SEARCH_COST_MICRO_USD ?? 0),
  engineUrl: process.env.FIRECRAWL_BROWSER_URL,
  engineVerified: process.env.BROWSER_SECURITY_REHEARSED === "true",
});
if (
  !fixture &&
  process.env.OPENAI_API_KEY &&
  process.env.EXTRACTION_MODEL &&
  Number(process.env.MODEL_INPUT_MICRO_USD_PER_MILLION) > 0 &&
  Number(process.env.MODEL_OUTPUT_MICRO_USD_PER_MILLION) > 0
)
  providers.extraction = new Extraction({
    key: process.env.OPENAI_API_KEY,
    model: process.env.EXTRACTION_MODEL,
    inputMicroUsdPerMillion: Number(
      process.env.MODEL_INPUT_MICRO_USD_PER_MILLION,
    ),
    outputMicroUsdPerMillion: Number(
      process.env.MODEL_OUTPUT_MICRO_USD_PER_MILLION,
    ),
  });
const service = new Service(
  store,
  providers,
  Number(process.env.MAX_PROVIDER_COST_MICRO_USD ?? 50000),
);
const origin = process.env.PUBLIC_API_ORIGIN ?? "http://127.0.0.1:4100",
  dashboardOrigin = process.env.DASHBOARD_ORIGIN ?? "http://localhost:5000";
const billing = new Billing(
  store,
  process.env.STRIPE_TEST_KEY,
  process.env.STRIPE_WEBHOOK_SECRET,
  dashboardOrigin,
);
const oauth =
  process.env.OAUTH_ISSUER &&
  process.env.OAUTH_LINK_CLIENT_ID &&
  process.env.OAUTH_AGENT_CLIENT_ID
    ? new OAuth(store, {
        issuer: process.env.OAUTH_ISSUER,
        linkClientId: process.env.OAUTH_LINK_CLIENT_ID,
        linkClientSecret: process.env.OAUTH_LINK_CLIENT_SECRET,
        agentClientId: process.env.OAUTH_AGENT_CLIENT_ID,
        callback: `${origin}/oauth/callback`,
        dashboardOrigin,
      })
    : undefined;
const app = createApp(
  service,
  {
    origin,
    dashboardOrigin,
    controlToken: process.env.WEB_DATA_CONTROL_TOKEN,
    oauthIssuer: process.env.OAUTH_ISSUER,
    oauthJwks: process.env.OAUTH_JWKS_URL,
  },
  billing,
  oauth,
);
if (fixture) {
  const p = await store.provision("local-fixture");
  const key = await store.issueKey(p, "Local fixture development");
  await mkdir(".local", { recursive: true });
  await writeFile(".local/dev-key", key.key, { mode: 0o600 });
  console.info(
    "Fixture credentials written to .local/dev-key. Fixture data only.",
  );
}
let stopped = false,
  busy = false,
  lastReconcile = 0;
const timer = setInterval(
  async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      if (Date.now() - lastReconcile > 60000) {
        await store.reconcile();
        lastReconcile = Date.now();
      }
      await service.processOne();
    } catch {
      console.error("Worker iteration failed; see job trace.");
    } finally {
      busy = false;
    }
  },
  cloudflare ? 1000 : 250,
);
const server = app.listen(
  Number(process.env.PORT ?? 4100),
  process.env.BIND_HOST ?? "127.0.0.1",
  () => console.info(`AIHackr web data listening on ${origin}`),
);
async function shutdown() {
  stopped = true;
  service.draining = true;
  clearInterval(timer);
  server.close();
  while (busy) await new Promise((r) => setTimeout(r, 100));
  await db.close();
}
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
