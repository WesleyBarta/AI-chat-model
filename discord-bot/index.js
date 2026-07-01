// NexusBot - Discord bot powered by Ollama via NexusMind API
import { Client, GatewayIntentBits, Events } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ─── Config ───────────────────────────────────────────────────
const API_URL = process.env.NEXUSMIND_URL || 'http://localhost:3000/api/chat';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const BOT_NAME = process.env.BOT_NAME || 'NexusBot';
const PREFIX = process.env.PREFIX || '!';

// ─── State ────────────────────────────────────────────────────
let botEnabled = true;
let channelBlacklist = new Set();
let conversationHistory = {}; // { channelId: [{role, content}] }

// ─── Ready ────────────────────────────────────────────────────
client.once(Events.ClientReady, (c) => {
  console.log(`  ${BOT_NAME} logged in as ${c.user.tag}`);
  console.log(`  API: ${API_URL}`);
  console.log(`  Model: ${MODEL}`);
});

// ─── Message Handler ──────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  // Skip bots
  if (message.author.bot) return;

  // Skip blacklisted channels
  if (channelBlacklist.has(message.channelId)) return;

  // Check if bot is mentioned OR message starts with prefix
  const mentioned = message.mentions.has(client.user);
  const hasPrefix = message.content.trim().toLowerCase().startsWith(PREFIX.toLowerCase());

  if (!mentioned && !hasPrefix) return;

  // Remove mention or prefix to get the actual message
  let userMessage = message.content
    .replace(new RegExp(`<@${client.user.id}>`, 'g'), '')
    .replace(new RegExp(`^${PREFIX}\\s*`, 'i'), '')
    .trim();

  if (!userMessage) return;

  // Handle bot control commands
  if (userMessage.toLowerCase() === 'off') {
    botEnabled = false;
    await message.reply('Bot disabled for this channel.');
    return;
  }
  if (userMessage.toLowerCase() === 'on') {
    botEnabled = true;
    await message.reply('Bot enabled.');
    return;
  }
  if (userMessage.toLowerCase() === 'reset') {
    const cid = message.channelId;
    if (conversationHistory[cid]) {
      conversationHistory[cid] = [];
      await message.reply('Conversation history cleared.');
    } else {
      await message.reply('No history to clear.');
    }
    return;
  }

  if (!botEnabled) return;

  // Typing indicator
  await message.channel.sendTyping();

  // Build conversation history for this channel
  const history = conversationHistory[message.channelId] || [];

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          ...history,
          { role: 'user', content: userMessage }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.message?.content || 'No response from AI.';

    // Add to history
    history.push({ role: 'user', content: userMessage });
    history.push({ role: 'assistant', content: reply });
    // Keep last 20 messages
    if (history.length > 20) history.splice(0, history.length - 20);
    conversationHistory[message.channelId] = history;

    // Send reply (split if > 2000 chars)
    await sendMessage(message, reply);

  } catch (err) {
    console.error('Ollama error:', err);
    await message.reply('Error connecting to AI service.');
  }
});

// ─── Send Message (with chunking) ────────────────────────────
async function sendMessage(message, text) {
  const MAX = 2000;
  if (text.length <= MAX) {
    await message.reply(text);
    return;
  }

  // Split into chunks at line boundaries
  const chunks = text.match(/[\s\S]{1,1990}(?:\n|$)/g) || [text];
  for (const chunk of chunks) {
    await message.reply(chunk.trim());
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }
}

// ─── Login ────────────────────────────────────────────────────
if (!process.env.DISCORD_TOKEN) {
  console.error('  ERROR: DISCORD_TOKEN not set in .env');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);

// ─── Commands Help ────────────────────────────────────────────
// !on          — Enable bot
// !off         — Disable bot
// !reset       — Clear conversation history
// @NexusBot    — Same as ! (triggers bot)