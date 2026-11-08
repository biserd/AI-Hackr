import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
const env = {
  ...process.env,
  NODE_ENV: "production",
  WEB_DATA_STORAGE: "cloudflare",
  DEV_FIXTURES: "false",
  WEB_DATA_API_URL: "http://127.0.0.1:4100",
  WEB_DATA_CONTROL_TOKEN: randomBytes(32).toString("base64url"),
  WEB_DATA_DASHBOARD_ORIGIN: "https://aihackr.com",
  PUBLIC_API_ORIGIN: "https://aihackr.com",
  DASHBOARD_ORIGIN: "https://aihackr.com",
  LIVE_HTTP_ENABLED: "true",
};
const web = spawn(process.execPath, ["dist/src/index.js"], {
  cwd: "/app/services/web-data",
  env: { ...env, PORT: "4100", BIND_HOST: "127.0.0.1" },
  stdio: "inherit",
});
const scanner = spawn(process.execPath, ["dist/index.cjs"], {
  cwd: "/app",
  env: { ...env, PORT: process.env.PORT ?? "8080" },
  stdio: "inherit",
});
let exiting = false;
const shutdown = () => {
  if (exiting) return;
  exiting = true;
  web.kill("SIGTERM");
  scanner.kill("SIGTERM");
  setTimeout(() => process.exit(), 10000).unref();
};
for (const child of [web, scanner])
  child.once("exit", (code) => {
    if (!exiting) {
      console.error("Application process exited", code);
      shutdown();
      process.exitCode = code ?? 1;
    }
  });
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
