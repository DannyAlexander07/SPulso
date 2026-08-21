import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const playwrightRoot = dirname(require.resolve("playwright/package.json"));
const files = [
  join(playwrightRoot, "lib", "transform", "esmLoader.js"),
  join(playwrightRoot, "lib", "common", "index.js"),
];

const from =
  'specifier = context.conditions?.includes("import") ? import_url.default.pathToFileURL(resolved).toString() : resolved;';
const to =
  'specifier = Array.from(context.conditions ?? []).includes("import") ? import_url.default.pathToFileURL(resolved).toString() : resolved;';

for (const file of files) {
  if (!existsSync(file)) {
    continue;
  }

  let source = readFileSync(file, "utf8");

  if (source.includes(to)) {
    continue;
  }

  if (!source.includes(from)) {
    throw new Error(`No se encontro el patron esperado en ${file}`);
  }

  source = source.replace(from, to);
  writeFileSync(file, source);
}
