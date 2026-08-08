import { execSync, spawnSync } from "child_process";
import { createInterface } from "readline";

export const MAX_BUFFER = 10 * 1024 * 1024;

export function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export function run(cmd, opts) {
  if (Array.isArray(opts)) {
    const res = spawnSync(cmd, opts, { encoding: "utf-8", maxBuffer: MAX_BUFFER });
    if (res.error) throw res.error;
    if (res.status !== 0) throw new Error(res.stderr?.trim() || `${cmd} exited with code ${res.status}`);
    return (res.stdout || "").trim();
  }
  return execSync(cmd, { encoding: "utf-8", maxBuffer: MAX_BUFFER, ...opts }).trim();
}

export const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  grey: (s) => `\x1b[90m${s}\x1b[0m`,
};

export function getDefaultBranch() {
  for (const cmd of [
    "gh repo view --json defaultBranchRef -q .defaultBranchRef.name",
    "git symbolic-ref refs/remotes/origin/HEAD",
  ]) {
    try { return run(cmd).replace("refs/remotes/origin/", ""); } catch {}
  }
  return "main";
}
