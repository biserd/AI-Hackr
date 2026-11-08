import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { zipSync, unzipSync, strToU8 } from "fflate";
import AjvModule from "ajv/dist/2020.js";
const Ajv = AjvModule.default ?? AjvModule;
const root = resolve("plugin");
async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? files(resolve(dir, e.name)) : [resolve(dir, e.name)],
      ),
    )
  ).flat();
}
const entries: Record<string, Uint8Array> = {};
for (const path of await files(root))
  entries[relative(root, path).split(sep).join("/")] = new Uint8Array(
    await readFile(path),
  );
const plugin = JSON.parse(Buffer.from(entries["plugin.json"]).toString()),
  mcp = JSON.parse(Buffer.from(entries["mcp.json"]).toString());
// Official schemas are vendored verbatim by refresh-schemas.ts, with source URLs in docs/sources.md.
for (const [name, value] of [
  ["plugin", plugin],
  ["mcp", mcp],
] as const) {
  const schema = JSON.parse(
    await readFile(`schemas/${name}.schema.json`, "utf8"),
  );
  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    validateFormats: false,
  });
  if (!ajv.validate(schema, value))
    throw new Error(`${name} schema: ${JSON.stringify(ajv.errors)}`);
}
if (!entries["skills/setup/SKILL.md"] || !entries["skills/research/SKILL.md"])
  throw new Error("Missing skills.");
for (const [name, bytes] of Object.entries(entries)) {
  if (
    name.includes("..") ||
    name.startsWith("/") ||
    /\.env|node_modules/i.test(name)
  )
    throw new Error("Unsafe archive path");
  if (
    /(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{16,}|ahk_[A-Za-z0-9_-]{30,}|-----BEGIN.*PRIVATE KEY/.test(
      Buffer.from(bytes).toString(),
    )
  )
    throw new Error("Credential-like content in plugin.");
}
const url = mcp.mcpServers.aihackr.url;
if (url !== "https://api.aihackr.com/mcp")
  throw new Error("Unexpected production origin.");
if (process.argv[2] === "build") {
  await mkdir("release", { recursive: true });
  const zipped = zipSync(entries, { level: 9 });
  const roundtrip = unzipSync(zipped);
  if (!roundtrip["plugin.json"]) throw new Error("ZIP roundtrip failed.");
  await writeFile("release/aihackr-plugin-0.1.0.zip", zipped);
  await writeFile(
    "release/validation.json",
    strToU8(
      JSON.stringify(
        {
          schemaValidation: "passed",
          files: Object.keys(entries),
          installedInClient: false,
          proposedOrigin: url,
        },
        null,
        2,
      ),
    ),
  );
}
console.info(
  `Validated ${Object.keys(entries).length} plugin files against published schemas. Host installation not tested.`,
);
