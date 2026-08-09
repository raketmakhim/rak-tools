import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
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
  const entry = cache[key];
  if (entry && entry.hash === hash) return entry.value;
  return null;
}

export function setCached(diff, key, value) {
  const hash = hashDiff(diff);
  const cache = readCache();
  cache[key] = { hash, value };
  writeCache(cache);
}

export function clearCache() {
  try { writeFileSync(CACHE_FILE, "{}"); } catch {}
}
