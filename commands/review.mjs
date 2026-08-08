import { execSync, spawnSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const MAX_BUFFER = 10 * 1024 * 1024;

const REVIEW_PROMPT = `You are a senior code reviewer. Review the following diff and provide feedback. For each issue found, categorize it as one of: [BUG] [SECURITY] [STYLE] [PERF] [SUGGESTION]. Format each finding as:

[CATEGORY] file:line — description

If no issues are found, say 'Looks good — no issues found.' Be concise. Focus on real problems, not nitpicks.`;

function run(cmd, args) {
  if (args) {
    const res = spawnSync(cmd, args, { encoding: "utf-8", maxBuffer: MAX_BUFFER });
    if (res.error) throw res.error;
    if (res.status !== 0) throw new Error(res.stderr?.trim() || `${cmd} exited with code ${res.status}`);
    return (res.stdout || "").trim();
  }
  return execSync(cmd, { encoding: "utf-8", maxBuffer: MAX_BUFFER }).trim();
}

export default async function review() {
  const defaultBranch = getDefaultBranch();
  const branch = run("git branch --show-current");

  let diff;
  let context;

  if (branch === defaultBranch) {
    diff = run("git diff HEAD");
    if (!diff) {
      console.log("No changes to review.");
      process.exit(0);
    }
    context = "uncommitted changes on " + defaultBranch;
  } else {
    diff = run("git", ["diff", `${defaultBranch}...HEAD`]);
    const uncommitted = run("git diff HEAD");
    if (uncommitted) {
      diff += "\n" + uncommitted;
    }
    if (!diff) {
      console.log("No changes to review.");
      process.exit(0);
    }
    context = `branch "${branch}" vs "${defaultBranch}"`;
  }

  const log = branch !== defaultBranch
    ? run("git", ["log", `${defaultBranch}..HEAD`, "--pretty=format:%h %s"])
    : "";

  const input = log
    ? `Context: ${context}\n\nCommits:\n${log}\n\nDiff:\n${diff}`
    : `Context: ${context}\n\nDiff:\n${diff}`;

  console.log(`Reviewing ${context}...\n`);

  const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
  const red = (s) => `\x1b[31m${s}\x1b[0m`;
  const green = (s) => `\x1b[32m${s}\x1b[0m`;
  const grey = (s) => `\x1b[90m${s}\x1b[0m`;

  const inputFile = join(tmpdir(), `rak-review-${process.pid}.txt`);
  let output;
  try {
    writeFileSync(inputFile, REVIEW_PROMPT + "\n\n" + input);
    output = execSync(
      `claude -p "Follow the instructions and review the code changes provided via stdin." < ${JSON.stringify(inputFile)}`,
      { encoding: "utf-8", maxBuffer: MAX_BUFFER }
    ).trim();
  } catch (err) {
    const stderr = err.stderr?.toString().trim();
    console.error(`Failed to run review: ${stderr || err.message}`);
    process.exit(1);
  } finally {
    try { unlinkSync(inputFile); } catch {}
  }

  const colorized = output
    .replace(/\[BUG\]/g, red("[BUG]"))
    .replace(/\[SECURITY\]/g, red("[SECURITY]"))
    .replace(/\[PERF\]/g, yellow("[PERF]"))
    .replace(/\[STYLE\]/g, grey("[STYLE]"))
    .replace(/\[SUGGESTION\]/g, green("[SUGGESTION]"));

  console.log(colorized);
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
