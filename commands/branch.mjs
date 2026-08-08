import { run, prompt } from "../util.mjs";
import { getCached, prefetch } from "../cache.mjs";

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

  let name = getCached(summary, "branch");
  console.log(name ? "\n(cached result)\n" : "\nGenerating branch name...\n");
  if (!name) {
    prefetch(summary);
    name = getCached(summary, "branch") || run(
      `claude -p "Suggest a short git branch name for the following changes. Return ONLY the branch name, nothing else. Use kebab-case. Keep it under 40 characters. No prefixes like feature/ or fix/."`,
      { input: summary }
    );
  }

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
