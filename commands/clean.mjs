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

export default async function clean() {
  const current = run("git branch --show-current");

  run("git fetch --prune");

  const defaultBranch = getDefaultBranch();

  const allLocal = run("git branch")
    .split("\n")
    .map((b) => b.trim().replace(/^\*\s*/, ""))
    .filter((b) => b && b !== current && b !== defaultBranch);

  if (!allLocal.length) {
    console.log("No branches to check.");
    process.exit(0);
  }

  console.log("Checking branches against GitHub...\n");

  const toDelete = allLocal.filter((b) => {
    try {
      const state = run(`gh pr view ${b} --json state -q .state`);
      return state === "MERGED";
    } catch {
      return false;
    }
  });

  if (!toDelete.length) {
    console.log("No merged branches to delete.");
    process.exit(0);
  }

  console.log("Merged branches (confirmed via GitHub):\n");
  toDelete.forEach((b) => console.log(`  ${b}`));
  console.log(`\nCurrent branch (${current}) and ${defaultBranch} are kept.\n`);

  const answer = await prompt("Delete these branches? (y/n): ");

  if (answer.toLowerCase() !== "y") {
    console.log("Cancelled.");
    process.exit(0);
  }

  const red = (s) => `\x1b[31m${s}\x1b[0m`;
  const grey = (s) => `\x1b[90m${s}\x1b[0m`;

  for (const b of toDelete) {
    try {
      run(`git branch -d ${b}`);
      console.log(red(`  ${b} [deleted]`));
    } catch {
      run(`git branch -D ${b}`);
      console.log(red(`  ${b} [deleted]`));
    }
  }

  console.log("\nDone!");
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
