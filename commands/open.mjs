import { spawnSync } from "child_process";
import config from "../rak.config.mjs";
import { c } from "../util.mjs";

const defaults = {
  calendar: "https://calendar.google.com",
  jira: "https://jira.atlassian.com",
  confluence: "https://confluence.atlassian.com",
  github: "https://github.com",
};

export default function open() {
  const sites = config.open || defaults;
  const browser = config.browser || "msedge";
  const names = Object.keys(sites);

  if (!names.length) {
    console.log("No sites configured. Add an 'open' section to rak.config.mjs");
    return;
  }

  console.log(`Opening ${names.length} tabs in ${browser}:\n`);
  names.forEach((name) => console.log(`  ${c.cyan(name.padEnd(14))} ${c.grey(sites[name])}`));

  const urls = Object.values(sites);

  if (process.platform === "linux") {
    const failed = [];
    for (const url of urls) {
      const res = spawnSync("xdg-open", [url], { stdio: "inherit" });
      if (res.error) failed.push(url);
    }
    if (failed.length) {
      console.error(`\nFailed to launch: ${failed.join(", ")}`);
      process.exit(1);
    }
    console.log(`\n${c.green("Done!")}`);
    return;
  }

  const [cmd, args] = process.platform === "win32"
    ? ["cmd", ["/c", "start", '""', browser, ...urls]]
    : ["open", ["-a", browser, ...urls]];

  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.error) {
    console.error(`Failed to launch ${browser}: ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0 && res.status !== null) {
    console.error(`${browser} exited with code ${res.status}`);
    process.exit(1);
  }

  console.log(`\n${c.green("Done!")}`);
}
