import { execSync } from "child_process";
import { createInterface } from "readline";
import { getCached, prefetch } from "../cache.mjs";

function run(cmd, opts) {
  return execSync(cmd, { encoding: "utf-8", ...opts }).trim();
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
  const diff = [staged, unstaged].filter(Boolean).join("\n");
  const summary = diff || `New files:\n${run("git ls-files --others --exclude-standard")}`;

  console.log("Changes detected:\n");
  console.log(status);

  const cached = getCached(summary, "branch");
  if (cached) {
    console.log("\n(cached result)\n");
  } else {
    console.log("\nGenerating branch name...\n");
    prefetch(summary);
  }

  const name = getCached(summary, "branch") || run(
    `claude -p "Suggest a short git branch name for the following changes. Return ONLY the branch name, nothing else. Use kebab-case. Keep it under 40 characters. No prefixes like feature/ or fix/."`,
    { input: summary }
  );

  const answer = await prompt(`Branch name: ${name}\nAccept? (y/n/e to edit): `);

  const choice = answer.toLowerCase();
  if (choice !== "y" && choice !== "e") {
    console.log("Cancelled.");
    process.exit(0);
  }
  const finalName = choice === "e" ? await prompt("Enter branch name: ") : name;

  run(`git checkout -b ${finalName}`);
  console.log(`\nSwitched to new branch: ${finalName}`);
}
