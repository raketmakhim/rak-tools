#!/usr/bin/env node

import { pathToFileURL } from "url";
import { existsSync } from "fs";
import { join } from "path";
import config from "./rak.config.mjs";

const __dirname = import.meta.dirname;

const command = process.argv[2];

if (!command) {
  const backend = process.env.RAK_AI || config.ai || "claude";
  const label = backend === "local"
    ? `local (${config.local?.model || "unknown"})`
    : "claude";

  console.log(`Usage: rak <command>

Commands:
  commit    Generate a commit message and push changes
  pr        Create a GitHub PR with AI-generated title/body
  branch    Create and switch to an AI-named branch from current changes
  clean     Delete all merged branches
  review    AI code review of current changes
  history   Show git history for a file
  slim      Find ways to simplify and shorten code
  rebase    Rebase onto default branch with AI conflict resolution
  cache     Clear the AI response cache

AI backend: ${label}

Run 'rak <command> --help' for more info on a command.`);
  process.exit(0);
}

const commandFile = join(__dirname, "commands", `${command}.mjs`);

if (!existsSync(commandFile)) {
  console.error(`Unknown command: ${command}\nRun 'rak' to see available commands.`);
  process.exit(1);
}

try {
  const mod = await import(pathToFileURL(commandFile).href);
  await mod.default();
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
