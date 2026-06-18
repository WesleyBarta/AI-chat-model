// wasm.js - transformers.js Wasm AI engine
import { CONFIG } from './constants.js';

let pipeline, sentimentPipeline, qaPipeline;

const PERSONALITY = `You are Nexus, a friendly and helpful AI assistant. Be concise, accurate, and use structure when helpful.`;

// Suppress ONNX warnings
const _origWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.toString().includes('onnxruntime')) return;
  _origWarn.apply(console, args);
};

export async function init(onProgress) {
  const { pipeline: p } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1');

  const cb = (progress) => {
    if (progress.status === 'progress' && onProgress) {
      onProgress(progress);
    }
  };

  try {
    pipeline = await p('text-generation', CONFIG.WASM_MODEL, { progress_callback: cb });
  } catch {
    pipeline = await p('text-generation', CONFIG.WASM_FALLBACK_MODEL, { progress_callback: cb });
  }

  sentimentPipeline = await p('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2', { progress_callback: cb });
  qaPipeline = await p('question-answering', 'Xenova/distilbert-base-cased-distilled-squad', { progress_callback: cb });
}

export function isReady() {
  return pipeline != null;
}

export async function generateResponse(userMessage, chatHistory, settings, searchKB) {
  // Check knowledge base first
  if (searchKB) {
    const kbResults = await searchKB(userMessage);
    if (kbResults.length > 0) {
      const context = kbResults.slice(0, 3).map(k => k.text).join('\n---\n');
      return await answerQuestion(userMessage, context);
    }
  }

  let context = PERSONALITY + '\n\n';
  context += chatHistory.slice(-CONFIG.CONTEXT_MESSAGES).map(m => `${m.role}: ${m.content}`).join('\n');
  context += `\nuser: ${userMessage}\nNexus:`;

  const result = await pipeline(context, {
    max_new_tokens: Math.min(settings.maxLength || CONFIG.DEFAULT_MAX_TOKENS, 150),
    temperature: settings.temperature || CONFIG.DEFAULT_TEMPERATURE,
    do_sample: true,
    top_k: 40,
    top_p: 0.9,
    repetition_penalty: 1.1
  });

  let response = result[0].generated_text;
  if (response.includes(userMessage)) {
    response = response.split(userMessage).slice(1).join(userMessage);
  }
  return response.trim() || "I couldn't generate a response.";
}

export async function analyzeSentiment(text) {
  const result = await sentimentPipeline(text);
  const s = result[0];
  return {
    text: `**Sentiment Analysis:**\n\n${s.label} (${(s.score * 100).toFixed(1)}% confidence)`,
    sentiment: s
  };
}

export async function summarizeText(text, settings) {
  if (text.length < 50) return "Text too short to summarize.";
  const prompt = `Summarize concisely:\n\n${text}\n\nSummary:`;
  const result = await pipeline(prompt, {
    max_new_tokens: Math.min(settings.maxLength || CONFIG.DEFAULT_MAX_TOKENS, 150),
    temperature: 0.5,
    do_sample: true
  });
  let summary = result[0].generated_text;
  if (summary.includes(prompt)) summary = summary.split(prompt).slice(1).join(prompt);
  return `**Summary:**\n\n${summary.trim()}`;
}

export async function answerQuestion(question, context) {
  const result = await qaPipeline({ question, context });
  return `**Answer:**\n\n${result.answer}\n\n**Confidence:** ${(result.score * 100).toFixed(1)}%`;
}
