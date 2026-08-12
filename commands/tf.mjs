import { spawnSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { basename, join } from "path";
import { prompt, c } from "../util.mjs";

const COMMANDS = ["init", "plan", "apply", "destroy"];

function usage() {
  console.log(`Usage: rak tf <${COMMANDS.join("|")}> [env]

Runs terraform against the stack in the current directory, the folder holding
tfvars/. init always runs first, using tfvars/<env>.backend.tfvars.

  env    Environment, matching tfvars/<env>.tfvars. Omit to pick from a list.

Examples:
  rak tf plan
  rak tf apply dev01`);
}

function terraform(args) {
  // stdio inherit so plan output streams and apply's confirmation can read stdin.
  const res = spawnSync("terraform", args, { stdio: "inherit" });
  if (res.error) {
    const msg = res.error.code === "ENOENT"
      ? "terraform not found on PATH"
      : res.error.message;
    console.error(c.red(msg));
    process.exit(1);
  }
  return res.status ?? 1;
}

export default async function tf() {
  const args = process.argv.slice(3);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    usage();
    return;
  }

  if (!COMMANDS.includes(command)) {
    console.error(`Unknown terraform command: ${command}\n`);
    usage();
    process.exit(1);
  }

  const stackDir = process.cwd();
  const tfvarsDir = join(stackDir, "tfvars");

  if (!existsSync(tfvarsDir)) {
    console.error("No tfvars/ here. Run this from inside a terraform stack folder.\n");
    usage();
    process.exit(1);
  }

  // Environments are tfvars/<env>.tfvars, excluding the *.backend.tfvars files.
  const envs = readdirSync(tfvarsDir)
    .filter((f) => f.endsWith(".tfvars") && !f.endsWith(".backend.tfvars"))
    .map((f) => basename(f, ".tfvars"))
    .sort();

  if (!envs.length) {
    console.error(`No environments found in ${tfvarsDir}`);
    process.exit(1);
  }

  let env = args[1];

  if (env) {
    if (!envs.includes(env)) {
      console.error(`Unknown environment: ${env}\nAvailable: ${envs.join(", ")}`);
      process.exit(1);
    }
  } else {
    envs.forEach((e, i) => console.log(`  ${c.yellow(`[${i}]`)} ${e}`));
    console.log();
    const answer = await prompt("Pick an environment number: ");
    env = envs[Number.parseInt(answer, 10)];
    if (!env) {
      console.error("Invalid selection.");
      process.exit(1);
    }
  }

  const backendVars = join("tfvars", `${env}.backend.tfvars`);
  const vars = join("tfvars", `${env}.tfvars`);

  if (!existsSync(backendVars)) {
    console.error(`Backend tfvars not found: ${backendVars}`);
    process.exit(1);
  }

  console.log();
  console.log(c.cyan(`Stack : ${basename(stackDir)}`));
  console.log(c.cyan(`Env   : ${env}`));
  console.log(c.cyan(`Action: ${command}`));
  console.log();

  const initStatus = terraform(["init", `-backend-config=${backendVars}`, "-reconfigure"]);
  if (initStatus !== 0) process.exit(initStatus);

  if (command !== "init") {
    process.exit(terraform([command, `-var-file=${vars}`]));
  }
}
