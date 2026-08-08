import { execSync } from "child_process";

function run(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

export default async function review() {
  const defaultBranch = getDefaultBranch();
  const branch = run("git branch --show-current");

  // Get diff — branch diff if on feature branch, otherwise uncommitted changes
  let diff;
  let context;

  if (branch === defaultBranch) {
    diff = run("git diff HEAD");
    if (!diff) {
      diff = run("git diff --cached");
    }
    if (!diff) {
      console.log("No changes to review.");
      process.exit(0);
    }
    context = "uncommitted changes on " + defaultBranch;
  } else {
    diff = run(`git diff ${defaultBranch}...HEAD`);
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
    ? run(`git log ${defaultBranch}..HEAD --pretty=format:"%h %s"`)
    : "";

  const input = log
    ? `Context: ${context}\n\nCommits:\n${log}\n\nDiff:\n${diff}`
    : `Context: ${context}\n\nDiff:\n${diff}`;

  console.log(`Reviewing ${context}...\n`);

  const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
  const red = (s) => `\x1b[31m${s}\x1b[0m`;
  const green = (s) => `\x1b[32m${s}\x1b[0m`;
  const grey = (s) => `\x1b[90m${s}\x1b[0m`;

  const review = execSync(
    `claude -p "You are a senior code reviewer. Review the following diff and provide feedback. For each issue found, categorize it as one of: [BUG] [SECURITY] [STYLE] [PERF] [SUGGESTION]. Format each finding as:\n\n[CATEGORY] file:line — description\n\nIf no issues are found, say 'Looks good — no issues found.' Be concise. Focus on real problems, not nitpicks."`,
    { input, encoding: "utf-8" }
  ).trim();

  const colorized = review
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
