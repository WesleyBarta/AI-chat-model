// app.js - NexusMind main controller
import * as wasm from './wasm.js';
import * as ollama from './ollama.js';
import { CONFIG, AI_MODES, PROVIDERS } from './constants.js';

// ============ State ============
let db = null;
let chatHistory = [];
let currentMode = AI_MODES.ASSISTANT;
let settings = {
  voiceOutput: false,
  autoSend: true,
  showSentiment: true,
  maxLength: CONFIG.DEFAULT_MAX_TOKENS,
  temperature: CONFIG.DEFAULT_TEMPERATURE,
  provider: PROVIDERS.OLLAMA,
  ollamaModel: CONFIG.OLLAMA_MODEL,
  ollamaUrl: CONFIG.OLLAMA_URL
};

// ============ DOM ============
const $ = id => document.getElementById(id);
const dom = {
  chatContainer: $('chatContainer'),
  welcome: $('welcome'),
  messageInput: $('messageInput'),
  sendBtn: $('sendBtn'),
  voiceBtn: $('voiceBtn'),
  loadingOverlay: $('loadingOverlay'),
  loadingStatus: $('loadingStatus'),
  progressFill: $('progressFill'),
  wasmStatus: $('wasmStatus'),
  ollamaStatus: $('ollamaStatus'),
  modelStatus: $('modelStatus'),
  voiceStatus: $('voiceStatus'),
  settingsPanel: $('settingsPanel'),
  toast: $('toast')
};

// ============ IndexedDB ============
async function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(CONFIG.STORE_KB)) {
        d.createObjectStore(CONFIG.STORE_KB, { keyPath: 'id', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains(CONFIG.STORE_CHAT)) {
        d.createObjectStore(CONFIG.STORE_CHAT, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function dbAdd(store, data) {
  if (!db) return;
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).add(data);
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}

async function dbGetAll(store) {
  if (!db) return [];
  const tx = db.transaction(store, 'readonly');
  return new Promise((res, rej) => {
    const r = tx.objectStore(store).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function dbClear(store) {
  if (!db) return;
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).clear();
}

async function searchKB(query) {
  const all = await dbGetAll(CONFIG.STORE_KB);
  const q = query.toLowerCase();
  return all.filter(k => k.text.toLowerCase().includes(q));
}

async function saveMessage(role, content) {
  await dbAdd(CONFIG.STORE_CHAT, { role, content, timestamp: Date.now() });
}

async function loadChatHistory() {
  const msgs = await dbGetAll(CONFIG.STORE_CHAT);
  return msgs.sort((a, b) => a.timestamp - b.timestamp);
}

// ============ Progress ============
function setProgress(percent, status) {
  dom.progressFill.style.width = `${percent}%`;
  if (status) dom.loadingStatus.textContent = status;
}

// ============ UI ============
function addMessage(content, isUser, sentiment = null) {
  dom.welcome.style.display = 'none';
  const msg = document.createElement('div');
  msg.className = `message ${isUser ? 'user' : 'ai'}`;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let badge = '';
  if (!isUser && sentiment && settings.showSentiment) {
    const cls = sentiment.label === 'POSITIVE' ? 'sentiment-positive' : 'sentiment-negative';
    badge = `<span class="sentiment-badge ${cls}">${sentiment.label} ${(sentiment.score * 100).toFixed(0)}%</span>`;
  }
  msg.innerHTML = `
    <div class="message-avatar">${isUser ? '👤' : '🤖'}</div>
    <div class="message-content">${content}${badge}<div class="message-time">${time}</div></div>
  `;
  dom.chatContainer.appendChild(msg);
  dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
  return msg;
}

function createStreamingMessage() {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const msg = document.createElement('div');
  msg.className = 'message ai';
  msg.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-content"><span class="stream-content"></span><div class="message-time">${time}</div></div>
  `;
  dom.chatContainer.appendChild(msg);
  dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
  return msg;
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), 3000);
}

function autoResize() {
  dom.messageInput.style.height = 'auto';
  dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 120) + 'px';
}

// ============ Speech ============
let recognition = null;

function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { dom.voiceBtn.style.opacity = '0.5'; return; }
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.onresult = (e) => {
    dom.messageInput.value = Array.from(e.results).map(r => r[0].transcript).join('');
    autoResize();
    if (e.results[0].isFinal && settings.autoSend) send();
  };
  recognition.onerror = (e) => { if (e.error !== 'no-speech') showToast('Voice error: ' + e.error); stopRecording(); };
  recognition.onend = stopRecording;
}

function stopRecording() {
  dom.voiceBtn.classList.remove('recording');
  dom.voiceBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>';
}

function speakText(text) {
  const clean = text.replace(/[*_#\[\]]/g, '');
  speechSynthesis.speak(new SpeechSynthesisUtterance(clean));
}

// ============ Core: Send Message ============
async function send() {
  const text = dom.messageInput.value.trim();
  if (!text) return;

  if (settings.provider === PROVIDERS.WASM && !wasm.isReady()) {
    showToast('Wasm not ready — switch to Ollama');
    return;
  }

  dom.messageInput.value = '';
  autoResize();
  addMessage(text, true);

  chatHistory.push({ role: 'user', content: text });

  try {
    let result;

    if (currentMode === AI_MODES.ANALYZER) {
      result = await ollama.generateResponse(
        `Analyze the following text. State the overall sentiment (positive/negative/neutral) and explain why.\n\nText: ${text}`,
        chatHistory,
        settings,
        searchKB
      );
    } else if (currentMode === AI_MODES.SUMMARIZER) {
      result = await ollama.generateResponse(
        `Summarize the following text concisely in 2-3 sentences.\n\n${text}`,
        chatHistory,
        settings,
        searchKB
      );
    } else if (settings.provider === PROVIDERS.OLLAMA) {
      await streamOllama(text, searchKB);
      return;
    } else {
      result = await wasm.generateResponse(text, chatHistory, settings, searchKB);
    }

    addMessage(result, false);
    if (settings.voiceOutput) speakText(result);
    chatHistory.push({ role: 'assistant', content: result });
  } catch (err) {
    console.error(err);
    showToast('Error processing request');
  }
}

async function streamOllama(text, searchKB) {
  const msgEl = createStreamingMessage();
  const contentEl = msgEl.querySelector('.stream-content');
  let fullText = '';

  try {
    const stream = ollama.streamResponse(text, chatHistory, settings, searchKB);
    for await (const token of stream) {
      fullText += token;
      contentEl.textContent = fullText;
      dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
    }
    await saveMessage('assistant', fullText);
    chatHistory.push({ role: 'assistant', content: fullText });
    if (settings.voiceOutput) speakText(fullText);
  } catch (err) {
    console.error(err);
    showToast('Ollama error — falling back to Wasm');
    dom.chatContainer.removeChild(msgEl);
    if (wasm.isReady()) {
      const result = await wasm.generateResponse(text, chatHistory, settings, searchKB);
      const isObj = typeof result === 'object';
      const content = isObj ? result.text : result;
      addMessage(content, false, isObj ? result.sentiment : null);
      chatHistory.push({ role: 'assistant', content });
    } else {
      addMessage('Both Ollama and Wasm unavailable.', false);
    }
  }
}

// ============ Export ============
async function exportChat() {
  const data = { exportDate: new Date().toISOString(), messages: await loadChatHistory() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nexusmind-chat-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Chat exported');
}

// ============ Settings ============
function setupSettings() {
  // Toggles
  $('voiceOutputToggle').onclick = () => toggle('voiceOutputToggle', settings, 'voiceOutput', 'Voice');
  $('autoSendToggle').onclick = () => toggle('autoSendToggle', settings, 'autoSend', 'Auto-send');
  $('sentimentToggle').onclick = () => toggle('sentimentToggle', settings, 'showSentiment', 'Sentiment');

  // Sliders
  $('maxLengthSlider').oninput = (e) => {
    settings.maxLength = parseInt(e.target.value);
    $('maxLengthValue').textContent = `${settings.maxLength} tokens`;
  };
  $('temperatureSlider').oninput = (e) => {
    settings.temperature = parseInt(e.target.value) / 100;
    $('temperatureValue').textContent = settings.temperature.toFixed(2);
  };

  // Knowledge base
  $('kbAddBtn').onclick = async () => {
    const text = $('kbInput').value.trim();
    if (!text) { showToast('Enter some text first'); return; }
    await dbAdd(CONFIG.STORE_KB, { text, category: 'user', createdAt: Date.now() });
    $('kbInput').value = '';
    const all = await dbGetAll(CONFIG.STORE_KB);
    $('kbCount').textContent = all.length;
    showToast('Knowledge added');
  };

  // Provider buttons
  $('providerWasm')?.addEventListener('click', () => {
    if (!wasm.isReady()) { showToast('Wasm not ready'); return; }
    settings.provider = PROVIDERS.WASM;
    $('providerWasm').classList.add('active');
    $('providerOllama').classList.remove('active');
    showToast('Provider: Wasm');
  });

  $('providerOllama')?.addEventListener('click', async () => {
    const status = await ollama.checkOllamaStatus();
    if (!status.available) { showToast('Ollama offline'); return; }
    settings.provider = PROVIDERS.OLLAMA;
    $('providerOllama').classList.add('active');
    $('providerWasm').classList.remove('active');
    showToast(`Provider: Ollama (${status.models.length} models)`);
  });

  $('ollamaModelSelect')?.addEventListener('change', (e) => {
    settings.ollamaModel = e.target.value;
    showToast(`Model: ${settings.ollamaModel}`);
  });
}

function toggle(id, obj, key, label) {
  const el = $(id);
  if (!el) return;
  el.classList.toggle('active');
  obj[key] = el.classList.contains('active');
  showToast(`${label} ${obj[key] ? 'on' : 'off'}`);
}

// ============ Events ============
function bindEvents() {
  dom.messageInput.addEventListener('input', autoResize);
  dom.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && settings.autoSend) {
      e.preventDefault();
      send();
    }
  });
  dom.sendBtn.addEventListener('click', send);
  dom.voiceBtn.addEventListener('click', () => {
    if (!recognition) { showToast('Speech not supported'); return; }
    if (dom.voiceBtn.classList.contains('recording')) {
      recognition.stop();
    } else {
      recognition.start();
      dom.voiceBtn.classList.add('recording');
    }
  });

  // Mode buttons — filter by data-mode to avoid provider buttons
  document.querySelectorAll('.mbtn').forEach(btn => {
    if (!btn.dataset.mode) return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mbtn').forEach(b => {
        if (b.dataset.mode) b.classList.remove('active');
      });
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      showToast(`Mode: ${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)}`);
    });
  });

  // Header buttons
  $('clearBtn').onclick = async () => {
    await dbClear(CONFIG.STORE_CHAT);
    chatHistory = [];
    dom.chatContainer.innerHTML = '';
    dom.chatContainer.appendChild(dom.welcome);
    dom.welcome.style.display = 'flex';
    showToast('Chat cleared');
  };
  $('downloadBtn').onclick = exportChat;
  $('settingsBtn').onclick = () => dom.settingsPanel.classList.toggle('open');
  $('settingsClose').onclick = () => dom.settingsPanel.classList.remove('open');

  // Close panel on outside click
  document.addEventListener('click', (e) => {
    if (dom.settingsPanel.classList.contains('open') &&
        !dom.settingsPanel.contains(e.target) &&
        !$('settingsBtn').contains(e.target)) {
      dom.settingsPanel.classList.remove('open');
    }
  });
}

// ============ Init ============
async function init() {
  try {
    await initDB();
    chatHistory = await loadChatHistory();

    // Init Wasm only if using it — skip to avoid 404/401 errors
    if (settings.provider === PROVIDERS.WASM) {
      setProgress(20, 'Loading Wasm...');
      try {
        await wasm.init((p) => {
          if (p.status === 'progress') {
            setProgress(20 + (p.progress || 0) * 0.6, `Loading ${p.file || 'model'}...`);
          }
        });
        dom.wasmStatus.classList.add('ready');
        dom.modelStatus.classList.add('ready');
        dom.modelStatus.classList.remove('loading');
      } catch (e) {
        console.warn('Wasm init failed:', e.message);
        dom.modelStatus.classList.add('error');
      }
    }

    // Check Ollama
    setProgress(90, 'Checking Ollama...');
    const ollamaStatus = await ollama.checkOllamaStatus();
    if (ollamaStatus.available) {
      dom.ollamaStatus.classList.add('ready');
      if (settings.provider === PROVIDERS.OLLAMA) {
        ollama.warmUp(settings);
      }
    } else {
      dom.ollamaStatus.classList.add('error');
    }

    initSpeech();
    setProgress(100, 'Ready');
    dom.voiceStatus.classList.add('ready');
    setTimeout(() => dom.loadingOverlay.classList.add('hidden'), 500);

    // Render chat history or welcome
    if (chatHistory.length === 0) {
      // welcome already visible
    } else {
      dom.welcome.style.display = 'none';
      chatHistory.forEach(msg => {
        const el = document.createElement('div');
        el.className = `message ${msg.role === 'user' ? 'user' : 'ai'}`;
        const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        el.innerHTML = `<div class="message-avatar">${msg.role === 'user' ? '👤' : '🤖'}</div><div class="message-content">${msg.content}<div class="message-time">${time}</div></div>`;
        dom.chatContainer.appendChild(el);
      });
      dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
    }

    const kbCount = (await dbGetAll(CONFIG.STORE_KB)).length;
    if ($('kbCount')) $('kbCount').textContent = kbCount;

    bindEvents();
    setupSettings();
    dom.messageInput.focus();

  } catch (err) {
    console.error('Init error:', err);
    dom.loadingStatus.textContent = 'Error: ' + err.message;
    dom.loadingStatus.style.color = '#ff4444';
  }
}

export { init };
