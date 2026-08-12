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
  const names = Object.keys(sites);

  if (!names.length) {
    console.log("No sites configured. Add an 'open' section to rak.config.mjs");
    return;
  }

  console.log(`Opening ${names.length} tabs in Edge:\n`);
  names.forEach((name) => console.log(`  ${c.cyan(name.padEnd(14))} ${c.grey(sites[name])}`));

  const urls = Object.values(sites);
  spawnSync("cmd", ["/c", "start", "msedge", ...urls], { stdio: "inherit" });

  console.log(`\n${c.green("Done!")}`);
}
