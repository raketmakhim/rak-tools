import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { createInterface } from "readline";
import { join } from "path";
import { tmpdir } from "os";

const MAX_BUFFER = 10 * 1024 * 1024;

function run(cmd, opts) {
  return execSync(cmd, { encoding: "utf-8", maxBuffer: MAX_BUFFER, ...opts }).trim();
}

function runSafe(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: "utf-8", maxBuffer: MAX_BUFFER });
  return { ok: res.status === 0, stdout: (res.stdout || "").trim(), stderr: (res.stderr || "").trim() };
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

export default async function rebase() {
  const branch = run("git branch --show-current");
  const defaultBranch = getDefaultBranch();

  if (branch === defaultBranch) {
    console.log(`Already on ${defaultBranch}. Pulling latest...`);
    execSync("git pull", { stdio: "inherit" });
    return;
  }

  console.log(`Rebasing ${cyan(branch)} onto ${cyan(defaultBranch)}...\n`);

  run(`git fetch origin ${defaultBranch}`);

  const result = runSafe("git", ["rebase", `origin/${defaultBranch}`]);

  if (result.ok) {
    console.log(green("Rebase successful — no conflicts."));
    return;
  }

  const conflicted = getConflictedFiles();
  if (!conflicted.length) {
    console.error(red("Rebase failed:\n") + result.stderr);
    run("git rebase --abort");
    process.exit(1);
  }

  console.log(red(`${conflicted.length} file(s) with conflicts:\n`));
  conflicted.forEach((f) => console.log(`  ${yellow(f)}`));

  const answer = await prompt("\nResolve with AI? (y/n): ");
  if (answer.toLowerCase() !== "y") {
    console.log("Conflicts left in place. Resolve manually, then run:");
    console.log("  git add . && git rebase --continue");
    return;
  }

  for (const file of conflicted) {
    console.log(`\n${cyan(`Resolving ${file}...`)}`);

    const content = readFileSync(file, "utf-8");
    const resolved = await resolveWithAI(file, content);

    if (!resolved) {
      console.log(yellow(`  Skipped — AI could not resolve ${file}`));
      continue;
    }

    console.log(`\n${green("Proposed resolution:")}\n`);
    console.log(resolved);

    const accept = await prompt(`\nAccept resolution for ${file}? (y/n): `);
    if (accept.toLowerCase() === "y") {
      writeFileSync(file, resolved);
      run(`git add "${file}"`);
      console.log(green(`  ${file} resolved and staged.`));
    } else {
      console.log(yellow(`  Skipped ${file} — resolve manually.`));
    }
  }

  const remaining = getConflictedFiles();
  if (remaining.length) {
    console.log(yellow(`\n${remaining.length} unresolved file(s) remaining:`));
    remaining.forEach((f) => console.log(`  ${f}`));
    console.log("\nResolve manually, then run:");
    console.log("  git add . && git rebase --continue");
  } else {
    console.log(green("\nAll conflicts resolved. Continuing rebase..."));
    execSync("git rebase --continue", { stdio: "inherit", env: { ...process.env, GIT_EDITOR: "true" } });
    console.log(green("Rebase complete!"));
  }
}

function getConflictedFiles() {
  const status = run("git status --porcelain");
  return status
    .split("\n")
    .filter((l) => /^(UU|AA|UD|DU) /.test(l))
    .map((l) => l.slice(3));
}

async function resolveWithAI(file, content) {
  const inputFile = join(tmpdir(), `rak-rebase-${process.pid}.txt`);
  const prompt = `You are resolving a git merge conflict. The file below contains conflict markers (<<<<<<< ======= >>>>>>>). Produce the final resolved file content — no conflict markers, no explanations, just the working code. Pick the best combination of both sides. If unsure, prefer the incoming (HEAD) changes.

File: ${file}

${content}`;

  try {
    writeFileSync(inputFile, prompt);
    const output = execSync(
      `claude -p "Resolve the merge conflict in the file provided via stdin. Output ONLY the resolved file content, nothing else." < ${JSON.stringify(inputFile)}`,
      { encoding: "utf-8", maxBuffer: MAX_BUFFER }
    ).trim();

    if (output.includes("<<<<<<<") || output.includes(">>>>>>>")) return null;
    return output;
  } catch {
    return null;
  } finally {
    try { unlinkSync(inputFile); } catch {}
  }
}

function getDefaultBranch() {
  for (const cmd of [
    "gh repo view --json defaultBranchRef -q .defaultBranchRef.name",
    "git symbolic-ref refs/remotes/origin/HEAD",
  ]) {
    try { return run(cmd).replace("refs/remotes/origin/", ""); } catch {}
  }
  return "main";
}
