#!/usr/bin/env node

import { pathToFileURL } from "url";
import { existsSync } from "fs";
import { join } from "path";
import config from "./rak.config.mjs";

const __dirname = import.meta.dirname;

const command = process.argv[2];

if (!command) {
  const defaultBackend = process.env.RAK_AI || config.ai || "claude";
  const localLabel = `local (${config.local?.model || "unknown"})`;
  const label = (be) => (be === "local" ? localLabel : "claude");
  const b = (cmd) => label(config.commands?.[cmd] || defaultBackend);

  console.log(`Usage: rak <command>

Commands:
  commit    Generate a commit message and push changes  [${b("commit")}]
  pr        Create a GitHub PR with AI-generated title/body  [${b("pr")}]
  branch    Create and switch to an AI-named branch  [${b("branch")}]
  clean     Delete all merged branches
  review    AI code review of current changes  [${b("review")}]
  slim      Find ways to simplify and shorten code  [${b("slim")}]
  rebase    Rebase with AI conflict resolution  [${b("rebase")}]
  history   Show git history for a file
  cache     Clear the AI response cache

Default backend: ${label(defaultBackend)}

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
