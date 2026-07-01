// constants.js - Centralized configuration
export const CONFIG = {
  // Server
  SERVER_PORT: 3000,

  // Ollama
  OLLAMA_MODEL: 'llama3.2',
  OLLAMA_TIMEOUT: 90_000,

  // Wasm defaults
  WASM_MODEL: 'Xenova/smollm2-360M',
  WASM_FALLBACK_MODEL: 'Xenova/gpt2',

  // AI settings
  DEFAULT_MAX_TOKENS: 500,
  DEFAULT_TEMPERATURE: 0.5,
  CONTEXT_MESSAGES: 8,

  // DB
  DB_NAME: 'NexusMindDB',
  DB_VERSION: 1,
  STORE_KB: 'knowledge',
  STORE_CHAT: 'chat'
};

export const SYSTEM_PROMPT = `You are Nexus, an intelligent and helpful AI assistant. Follow these rules:
1. Be CLEAR and PRECISE — avoid filler words
2. Be CONCISE but COMPLETE — answer directly
3. Use STRUCTURE — bullet points or numbered lists when helpful
4. Be ACCURATE — admit uncertainty instead of guessing
5. Start responses directly — no "Sure!", "Of course!", etc.`;

export const AI_MODES = {
  ASSISTANT: 'assistant',
  ANALYZER: 'analyzer',
  SUMMARIZER: 'summarizer'
};

export const PROVIDERS = {
  WASM: 'wasm',
  OLLAMA: 'ollama'
};
