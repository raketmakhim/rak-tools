import { execSync, spawnSync } from "child_process";
import { writeFileSync, unlinkSync, readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { tmpdir } from "os";

const MAX_BUFFER = 10 * 1024 * 1024;

const SLIM_PROMPT = `You are a code efficiency expert. Your only job is to find ways to make code shorter and simpler. For each finding, show:

[CUT] file:line — what to simplify
  Before: <current code>
  After:  <simpler version>

Focus on:
- Redundant logic or repeated patterns that can be collapsed
- Verbose expressions that can be one-liners
- Over-abstracted wrappers that add no value
- Unused imports, variables, or dead code
- Conditions that can be simplified
- Built-in methods that replace manual loops

Do NOT suggest renaming, style changes, or adding comments. Only suggest changes that reduce code. Rank by impact — biggest savings first. If the code is already lean, say 'Already slim — nothing to cut.'`;

function run(cmd, args) {
  if (args) {
    const res = spawnSync(cmd, args, { encoding: "utf-8", maxBuffer: MAX_BUFFER });
    if (res.error) throw res.error;
    if (res.status !== 0) throw new Error(res.stderr?.trim() || `${cmd} exited with code ${res.status}`);
    return (res.stdout || "").trim();
  }
  return execSync(cmd, { encoding: "utf-8", maxBuffer: MAX_BUFFER }).trim();
}

const CODE_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h",
  ".cs", ".php", ".swift", ".kt", ".sh", ".bash", ".zsh",
  ".vue", ".svelte", ".css", ".scss", ".html",
]);

export default async function slim() {
  const arg = process.argv[3];

  if (arg === "all") {
    return slimAll();
  }

  if (arg) {
    return slimFile(arg);
  }

  return slimDiff();
}

function slimFile(file) {
  let content;
  try {
    content = readFileSync(file, "utf-8");
  } catch {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  console.log(`Analyzing ${file} for cuts...\n`);

  const input = `File: ${file}\n\n${content}`;
  const output = runClaude(input);
  console.log(colorize(output));
}

function slimAll() {
  const tracked = run("git ls-files").split("\n").filter(Boolean);
  const files = tracked.filter((f) => CODE_EXTENSIONS.has(extname(f)));

  if (!files.length) {
    console.log("No code files found in the repo.");
    process.exit(0);
  }

  console.log(`Analyzing ${files.length} files...\n`);

  const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
  const separator = "\x1b[90m" + "─".repeat(60) + "\x1b[0m";

  for (const file of files) {
    console.log(separator);
    console.log(cyan(`\n  ${file}\n`));

    const content = readFileSync(file, "utf-8");
    const input = `File: ${file}\n\n${content}`;
    const output = runClaude(input);
    console.log(colorize(output));
    console.log();
  }
}

function slimDiff() {
  const defaultBranch = getDefaultBranch();
  const branch = run("git branch --show-current");

  let diff;
  if (branch === defaultBranch) {
    diff = run("git diff HEAD");
  } else {
    diff = run("git", ["diff", `${defaultBranch}...HEAD`]);
    const uncommitted = run("git diff HEAD");
    if (uncommitted) {
      diff += "\n\n" + uncommitted;
    }
  }

  if (!diff) {
    console.log("No changes to analyze.");
    process.exit(0);
  }

  console.log(`Analyzing changes for cuts...\n`);

  const output = runClaude(`Diff:\n${diff}`);
  console.log(colorize(output));
}

function runClaude(input) {
  const inputFile = join(tmpdir(), `rak-slim-${process.pid}.txt`);
  try {
    writeFileSync(inputFile, SLIM_PROMPT + "\n\n" + input);
    return execSync(
      `claude -p "Follow the instructions and analyze the code provided via stdin." < ${JSON.stringify(inputFile)}`,
      { encoding: "utf-8", maxBuffer: MAX_BUFFER }
    ).trim();
  } catch (err) {
    const stderr = err.stderr?.toString().trim();
    console.error(`Failed to run analysis: ${stderr || err.message}`);
    process.exit(1);
  } finally {
    try { unlinkSync(inputFile); } catch {}
  }
}

function colorize(output) {
  const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
  const green = (s) => `\x1b[32m${s}\x1b[0m`;
  const red = (s) => `\x1b[31m${s}\x1b[0m`;

  return output
    .replace(/\[CUT\]/g, yellow("[CUT]"))
    .replace(/^(\s*Before:)/gm, red("$1"))
    .replace(/^(\s*After:)/gm, green("$1"));
}

function getDefaultBranch() {
  try {
    return run("gh repo view --json defaultBranchRef -q .defaultBranchRef.name");
  } catch {
    try {
      const ref = run("git symbolic-ref refs/remotes/origin/HEAD");
      return ref.replace("refs/remotes/origin/", "");
    } catch {
      return "main";
    }
  }
}
