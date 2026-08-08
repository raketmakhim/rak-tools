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
    context = "uncommitted changes on " + defaultBranch;
  } else {
    diff = run("git", ["diff", `${defaultBranch}...HEAD`]);
    const uncommitted = run("git diff HEAD");
    if (uncommitted) diff += "\n\n--- Uncommitted changes ---\n\n" + uncommitted;
    context = `branch "${branch}" vs "${defaultBranch}"`;
  }
  if (!diff) {
    console.log("No changes to review.");
    process.exit(0);
  }

  const log = branch !== defaultBranch
    ? run("git", ["log", `${defaultBranch}..HEAD`, "--pretty=format:%h %s"])
    : "";

  const input = log
    ? `Context: ${context}\n\nCommits:\n${log}\n\nDiff:\n${diff}`
    : `Context: ${context}\n\nDiff:\n${diff}`;

  console.log(`Reviewing ${context}...\n`);

  const COLORS = { BUG: 31, SECURITY: 31, PERF: 33, STYLE: 90, SUGGESTION: 32 };

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

  const colorized = output.replace(/\[(BUG|SECURITY|PERF|STYLE|SUGGESTION)\]/g,
    (m, tag) => `\x1b[${COLORS[tag]}m${m}\x1b[0m`);

  console.log(colorized);
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
