// Template for rak.config.mjs (gitignored). Copied into place on first run.
// Edit the copy, not this. Details: README "Config".
export default {
  // "claude" or "local". Order: RAK_AI -> commands below -> this.
  ai: "claude",

  // Ticket prefix fallback. Prefer per repo: git config rak.project CDC
  project: null,

  commands: {
    review: "claude",
    slim: "claude",
    // commit: "local",
    // pr: "local",
    // branch: "local",
    // rebase: "claude",
  },

  // Fallback for sites below with no browser of their own.
  browser: "msedge",

  // `rak open`. Per-site browser, so each SSO lands where it is signed in.
  // Sites sharing a browser open as tabs in one window.
  // Shorthand: a plain "https://..." uses `browser` above.
  open: {
    calendar: { url: "https://calendar.google.com/calendar/u/0/r/week", browser: "chrome" },
    gmail: { url: "https://mail.google.com/mail/u/0/#inbox", browser: "chrome" },
    jira: { url: "https://your-org.atlassian.net/jira/software/c/projects/YOURPROJECT/boards/1", browser: "msedge" },
    confluence: { url: "https://your-org.atlassian.net/wiki/spaces/yourspace/overview", browser: "msedge" },
    github: { url: "https://github.com/your-org/your-repo", browser: "msedge" },
  },

  // Ollama, for the "local" backend. Override: RAK_AI_URL, RAK_AI_MODEL
  local: {
    url: "http://localhost:11434/api/chat",
    model: "qwen2.5-coder:7b",
  },
};
