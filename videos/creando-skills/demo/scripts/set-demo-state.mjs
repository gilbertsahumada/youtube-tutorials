import { copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const state = process.argv[2];

if (!new Set(["buggy", "fixed"]).has(state)) {
  throw new Error("Usage: node scripts/set-demo-state.mjs <buggy|fixed>");
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

await copyFile(
  resolve(root, `fixtures/csv.${state}.js`),
  resolve(root, "src/csv.js"),
);

console.log(`Demo state: ${state}`);
