export default {
  // Default backend: "claude" or "local"
  ai: "local",

  // Per-command overrides (optional)
  commands: {
    review: "claude",
    // commit: "local",
    // pr: "local",
    // branch: "local",
   slim: "claude",
    // rebase: "claude",
  },

  // Local LLM settings (used when ai: "local")
  local: {
    url: "http://localhost:11434/api/chat",
    model: "qwen2.5-coder:14b",
  },
};
