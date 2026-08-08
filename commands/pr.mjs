import { execSync } from "child_process";
import { createInterface } from "readline";

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

  // Check for existing PR
  try {
    const existing = run(`gh pr view --json url -q .url`);
    if (existing) {
      console.log(`PR already exists: ${existing}`);
      process.exit(0);
    }
  } catch {
    // No existing PR — continue
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
  const input = `Commits:\n${log}\n\nDiff:\n${fullDiff}`;

  const generated = execSync(
    `claude -p "Generate a GitHub pull request title and body for the following changes. Format your response EXACTLY as:\nTITLE: <title here>\nBODY:\n<body here>\n\nKeep the title under 72 characters. The body should have a short summary, then a bullet list of changes. Use markdown. Be concise."`,
    { input, encoding: "utf-8" }
  ).trim();

  const titleMatch = generated.match(/^TITLE:\s*(.+)/m);
  const bodyMatch = generated.match(/BODY:\n([\s\S]+)/m);

  const title = titleMatch?.[1]?.trim() || branch;
  const body = bodyMatch?.[1]?.trim() || generated;

  console.log("--- Proposed PR ---");
  console.log(`Title: ${title}\n`);
  console.log(body);
  console.log("-------------------\n");

  const answer = await prompt("Create this PR? (y/n/e to edit title): ");

  let finalTitle = title;

  if (answer.toLowerCase() === "e") {
    finalTitle = await prompt("Enter PR title: ");
  } else if (answer.toLowerCase() !== "y") {
    console.log("PR cancelled.");
    process.exit(0);
  }

  const result = run(
    `gh pr create --title ${JSON.stringify(finalTitle)} --body ${JSON.stringify(body)} --base ${defaultBranch}`
  );

  console.log(`\n${result}`);
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
