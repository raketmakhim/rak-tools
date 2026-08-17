import { copyFileSync, existsSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";

const ROOT = import.meta.dirname;
const CONFIG = join(ROOT, "rak.config.mjs");
const EXAMPLE = join(ROOT, "rak.config.example.mjs");

// rak.config.mjs is gitignored, so a fresh clone has none. Import the config from
// here, never statically: Node resolves the whole graph before evaluating any of
// it, so a missing file throws ERR_MODULE_NOT_FOUND before this could create it.
// The dynamic import below resolves after the copy has landed.
if (!existsSync(CONFIG)) {
  if (!existsSync(EXAMPLE)) {
    console.error("Missing both rak.config.mjs and rak.config.example.mjs.\nRestore the example with: git checkout -- rak.config.example.mjs");
    process.exit(1);
  }
  copyFileSync(EXAMPLE, CONFIG);
  console.log("Created rak.config.mjs from rak.config.example.mjs.\nEdit it to set your project key, browsers and model.\n");
}

export default (await import(pathToFileURL(CONFIG).href)).default;
