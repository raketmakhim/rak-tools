#!/usr/bin/env node

import { pathToFileURL } from "url";
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import config from "./rak.config.mjs";
import { getProject, c } from "./util.mjs";

const __dirname = import.meta.dirname;

const command = process.argv[2];

if (!command) {
  const defaultBackend = process.env.RAK_AI || config.ai || "claude";
  const localLabel = `local (${config.local?.model || "unknown"})`;
  const label = (be) => (be === "local" ? localLabel : "claude");
  const b = (cmd) => label(config.commands?.[cmd] || defaultBackend);

  // Per-repo setup, so this reflects wherever you are standing.
  const project = getProject();
  const projectLine = project
    ? `Project:         ${project}  ${c.grey("(git config rak.project <KEY> to change)")}`
    : `Project:         ${c.grey("not set")}  ${c.grey("(git config rak.project <KEY> for [KEY-123] prefixes)")}`;

  console.log(`Usage: rak <command>

Commands:
  ai        Show or switch the backend per command
  aws       Pick an AWS profile, SSO log in, set AWS_PROFILE
  branch    Create and switch to an AI-named branch  [${b("branch")}]
  cache     Clear the AI response cache
  clean     Delete all merged branches
  commit    Generate a commit message and push changes  [${b("commit")}]
  history   Show git history for a file
  pr        Create a GitHub PR with AI-generated title/body  [${b("pr")}]
  rebase    Rebase with AI conflict resolution  [${b("rebase")}]
  review    AI code review of current changes  [${b("review")}]
  slim      Find ways to simplify and shorten code  [${b("slim")}]
  tf        Run terraform against the stack you are in

Default backend: ${label(defaultBackend)}  ${c.grey("(rak ai to change)")}
${projectLine}`);
  process.exit(0);
}

const commandFile = join(__dirname, "commands", `${command}.mjs`);

// No .mjs command? Fall back to scripts/<command>.ps1 or .sh, so a plain shell
// script can be a subcommand without a JS wrapper. Note these run in a child
// process: a script that sets env vars needs dot-sourcing to affect your shell.
if (!existsSync(commandFile)) {
  const args = process.argv.slice(3);
  const runners = [
    [join(__dirname, "scripts", `${command}.ps1`), "powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"]],
    [join(__dirname, "scripts", `${command}.sh`), "bash", []],
  ];
  const match = runners.find(([file]) => existsSync(file));

  if (!match) {
    console.error(`Unknown command: ${command}\nRun 'rak' to see available commands.`);
    process.exit(1);
  }

  const [file, bin, flags] = match;
  // RAK_CHILD tells a script it cannot affect the caller's environment from here.
  const res = spawnSync(bin, [...flags, file, ...args], {
    stdio: "inherit",
    env: { ...process.env, RAK_CHILD: "1" },
  });
  if (res.error) {
    console.error(`Failed to run ${command}: ${res.error.message}`);
    process.exit(1);
  }
  process.exit(res.status ?? 1);
}

try {
  const mod = await import(pathToFileURL(commandFile).href);
  await mod.default();
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
