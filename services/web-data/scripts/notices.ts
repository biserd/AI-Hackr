import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const rows: any[] = [];
for (const entry of await readdir("node_modules", { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
  const dirs = entry.name.startsWith("@")
    ? (await readdir(resolve("node_modules", entry.name))).map((n) =>
        resolve("node_modules", entry.name, n),
      )
    : [resolve("node_modules", entry.name)];
  for (const dir of dirs) {
    try {
      const p = JSON.parse(
        await readFile(resolve(dir, "package.json"), "utf8"),
      );
      rows.push({
        name: p.name,
        version: p.version,
        license: p.license ?? null,
        repository: p.repository?.url ?? p.repository ?? null,
      });
    } catch {
      /* not a package */
    }
  }
}
await writeFile(
  "third-party-packages.json",
  JSON.stringify(
    rows.sort((a, b) => a.name.localeCompare(b.name)),
    null,
    2,
  ),
);
console.info(
  `Recorded ${rows.length} installed package notices; package license files remain authoritative.`,
);
