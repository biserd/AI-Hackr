import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
const key = process.env.AIHACKR_API_KEY;
if (!key)
  throw new Error("Set AIHACKR_API_KEY in the local client environment.");
const remote = new Client({ name: "aihackr-stdio-bridge", version: "0.1.0" });
await remote.connect(
  new StreamableHTTPClientTransport(
    new URL(`${process.env.AIHACKR_BASE_URL ?? "http://127.0.0.1:4100"}/mcp`),
    { requestInit: { headers: { Authorization: `Bearer ${key}` } } },
  ),
);
const server = new Server(
  { name: "AIHackr", version: "0.1.0" },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, () => remote.listTools());
server.setRequestHandler(CallToolRequestSchema, (request) =>
  remote.callTool(request.params),
);
await server.connect(new StdioServerTransport());
process.once("SIGINT", () => {
  void remote.close();
  void server.close();
});
