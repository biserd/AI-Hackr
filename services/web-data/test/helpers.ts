import { Database } from "../src/db.js";
import { Store } from "../src/store.js";
import { Providers } from "../src/providers.js";
import { Service } from "../src/service.js";
import { createApp } from "../src/http.js";
import { once } from "node:events";
export async function harness() {
  const db = await Database.open();
  await db.migrate();
  const store = new Store(db);
  const providers = new Providers({
    fixture: true,
    httpEnabled: false,
    searchCost: 0,
    httpCost: 0,
    engineVerified: false,
  });
  const service = new Service(store, providers);
  const a = await store.provision("tenant-a"),
    b = await store.provision("tenant-b");
  const keyA = await store.issueKey(a, "A"),
    keyB = await store.issueKey(b, "B");
  const server = createApp(service, {
    origin: "http://127.0.0.1",
    dashboardOrigin: "http://localhost:5000",
    controlToken: "local-control-test-value",
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = async (
    path: string,
    body?: any,
    key = keyA.key,
    method = body ? "POST" : "GET",
    headers: Record<string, string> = {},
  ) => {
    const r = await fetch(origin + path, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      body: (await r.json()) as any,
      headers: r.headers,
    };
  };
  const close = async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await db.close();
  };
  return {
    db,
    store,
    providers,
    service,
    a,
    b,
    keyA,
    keyB,
    server,
    origin,
    request,
    close,
  };
}
