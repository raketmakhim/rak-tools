#!/usr/bin/env node

import { pathToFileURL } from "url";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const command = process.argv[2];

if (!command) {
  console.log("Usage: rak <command>\n");
  console.log("Commands:");
  console.log("  commit    Generate a commit message and push changes");
  console.log("  pr        Create a GitHub PR with AI-generated title/body");
  console.log("\nRun 'rak <command> --help' for more info on a command.");
  process.exit(0);
}

const commandFile = join(__dirname, "commands", `${command}.mjs`);

if (!existsSync(commandFile)) {
  console.error(`Unknown command: ${command}`);
  console.error(`Run 'rak' to see available commands.`);
  process.exit(1);
}

const mod = await import(pathToFileURL(commandFile).href);
await mod.default();
