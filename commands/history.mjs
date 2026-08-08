import { existsSync } from "fs";
import { run, prompt, c } from "../util.mjs";

export default async function history() {
  const file = process.argv[3];

  if (!file) {
    console.error("Usage: rak history <file>");
    process.exit(1);
  }

  if (!existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  let log;
  try {
    log = run(`git log --pretty=format:"%h|%an|%ar|%s" -- "${file}"`);
  } catch {
    console.error("No git history found for this file.");
    process.exit(1);
  }

  if (!log) {
    console.log("No commits found for this file.");
    process.exit(0);
  }

  const commits = log.split("\n").map((line) => {
    const [hash, author, date, ...rest] = line.split("|");
    return { hash, author, date, subject: rest.join("|") };
  });

  console.log(`\nHistory for ${c.cyan(file)} (${commits.length} commits):\n`);

  commits.forEach((commit, i) => {
    console.log(`  ${c.yellow(`${i + 1})`)} ${commit.hash} ${commit.subject} ${c.grey(`— ${commit.author}, ${commit.date}`)}`);
  });

  console.log();
  const answer = await prompt("Enter number to view diff (or q to quit): ");

  if (answer.toLowerCase() === "q") {
    process.exit(0);
  }

  const idx = parseInt(answer, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= commits.length) {
    console.log("Invalid selection.");
    process.exit(1);
  }

  const selected = commits[idx];
  console.log(`\n${c.yellow(`Commit ${selected.hash}`)} — ${selected.subject}\n`);

  const diff = run(`git show ${selected.hash} -- "${file}"`);
  console.log(diff);
}
