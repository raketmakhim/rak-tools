export default {
  // Default backend: "claude" or "local"
  ai: "local",

  // Fallback ticket prefix for branches and commits, e.g. CDC-1234/add-thing and
  // "[CDC-1234] feat: ...". Set it per repo instead: git config rak.project CDC
  project: null,

  // Per-command overrides (optional)
  commands: {
    review: "claude",
    // commit: "local",
    // pr: "local",
    // branch: "local",
   //slim: "claude",
    // rebase: "claude",
  },

  // Browser binary for `rak open` (e.g. "msedge", "chrome", "firefox")
  browser: "msedge",

  // Sites opened by `rak open` — customize URLs for your team
  open: {
    calendar: "https://calendar.google.com",
    jira: "https://YOUR_TEAM.atlassian.net/jira/software/projects",
    confluence: "https://YOUR_TEAM.atlassian.net/wiki",
    github: "https://github.com/YOUR_ORG",
  },

  // Local LLM settings (used when ai: "local")
  local: {
    url: "http://localhost:11434/api/chat",
    model: "deepseek-r1:14b",
  },
};
