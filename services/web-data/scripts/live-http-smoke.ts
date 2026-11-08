import { mkdir, writeFile } from "node:fs/promises";
import { Providers } from "../src/providers.js";
const provider = new Providers({
  fixture: false,
  httpEnabled: true,
  httpCost: 100,
  searchCost: 0,
  engineVerified: false,
});
const start = performance.now();
const page = await provider.retrieve("https://example.com", "http");
await mkdir("reports", { recursive: true });
await writeFile(
  "reports/live-http-smoke.json",
  JSON.stringify(
    {
      runAt: new Date().toISOString(),
      url: page.source.url,
      finalUrl: page.source.finalUrl,
      observedAt: page.source.observedAt,
      method: page.source.method,
      title: page.title,
      contentHash: page.source.contentHash,
      characters: page.text.length,
      milliseconds: performance.now() - start,
      limitations:
        "One cooperative public HTML page through pinned DNS HTTP adapter. Does not test arbitrary sites or Firecrawl/browser/extraction.",
    },
    null,
    2,
  ),
);
console.info(
  `Retrieved ${page.title}: ${page.text.length} characters via guarded HTTP.`,
);
