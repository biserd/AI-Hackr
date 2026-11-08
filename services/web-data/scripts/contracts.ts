import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { schemas } from "../src/contracts.js";
import {
  descriptions,
  toolSchemas,
  protocolOutputSchemas,
} from "../src/mcp.js";
const paths: Record<string, any> = {};
for (const [name, schema] of Object.entries(schemas))
  paths[`/v1/${name}`] = {
    post: {
      operationId: name,
      security: [{ apiKey: [] }, { oauth: ["web:read", "jobs:write"] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: z.toJSONSchema(schema, {
              io: "input",
              target: "openapi-3.0",
            }),
          },
        },
      },
      responses: {
        202: {
          description:
            "Accepted bounded job; poll status and read retained results.",
        },
        400: { description: "Invalid input" },
        401: { description: "Authentication required" },
        402: { description: "Insufficient funds or credit ceiling" },
        409: { description: "Idempotency conflict" },
        503: { description: "Capability unavailable" },
      },
    },
  };
for (const [path, method, description] of [
  ["capabilities", "get", "Public provider availability and hard limits"],
  ["prices", "get", "Public beta prices"],
  ["quote", "post", "Free bounded quote"],
  ["usage", "get", "Own wallet and ledger"],
  ["jobs/{id}", "get", "Own job status"],
  ["jobs/{id}/cancel", "post", "Stop future work"],
  ["results/{id}", "get", "Free retained content pagination"],
] as const)
  paths[`/v1/${path}`] = {
    [method]: {
      summary: description,
      ...(path.includes("{id}")
        ? {
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", maxLength: 200 },
              },
            ],
          }
        : {}),
      ...(!["capabilities", "prices"].includes(path)
        ? { security: [{ apiKey: [] }, { oauth: [] }] }
        : {}),
      responses: { 200: { description: "Successful response" } },
    },
  };
paths["/v1/quote"].post.requestBody = {
  required: true,
  content: {
    "application/json": {
      schema: z.toJSONSchema(toolSchemas.quote, {
        io: "input",
        target: "openapi-3.0",
      }),
    },
  },
};
paths["/v1/results/{id}"].get.parameters.push(
  { name: "cursor", in: "query", schema: { type: "string", maxLength: 500 } },
  {
    name: "pageSize",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 32000, default: 12000 },
  },
);
await mkdir("generated", { recursive: true });
await writeFile(
  "generated/openapi.json",
  JSON.stringify(
    {
      openapi: "3.0.3",
      info: {
        title: "AIHackr Web Data",
        version: "0.1.0",
        description:
          "Native async REST contracts. Optional providers are unavailable until configured.",
      },
      servers: [
        { url: "http://127.0.0.1:4100", description: "Local fixture service" },
      ],
      components: {
        securitySchemes: {
          apiKey: { type: "http", scheme: "bearer" },
          oauth: {
            type: "oauth2",
            flows: {
              authorizationCode: {
                authorizationUrl:
                  "https://auth.aihackr.com/realms/aihackr/protocol/openid-connect/auth",
                tokenUrl:
                  "https://auth.aihackr.com/realms/aihackr/protocol/openid-connect/token",
                scopes: {
                  "web:read": "Read public web using prepaid credits",
                  "jobs:read": "Read own jobs",
                  "jobs:write": "Start and cancel jobs",
                  "usage:read": "Inspect own balance",
                },
              },
            },
          },
        },
      },
      paths,
    },
    null,
    2,
  ),
);
await writeFile(
  "generated/mcp-tools.json",
  JSON.stringify(
    Object.entries(toolSchemas).map(([kind, schema]) => ({
      name: `aihackr_${kind}`,
      description: descriptions[kind],
      inputSchema: z.toJSONSchema(schema, { io: "input", target: "draft-7" }),
      outputSchema: z.toJSONSchema(protocolOutputSchemas[kind], {
        target: "draft-7",
      }),
    })),
    null,
    2,
  ),
);
console.info("Generated OpenAPI and MCP input schemas.");
