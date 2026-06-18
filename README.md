# NexusMind 🤖

**Offline AI chatbot** powered by Ollama (local LLM) and transformers.js (WebAssembly). No cloud, no tracking, 100% private.

![Status](https://img.shields.io/badge/status-active-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![GitHub](https://img.shields.io/badge/GitHub-WesleyBarta/AI--chat--model-green)

---

## ✨ Features

- **🧠 Smart Local AI** — Runs `llama3.2` entirely on your machine via Ollama
- **⚡ Streaming Responses** — Tokens appear in real-time as AI generates
- **📚 Knowledge Base** — Add facts for contextual, accurate answers
- **🎤 Voice I/O** — Speak to the bot using Web Speech API
- **💾 Chat History** — Persisted locally in IndexedDB
- **🔄 Wasm Fallback** — Works offline with transformers.js if Ollama is unavailable
- **🎨 Cyberpunk UI** — Neon glow aesthetic with JetBrains Mono + Orbitron fonts

---

## 🚀 Quick Start

### 1. Install Ollama

```bash
# Windows
winget install Ollama.Ollama

# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Pull a Model

```bash
ollama pull llama3.2    # ~2GB, recommended
ollama pull mistral     # ~4GB
ollama pull phi3        # ~2GB
```

### 3. Start Ollama

```bash
ollama serve
```

### 4. Run the App

```bash
cd f:\py
node server.mjs
```

Open **http://localhost:3000** in your browser.

---

## ⚙️ Configuration

### Change Model

Settings → Ollama Model → Select `mistral`, `phi3`, `codellama`, etc.

### Change Endpoint

```js
// src/constants.js
export const CONFIG = {
  OLLAMA_URL: 'http://localhost:11434',
  OLLAMA_MODEL: 'llama3.2'
};
```

### Adjust AI Parameters

| Setting | Default | Description |
|---------|---------|-------------|
| Max Tokens | 500 | Max response length |
| Temperature | 0.5 | Creativity (lower = focused) |
| Context | 8 msgs | Chat history sent to AI |

---

## 📁 Project Structure

```
f:\py
├── public/
│   └── index.html          # UI (HTML + CSS)
├── src/
│   ├── app.js              # Main controller
│   ├── ollama.js            # Ollama API client
│   ├── wasm.js             # transformers.js Wasm AI
│   └── constants.js        # Centralized config
├── server.mjs              # HTTP server (port 3000)
├── package.json
├── SPEC.md                 # Specification
└── README.md
```

---

## 🔧 API Reference

### Ollama (Primary)

- **Endpoint**: `POST http://localhost:11434/api/chat`
- **Models**: Any GGUF model pulled via `ollama pull`
- **Streaming**: SSE-based token streaming

### Wasm (Fallback)

- **Engine**: transformers.js v2.17.1 (CDN)
- **Models**: `Xenova/smollm2-360M` or `Xenova/gpt2`
- **Mode**: Browser Wasm/WebGPU

---

## 🗂️ Knowledge Base

The bot uses a simple **RAG-style** knowledge base:

1. Go to **Settings → Add Knowledge**
2. Paste facts, code snippets, or any text
3. Bot automatically retrieves relevant entries per query

Top 3 most relevant KB entries are injected into the system prompt for accurate answers.

---

## 🎯 AI Modes

| Mode | Description |
|------|-------------|
| **Assistant** | General conversation with KB context |
| **Analyzer** | Sentiment analysis of text |
| **Summarizer** | Concise summaries of long text |

---

## 🔒 Privacy

- **Zero data sent to external servers** (except CDN model cache on first load)
- Ollama runs 100% locally
- Chat history stored in your browser's IndexedDB
- No analytics, no tracking, no telemetry

---

## 📋 Requirements

- **Node.js** 18+ (for running the server)
- **Ollama** (for local LLM)
- **Modern browser** (Chrome, Firefox, Edge)
- **RAM**: 4GB+ (for Ollama models)

---

## 🛠️ Troubleshooting

### "Ollama offline"
```bash
ollama serve
```

### "Wasm not ready"
Switch to **Ollama** provider in Settings.

### Slow responses
- Use a smaller model: `ollama pull phi3`
- Lower Max Tokens in Settings

---

## 📄 License

MIT — Use freely for personal and commercial projects.
