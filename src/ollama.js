// ollama.js - Ollama API client (via local proxy server)
import { CONFIG, SYSTEM_PROMPT } from './constants.js';

const API_BASE = `http://localhost:${CONFIG.SERVER_PORT || 3000}/api`;

// Check if Ollama is available via proxy
export async function checkOllamaStatus() {
  try {
    const res = await fetch(`${API_BASE}/status`, {
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) return { available: false, models: [] };
    const data = await res.json();
    return { available: data.available, models: data.models || [] };
  } catch {
    return { available: false, models: [] };
  }
}

// Build system prompt with optional knowledge base context
function buildSystemPrompt(kbContext) {
  if (!kbContext) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\n## Knowledge Base\nYou have access to the following facts. Use them to answer questions accurately.\n\n${kbContext}`;
}

// Build messages array with system prompt + chat history + KB
function buildMessages(userMessage, chatHistory, kbContext) {
  const history = chatHistory.slice(-CONFIG.CONTEXT_MESSAGES).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }));

  return [
    { role: 'system', content: buildSystemPrompt(kbContext) },
    ...history,
    { role: 'user', content: userMessage }
  ];
}

// Non-streaming request
export async function generateResponse(userMessage, chatHistory, settings, searchKB) {
  const kbContext = await buildKBContext(searchKB, userMessage);
  const messages = buildMessages(userMessage, chatHistory, kbContext);

  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.ollamaModel || CONFIG.OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature: clampTemp(settings.temperature),
        num_predict: Math.min(settings.maxLength || CONFIG.DEFAULT_MAX_TOKENS, 500),
        top_k: 40,
        top_p: 0.9,
        repeat_penalty: 1.8
      }
    }),
    signal: AbortSignal.timeout(CONFIG.OLLAMA_TIMEOUT)
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.message?.content || '';
}

// Streaming request — yields tokens as they arrive
export async function* streamResponse(userMessage, chatHistory, settings, searchKB) {
  const kbContext = await buildKBContext(searchKB, userMessage);
  const messages = buildMessages(userMessage, chatHistory, kbContext);

  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.ollamaModel || CONFIG.OLLAMA_MODEL,
      messages,
      stream: true,
      options: {
        temperature: clampTemp(settings.temperature),
        num_predict: Math.min(settings.maxLength || CONFIG.DEFAULT_MAX_TOKENS, 500),
        top_k: 40,
        top_p: 0.9,
        repeat_penalty: 1.8
      }
    })
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.message?.content) {
          fullText += data.message.content;
          yield data.message.content;
        }
      } catch {}
    }
  }
}

// Warm-up — lightweight ping to load model into memory
export async function warmUp(settings) {
  try {
    await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.ollamaModel || CONFIG.OLLAMA_MODEL,
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        options: { num_predict: 2 }
      }),
      signal: AbortSignal.timeout(5000)
    });
  } catch {}
}

// ─── Internal helpers ──────────────────────────────────────────

async function buildKBContext(searchKB, query) {
  if (!searchKB) return null;
  try {
    const results = await searchKB(query);
    if (!results.length) return null;
    const facts = results.slice(0, 3).map(r => `- ${r.text}`).join('\n');
    return `Relevant facts:\n${facts}`;
  } catch {
    return null;
  }
}

function clampTemp(temp) {
  return Math.min(Math.max(temp || 0.5, 0.3), 0.8);
}