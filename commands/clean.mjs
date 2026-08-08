import { run, prompt, c, getDefaultBranch } from "../util.mjs";

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

  for (const b of toDelete) {
    try { run(`git branch -d ${b}`); } catch { run(`git branch -D ${b}`); }
    console.log(c.red(`  ${b} [deleted]`));
  }

  console.log("\nDone!");
}
