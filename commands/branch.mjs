import { ai, getPrompt, run, prompt } from "../util.mjs";
import { getCached, setCached } from "../cache.mjs";

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
  if (name) {
    console.log("\n(cached result)\n");
  } else {
    console.log("\nGenerating branch name...\n");
    name = ai(getPrompt("branch"), summary, "branch");
    setCached(summary, "branch", name);
  }

  const answer = await prompt(`Branch name: ${name}\nAccept? (y/n/e to edit): `);

  const choice = answer.toLowerCase();
  if (choice !== "y" && choice !== "e") {
    console.log("Cancelled.");
    process.exit(0);
  }
  const finalName = choice === "e" ? await prompt("Enter branch name: ") : name;

  run("git", ["checkout", "-b", finalName]);
  console.log(`\nSwitched to new branch: ${finalName}`);
}
