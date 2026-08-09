export default {
  // "claude" (default) or "local"
  ai: "local",

  // Local LLM settings (used when ai: "local")
  local: {
    url: "http://localhost:11434/api/chat",
    model: "qwen2.5-coder:14b",
  },
};
