import { execSync } from "child_process";
import { writeFileSync, unlinkSync, readFileSync } from "fs";
import { join, extname } from "path";
import { tmpdir } from "os";
import { run, c, getDefaultBranch, MAX_BUFFER } from "../util.mjs";

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

const CODE_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h",
  ".cs", ".php", ".swift", ".kt", ".sh", ".bash", ".zsh",
  ".vue", ".svelte", ".css", ".scss", ".html",
]);

export default async function slim() {
  const arg = process.argv[3];

  if (arg === "all") return slimAll();
  if (arg) return slimFile(arg);
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
  console.log(colorize(runClaude(`File: ${file}\n\n${content}`)));
}

function slimAll() {
  const tracked = run("git ls-files").split("\n").filter(Boolean);
  const files = tracked.filter((f) => CODE_EXTENSIONS.has(extname(f)));

  if (!files.length) {
    console.log("No code files found in the repo.");
    process.exit(0);
  }

  console.log(`Analyzing ${files.length} files...\n`);

  const separator = c.grey("─".repeat(60));

  for (const file of files) {
    console.log(separator);
    console.log(c.cyan(`\n  ${file}\n`));
    console.log(colorize(runClaude(`File: ${file}\n\n${readFileSync(file, "utf-8")}`)));
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
    if (uncommitted) diff += "\n\n" + uncommitted;
  }

  if (!diff) {
    console.log("No changes to analyze.");
    process.exit(0);
  }

  console.log(`Analyzing changes for cuts...\n`);
  console.log(colorize(runClaude(`Diff:\n${diff}`)));
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
  return output
    .replace(/\[CUT\]/g, c.yellow("[CUT]"))
    .replace(/^(\s*Before:)/gm, c.red("$1"))
    .replace(/^(\s*After:)/gm, c.green("$1"));
}
