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

export default async function branch() {
  const status = run("git status --porcelain");
  if (!status) {
    console.log("No changes detected. Nothing to branch from.");
    process.exit(0);
  }

  const staged = run("git diff --cached");
  const unstaged = run("git diff");
  const untracked = run("git ls-files --others --exclude-standard");
  const diff = [staged, unstaged].filter(Boolean).join("\n");

  const summary = diff || `New files:\n${untracked}`;

  console.log("Changes detected:\n");
  console.log(status);
  console.log("\nGenerating branch name...\n");

  const name = execSync(
    `claude -p "Suggest a short git branch name for the following changes. Return ONLY the branch name, nothing else. Use kebab-case. Keep it under 40 characters. No prefixes like feature/ or fix/."`,
    { input: summary, encoding: "utf-8" }
  ).trim();

  const answer = await prompt(`Branch name: ${name}\nAccept? (y/n/e to edit): `);

  let finalName = name;

  if (answer.toLowerCase() === "e") {
    finalName = await prompt("Enter branch name: ");
  } else if (answer.toLowerCase() !== "y") {
    console.log("Cancelled.");
    process.exit(0);
  }

  run(`git checkout -b ${finalName}`);
  console.log(`\nSwitched to new branch: ${finalName}`);
}
