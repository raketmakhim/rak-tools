import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { execSync } from "child_process";
import { tmpdir } from "os";

const CACHE_DIR = join(tmpdir(), "rak-cache");
const CACHE_FILE = join(CACHE_DIR, "diff-cache.json");

function hashDiff(diff) {
  return createHash("sha256").update(diff).digest("hex").slice(0, 16);
}

function readCache() {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeCache(data) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

export function getCached(diff, key) {
  const hash = hashDiff(diff);
  const cache = readCache();
  if (cache.hash === hash && cache[key]) return cache[key];
  return null;
}

export function setCached(diff, key, value) {
  const hash = hashDiff(diff);
  const cache = readCache();
  if (cache.hash !== hash) {
    cache.hash = hash;
    cache.branch = undefined;
    cache.commit = undefined;
    cache.review = undefined;
  }
  cache[key] = value;
  writeCache(cache);
}

export function prefetch(diff) {
  const hash = hashDiff(diff);
  const cache = readCache();
  if (cache.hash === hash && cache.branch && cache.commit && cache.review) return;

  const inputFile = join(tmpdir(), `rak-prefetch-${process.pid}.txt`);
  const prompt = `You are given a code diff. Provide three outputs in the exact format below. Do not deviate from this format.

BRANCH_NAME:
<a short kebab-case git branch name for these changes, under 40 chars, no prefixes like feature/ or fix/>

COMMIT_MESSAGE:
<a conventional commit message for these changes — type(scope): description, then a blank line, then a short body if needed>

REVIEW:
<review the diff for bugs, security issues, performance, and suggestions. For each issue: [CATEGORY] file:line — description. Categories: [BUG] [SECURITY] [PERF] [STYLE] [SUGGESTION]. If no issues, say "Looks good — no issues found.">`;

  try {
    writeFileSync(inputFile, prompt + "\n\nDiff:\n" + diff);
    const output = execSync(
      `claude -p "Follow the instructions provided via stdin. Output all three sections exactly as specified." < ${JSON.stringify(inputFile)}`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    ).trim();

    const branchMatch = output.match(/BRANCH_NAME:\s*\n(.+)/);
    const commitMatch = output.match(/COMMIT_MESSAGE:\s*\n([\s\S]+?)(?=\nREVIEW:)/);
    const reviewMatch = output.match(/REVIEW:\s*\n([\s\S]+)/);

    const newCache = { hash };
    if (branchMatch) newCache.branch = branchMatch[1].trim();
    if (commitMatch) newCache.commit = commitMatch[1].trim();
    if (reviewMatch) newCache.review = reviewMatch[1].trim();

    writeCache(newCache);
  } catch {
    // prefetch failed — commands will fall back to individual calls
  } finally {
    try { unlinkSync(inputFile); } catch {}
  }
}
