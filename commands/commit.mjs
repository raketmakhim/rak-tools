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

  console.log("\nGenerating commit message...\n");

  const message = execSync(
    `claude -p "Generate a concise git commit message for the following diff. Return ONLY the commit message, nothing else. Use conventional commit format (e.g. feat:, fix:, chore:). Keep the subject line under 72 characters. Add a blank line and a short body if needed."`,
    { input: diff, encoding: "utf-8" }
  ).trim();

  console.log("--- Proposed commit message ---");
  console.log(message);
  console.log("-------------------------------\n");

  const answer = await prompt("Accept this commit message? (y/n/e to edit): ");

  let finalMessage = message;

  if (answer.toLowerCase() === "e") {
    finalMessage = await prompt("Enter your commit message: ");
  } else if (answer.toLowerCase() !== "y") {
    console.log("Commit cancelled. Changes remain staged.");
    return false;
  }

  execSync("git commit -m " + JSON.stringify(finalMessage), {
    stdio: "inherit",
  });

  console.log("\nPushing to remote...");
  execSync("git push -u origin HEAD", { stdio: "inherit" });
  console.log("Done!");

  return true;
}
