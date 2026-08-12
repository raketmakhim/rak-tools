import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { c } from "../util.mjs";

const ROOT = join(import.meta.dirname, "..");
const CONFIG_FILE = join(ROOT, "rak.config.mjs");
const BACKENDS = ["local", "claude"];

// AI commands are the ones with a prompt file: prompts/<command>-<variant>.txt.
function aiCommands() {
  const names = readdirSync(join(ROOT, "prompts"))
    .filter((f) => f.endsWith(".txt"))
    .map((f) => f.replace(/-(claude|local)\.txt$/, ""));
  return [...new Set(names)].sort();
}

// Imported fresh so status reflects the file after a write, not the cached module.
async function readConfig() {
  const url = `${pathToFileURL(CONFIG_FILE).href}?t=${process.hrtime.bigint()}`;
  return (await import(url)).default;
}

async function status() {
  const config = await readConfig();
  const fallback = config.ai || "claude";
  const label = (be) => (be === "local" ? `local (${config.local?.model || "unknown"})` : "claude");

  if (process.env.RAK_AI) {
    console.log(c.yellow(`RAK_AI=${process.env.RAK_AI} is set, overriding everything below.\n`));
  }

  console.log(`Default: ${label(fallback)}\n`);

  for (const cmd of aiCommands()) {
    const override = config.commands?.[cmd];
    const suffix = override ? c.grey("  (override)") : "";
    console.log(`  ${cmd.padEnd(8)} ${label(override || fallback)}${suffix}`);
  }

  console.log(`\nSet with: rak ai <${BACKENDS.join("|")}> [command]`);
}

function setDefault(text, backend) {
  const line = /(\n\s*ai:\s*)"(?:local|claude)"/;
  if (!line.test(text)) throw new Error("Could not find the 'ai:' line in rak.config.mjs");
  return text.replace(line, `$1"${backend}"`);
}

function setCommand(text, cmd, backend) {
  // Already listed: just swap the value, keeping the existing indentation.
  const active = new RegExp(`^(\\s*)${cmd}:\\s*"(?:local|claude)",?`, "m");
  if (active.test(text)) return text.replace(active, `$1${cmd}: "${backend}",`);

  // Present but commented out, as the placeholders in the config are.
  const commented = new RegExp(`^(\\s*)//\\s*${cmd}:\\s*"(?:local|claude)",?`, "m");
  if (commented.test(text)) return text.replace(commented, `$1${cmd}: "${backend}",`);

  const block = /(commands:\s*\{\r?\n)/;
  if (!block.test(text)) throw new Error("Could not find the 'commands' block in rak.config.mjs");
  return text.replace(block, `$1    ${cmd}: "${backend}",\n`);
}

export default async function ai() {
  const [backend, command] = process.argv.slice(3);

  if (!backend) return status();

  if (!BACKENDS.includes(backend)) {
    console.error(`Unknown backend: ${backend}\nUse one of: ${BACKENDS.join(", ")}`);
    process.exit(1);
  }

  const commands = aiCommands();
  if (command && !commands.includes(command)) {
    console.error(`Not an AI command: ${command}\nAvailable: ${commands.join(", ")}`);
    process.exit(1);
  }

  const text = readFileSync(CONFIG_FILE, "utf-8");
  let updated;
  try {
    updated = command ? setCommand(text, command, backend) : setDefault(text, backend);
  } catch (err) {
    console.error(`${err.message}\nEdit it by hand instead.`);
    process.exit(1);
  }

  if (updated === text) {
    console.log(`${command || "Default"} already set to ${backend}.\n`);
  } else {
    writeFileSync(CONFIG_FILE, updated);
    console.log(`${command || "Default"} set to ${c.green(backend)}.\n`);
  }

  return status();
}
