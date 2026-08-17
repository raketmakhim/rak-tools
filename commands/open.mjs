import { spawnSync } from "child_process";
import config from "../load-config.mjs";
import { c } from "../util.mjs";

const defaults = {
  calendar: "https://calendar.google.com",
  jira: "https://jira.atlassian.com",
  confluence: "https://confluence.atlassian.com",
  github: "https://github.com",
};

// A site is "https://..." or { url, browser }. Strings fall back to config.browser.
function normalise(sites, fallback) {
  return Object.entries(sites).map(([name, site]) => {
    const { url, browser } = typeof site === "string" ? { url: site } : site || {};
    if (!url) throw new Error(`Site "${name}" in rak.config.mjs has no url`);
    return { name, url, browser: browser || fallback };
  });
}

// One launch per browser, not per URL: several URLs at once become tabs in one window.
function groupByBrowser(sites) {
  const groups = new Map();
  for (const { url, browser } of sites) {
    if (!groups.has(browser)) groups.set(browser, []);
    groups.get(browser).push(url);
  }
  return groups;
}

// Returns an error string, or null when the browser launched.
function launch(browser, urls) {
  if (process.platform === "linux") {
    // xdg-open ignores our choice of browser, so try the binary first.
    const direct = spawnSync(browser, urls, { stdio: "inherit" });
    if (!direct.error) return null;
    const failed = urls.filter((url) => spawnSync("xdg-open", [url], { stdio: "inherit" }).error);
    return failed.length ? `xdg-open could not open ${failed.join(", ")}` : null;
  }

  // cmd.exe re-parses the line for &, |, ^ whatever Node's argv quoting does, so
  // quote URLs ourselves and pass verbatim. Otherwise a bare & in a Jira query
  // string reads as a command separator.
  const [cmd, args, opts] = process.platform === "win32"
    ? ["cmd", ["/c", "start", '""', `"${browser}"`, ...urls.map((u) => `"${u}"`)], { windowsVerbatimArguments: true }]
    : ["open", ["-a", browser, ...urls], {}];

  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (res.error) return `failed to launch ${browser}: ${res.error.message}`;
  if (res.status !== 0 && res.status !== null) return `${browser} exited with code ${res.status}`;
  return null;
}

export default function open() {
  const sites = normalise({ ...defaults, ...config.open }, config.browser || "msedge");

  if (!sites.length) {
    console.log("No sites configured. Add an 'open' section to rak.config.mjs");
    return;
  }

  const groups = groupByBrowser(sites);
  const tabs = `${sites.length} tab${sites.length === 1 ? "" : "s"}`;
  const across = groups.size === 1
    ? `in ${[...groups.keys()][0]}`
    : `across ${groups.size} browsers`;
  console.log(`Opening ${tabs} ${across}:\n`);

  const width = Math.max(...sites.map((s) => s.browser.length));
  for (const { name, url, browser } of sites) {
    console.log(`  ${c.cyan(name.padEnd(14))} ${c.yellow(browser.padEnd(width))}  ${c.grey(url)}`);
  }

  const errors = [];
  for (const [browser, urls] of groups) {
    const err = launch(browser, urls);
    if (err) errors.push(err);
  }

  if (errors.length) {
    console.error(`\n${errors.join("\n")}`);
    process.exit(1);
  }

  console.log(`\n${c.green("Done!")}`);
}
