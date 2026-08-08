#!/usr/bin/env node

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

async function main() {
  // Check if there are any changes at all
  const status = run("git status --porcelain");
  if (!status) {
    console.log("No changes detected. Nothing to commit.");
    process.exit(0);
  }

  // Check for staged changes
  const staged = run("git diff --cached --name-only");

  if (staged) {
    console.log("Staged changes found:\n");
    console.log(staged);
  } else {
    console.log("No staged changes found. Staging all changes...\n");
    run("git add -A");
    const allStaged = run("git diff --cached --name-only");
    console.log(allStaged);
  }

  // Get the diff for commit message generation
  const diff = run("git diff --cached");

  console.log("\nGenerating commit message...\n");

  // Use claude CLI to generate a commit message from the diff
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
    process.exit(0);
  }

  // Commit
  execSync("git commit -m " + JSON.stringify(finalMessage), {
    stdio: "inherit",
  });

  // Push
  console.log("\nPushing to remote...");
  try {
    execSync("git push", { stdio: "inherit" });
    console.log("Done!");
  } catch {
    // If no upstream, set it
    const branch = run("git branch --show-current");
    execSync(`git push -u origin ${branch}`, { stdio: "inherit" });
    console.log("Done!");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
