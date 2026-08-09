import { clearCache } from "../cache.mjs";

export default async function cache() {
  clearCache();
  console.log("Cache cleared.");
}
