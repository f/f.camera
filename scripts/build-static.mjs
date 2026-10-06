import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { siteFiles } from "./site-files.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "dist");
await rm(output, { recursive: true, force: true });
for (const file of siteFiles) {
  await mkdir(dirname(join(output, file)), { recursive: true });
  await copyFile(join(root, file), join(output, file));
}
console.log(`Staged ${siteFiles.length} browser files in dist/.`);
