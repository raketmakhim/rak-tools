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
   slim: "claude",
    // rebase: "claude",
  },

  // Local LLM settings (used when ai: "local")
  local: {
    url: "http://localhost:11434/api/chat",
    model: "qwen2.5-coder:7b",
  },
};
