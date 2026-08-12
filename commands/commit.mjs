import { execSync, spawnSync } from "child_process";
import { ai, getPrompt, run, prompt, withTicket } from "../util.mjs";
import { getCached, setCached } from "../cache.mjs";

export default async function commit() {
  const status = run("git status --porcelain");
  if (!status) {
    console.log("No changes detected. Nothing to commit.");
    return false;
  }

  const staged = run("git diff --cached --name-only");

  if (!staged) {
    console.log("No staged changes found. Staging all changes...\n");
    run("git add -A");
  }
  console.log(run("git diff --cached --name-only"));

  const diff = run("git diff --cached");

  const cached = getCached(diff, "commit");
  let message;
  if (cached) {
    console.log("\n(using cached commit message)\n");
    message = cached;
  } else {
    console.log("\nGenerating commit message...\n");
    message = ai(getPrompt("commit"), diff, "commit");
    setCached(diff, "commit", message);
  }

  // Applied after the cache, so the cached message stays ticket-free and stays
  // valid if the same diff is committed on a different branch.
  message = withTicket(message);

  console.log("--- Proposed commit message ---");
  console.log(message);
  console.log("-------------------------------\n");

  const answer = await prompt("Accept this commit message? (y/n/e to edit): ");

  let finalMessage = message;

  if (answer.toLowerCase() === "e") {
    finalMessage = withTicket(await prompt("Enter your commit message: "));
  } else if (answer.toLowerCase() !== "y") {
    console.log("Commit cancelled. Changes remain staged.");
    return false;
  }

  const res = spawnSync("git", ["commit", "-m", finalMessage], {
    stdio: "inherit",
  });
  if (res.status !== 0) process.exit(res.status);

  console.log("\nPushing to remote...");
  execSync("git push -u origin HEAD", { stdio: "inherit" });
  console.log("Done!");

  return true;
}
