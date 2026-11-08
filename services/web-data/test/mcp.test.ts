import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { harness } from "./helpers.js";
test("official MCP client initializes, discovers tools and exercises isolated bounded workflows", async (t) => {
  const h = await harness();
  t.after(h.close);
  const client = new Client({ name: "aihackr-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(h.origin + "/mcp"),
    { requestInit: { headers: { Authorization: `Bearer ${h.keyA.key}` } } },
  );
  await client.connect(transport);
  t.after(() => client.close());
  const list = await client.listTools();
  assert.equal(list.tools.length, 11);
  for (const tool of list.tools) {
    assert.ok(tool.inputSchema);
    assert.ok(tool.outputSchema);
  }
  assert.equal(
    list.tools.find((t) => t.name === "aihackr_job")?.annotations?.readOnlyHint,
    false,
  );
  const caps = await client.callTool({
    name: "aihackr_capabilities",
    arguments: {},
  });
  assert.equal((caps.structuredContent as any).mode, "fixture");
  const started = await client.callTool({
    name: "aihackr_scrape",
    arguments: {
      url: "https://fixtures.aihackr.test/products/1",
      render: "http",
      maxCredits: 1,
      idempotencyKey: "mcp-once",
    },
  });
  assert.equal(started.isError, undefined);
  const jobId = (started.structuredContent as any).jobId;
  await h.service.processOne();
  const state = await client.callTool({
    name: "aihackr_job",
    arguments: { jobId },
  });
  assert.equal((state.structuredContent as any).usage.creditsCharged, 1);
  const content = await client.callTool({
    name: "aihackr_get_result",
    arguments: { resultId: (state.structuredContent as any).resultIds[0] },
  });
  assert.match(JSON.stringify(content.structuredContent), /Copper lamp/);
  const blocked = await client.callTool({
    name: "aihackr_scrape",
    arguments: { url: "http://127.0.0.1", maxCredits: 1, render: "http" },
  });
  assert.equal(blocked.isError, true);
  assert.equal(
    (blocked.structuredContent as any).error.code,
    "TARGET_RESTRICTED",
  );
  const foreign = await h.service.start(h.b, "scrape", {
    url: "https://fixtures.aihackr.test/products/2",
    render: "http",
    maxCredits: 1,
  });
  const denied = await client.callTool({
    name: "aihackr_job",
    arguments: { jobId: foreign.jobId },
  });
  assert.equal((denied.structuredContent as any).error.code, "NOT_FOUND");
});
