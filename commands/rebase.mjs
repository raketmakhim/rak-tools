import { execSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { run, prompt, c, getDefaultBranch, MAX_BUFFER } from "../util.mjs";

export default async function rebase() {
  const branch = run("git branch --show-current");
  const defaultBranch = getDefaultBranch();

  if (branch === defaultBranch) {
    console.log(`Already on ${defaultBranch}. Pulling latest...`);
    execSync("git pull", { stdio: "inherit" });
    return;
  }

  console.log(`Rebasing ${c.cyan(branch)} onto ${c.cyan(defaultBranch)}...\n`);

  run("git", ["fetch", "origin", defaultBranch]);

  let rebaseError;
  try {
    run("git", ["rebase", `origin/${defaultBranch}`]);
    console.log(c.green("Rebase successful — no conflicts."));
    return;
  } catch (err) {
    rebaseError = err;
  }

  let conflicted = getConflictedFiles();
  if (!conflicted.length) {
    console.error(c.red("Rebase failed:\n") + (rebaseError?.message || ""));
    try { run("git rebase --abort"); } catch {}
    process.exit(1);
  }

  let aiEnabled = false;
  let round = 1;

  while (conflicted.length) {
    if (round > 1) console.log(c.cyan(`\n--- Conflict round ${round} ---\n`));

    console.log(c.red(`${conflicted.length} file(s) with conflicts:\n`));
    conflicted.forEach((f) => console.log(`  ${c.yellow(f)}`));

    if (!aiEnabled) {
      const answer = await prompt("\nResolve with AI? (y/n): ");
      if (answer.toLowerCase() !== "y") {
        console.log("Conflicts left in place. Resolve manually, then run:");
        console.log("  git add . && git rebase --continue");
        return;
      }
      aiEnabled = true;
    }

    for (const file of conflicted) {
      console.log(`\n${c.cyan(`Resolving ${file}...`)}`);

      let content;
      try {
        content = readFileSync(file, "utf-8");
      } catch {
        console.log(c.yellow(`  Skipped — file not on disk (delete/modify conflict)`));
        continue;
      }

      const resolved = await resolveWithAI(file, content);

      if (!resolved) {
        console.log(c.yellow(`  Skipped — AI could not resolve ${file}`));
        continue;
      }

      console.log(`\n${c.green("Proposed resolution:")}\n`);
      console.log(resolved);

      const accept = await prompt(`\nAccept resolution for ${file}? (y/n): `);
      if (accept.toLowerCase() === "y") {
        writeFileSync(file, resolved);
        run("git", ["add", file]);
        console.log(c.green(`  ${file} resolved and staged.`));
      } else {
        console.log(c.yellow(`  Skipped ${file} — resolve manually.`));
      }
    }

    const remaining = getConflictedFiles();
    if (remaining.length) {
      console.log(c.yellow(`\n${remaining.length} unresolved file(s) remaining:`));
      remaining.forEach((f) => console.log(`  ${f}`));
      console.log("\nResolve manually, then run:");
      console.log("  git add . && git rebase --continue");
      return;
    }

    console.log(c.green("\nAll conflicts resolved. Continuing rebase..."));
    try {
      execSync("git rebase --continue", { stdio: "inherit", env: { ...process.env, GIT_EDITOR: "true" } });
    } catch {
      conflicted = getConflictedFiles();
      if (conflicted.length) {
        round++;
        continue;
      }
      console.log(c.yellow("\nRebase paused — hook failure or other error."));
      console.log("Check status and run: git rebase --continue");
      return;
    }

    conflicted = [];
  }

  console.log(c.green("Rebase complete!"));
}

function getConflictedFiles() {
  const status = run("git status --porcelain");
  return status
    .split("\n")
    .filter((l) => /^(UU|AA|AU|UA|DD|UD|DU) /.test(l))
    .map((l) => l.slice(3));
}

async function resolveWithAI(file, content) {
  const inputFile = join(tmpdir(), `rak-rebase-${process.pid}.txt`);
  const aiPrompt = `You are resolving a git merge conflict during a rebase. The file below contains conflict markers (<<<<<<< ======= >>>>>>>). During rebase, the section between <<<<<<< and ======= is the upstream (base) side, and the section between ======= and >>>>>>> is the user's own changes being replayed. Produce the final resolved file content — no conflict markers, no explanations, just the working code. Pick the best combination of both sides. If unsure, prefer the user's changes (the section after =======).

File: ${file}

${content}`;

  try {
    writeFileSync(inputFile, aiPrompt);
    const output = execSync(
      `claude -p "Resolve the merge conflict in the file provided via stdin. Output ONLY the resolved file content, nothing else." < ${JSON.stringify(inputFile)}`,
      { encoding: "utf-8", maxBuffer: MAX_BUFFER }
    ).trim();

    if (output.includes("<<<<<<<") || output.includes(">>>>>>>")) return null;
    return output;
  } catch {
    return null;
  } finally {
    try { unlinkSync(inputFile); } catch {}
  }
}
