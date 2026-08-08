import { execSync, spawnSync } from "child_process";
import { createInterface } from "readline";
import commit from "./commit.mjs";

function run(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim();
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

export default async function pr() {
  const branch = run("git branch --show-current");
  const defaultBranch = getDefaultBranch();

  if (branch === defaultBranch) {
    console.error(`Already on ${defaultBranch}. Switch to a feature branch first.`);
    process.exit(1);
  }

  // Check for uncommitted changes
  const status = run("git status --porcelain");
  if (status) {
    console.log("Uncommitted changes detected:\n");
    console.log(status);
    const commitAnswer = await prompt("\nCommit these changes first? (y/n): ");
    if (commitAnswer.toLowerCase() === "y") {
      await commit();
    } else {
      console.log("Continuing without committing. Uncommitted changes won't be in the PR.\n");
    }
  }

  // Check for existing PR
  let existingPrUrl = null;
  try {
    existingPrUrl = run(`gh pr view --json url -q .url`);
  } catch {
    // No existing PR
  }

  // Ensure branch is pushed
  try {
    run(`git rev-parse --abbrev-ref @{u}`);
  } catch {
    console.log("Pushing branch to origin...");
    execSync(`git push -u origin ${branch}`, { stdio: "inherit" });
  }

  // Gather commits since divergence from default branch
  const log = run(`git log ${defaultBranch}..HEAD --pretty=format:"%h %s"`);
  const diff = run(`git diff ${defaultBranch}...HEAD --stat`);

  if (!log) {
    console.error(`No commits ahead of ${defaultBranch}. Nothing to PR.`);
    process.exit(1);
  }

  console.log(`Branch: ${branch} → ${defaultBranch}`);
  console.log(`\nCommits:\n${log}\n`);
  console.log(`Changes:\n${diff}\n`);

  console.log("Generating PR title and description...\n");

  const fullDiff = run(`git diff ${defaultBranch}...HEAD`);
  const baseDiffStat = run(`git diff ${defaultBranch}...HEAD --stat --numstat`);
  const lines = baseDiffStat.split("\n").filter((l) => /^\d+\t/.test(l));
  const newFiles = lines.filter((l) => /\t0\t/.test(l)).length;
  const totalFiles = lines.length;
  const context = newFiles === totalFiles
    ? "All files in this diff are newly created — this is not a refactor or move."
    : `${newFiles} of ${totalFiles} files are new additions.`;

  const input = `Context: Branch "${branch}" → "${defaultBranch}". ${context}\n\nCommits:\n${log}\n\nDiff:\n${fullDiff}`;

  const generated = execSync(
    `claude -p "Generate a GitHub pull request title and body for the following changes. Format your response EXACTLY as:\nTITLE: <title here>\nBODY:\n<body here>\n\nKeep the title under 72 characters. The body should have a short summary, then a bullet list of what was added or changed. Use markdown. Be concise. Pay attention to the Context line — if files are new, describe them as additions, not moves or refactors."`,
    { input, encoding: "utf-8" }
  ).trim();

  const titleMatch = generated.match(/^title:\s*(.+)/im);
  const bodyMatch = generated.match(/body:\s*\n([\s\S]+)/im);

  const title = titleMatch?.[1]?.trim() || branch;
  const body = (bodyMatch?.[1] || generated)
    .replace(/^Title:.*\n*/im, "")
    .trim();

  const action = existingPrUrl ? "Update" : "Create";
  console.log(`--- Proposed PR (${action.toLowerCase()}) ---`);
  console.log(`Title: ${title}\n`);
  console.log(body);
  console.log("-------------------\n");

  const answer = await prompt(`${action} this PR? (y/n/e to edit title): `);

  let finalTitle = title;

  const choice = answer.toLowerCase();
  if (choice === "e") {
    finalTitle = await prompt("Enter PR title: ");
  } else if (choice !== "y") {
    console.log("PR cancelled.");
    process.exit(0);
  }

  const args = existingPrUrl
    ? ["pr", "edit", "--title", finalTitle, "--body", body]
    : ["pr", "create", "--title", finalTitle, "--body", body, "--base", defaultBranch];
  const res = spawnSync("gh", args, { encoding: "utf-8" });
  if (res.status !== 0) {
    console.error(res.stderr?.trim() || `Failed to ${action.toLowerCase()} PR.`);
    process.exit(1);
  }
  console.log(existingPrUrl ? `\nPR updated: ${existingPrUrl}` : `\n${res.stdout.trim()}`);
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
