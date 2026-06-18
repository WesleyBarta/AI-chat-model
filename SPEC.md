# NexusMind - Offline AI Chatbot

## Project Overview
- **Project Name**: NexusMind
- **Type**: Single-page AI chatbot (offline-capable)
- **Core Functionality**: Client-side AI chat with Ollama (local LLM) and transformers.js (Wasm)
- **Target Users**: Users needing offline-capable AI assistance

## Project Structure

```
/f/py
├── public/
│   └── index.html          # UI (HTML + CSS, no inline JS)
├── src/
│   ├── app.js              # Main controller (UI, events, state)
│   ├── ollama.js           # Ollama API client (streaming + non-streaming)
│   ├── wasm.js             # transformers.js Wasm AI
│   └── constants.js        # Centralized config & constants
├── server.mjs              # HTTP server (port 3000)
├── package.json
└── SPEC.md
```

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| UI | Vanilla HTML/CSS | No framework, fast load |
| AI (Primary) | Ollama + local LLM | Smart, offline, streaming |
| AI (Fallback) | transformers.js Wasm | CDN-cached, offline-capable |
| Storage | IndexedDB | Chat history + knowledge base |
| Speech | Web Speech API | Voice input/output |

## AI Configuration

### Ollama (Default)
- **Endpoint**: `http://localhost:11434`
- **Default Model**: `llama3.2`
- **Available Models**: llama3.2, llama3.1, mistral, codellama, phi3, qwen2.5
- **Features**: Streaming tokens, system prompt, 8-message context

### Wasm (Fallback)
- **Primary**: `Xenova/smollm2-360M`
- **Fallback**: `Xenova/gpt2`
- **Features**: Sentiment analysis, QA, summarization

## Features

- **Streaming responses** — tokens arrive in real-time
- **Knowledge base** — add facts for RAG-style answers
- **Voice input/output** — Web Speech API
- **Chat history** — persisted in IndexedDB
- **Export chat** — download as JSON
- **Mode selector** — Assistant / Analyzer / Summarizer

## Running

```bash
node server.mjs
# → http://localhost:3000

# Ollama (for smart offline model)
ollama serve
ollama pull llama3.2   # one-time
```
