# 🧠 Lackadaisical AI Chat

> *Your AI homie that actually remembers sh*t and doesn't judge you.*

**Version:** 2.0.0 | **License:** MIT (Free af) | **Status:** 🔥 Production Ready

---

## What Is This?

**Lacky** is your personal AI companion that runs 100% on YOUR machine. No cloud BS, no data harvesting, no monthly fees. Just you and an AI friend who:

- 🧠 **Actually remembers** your conversations (up to 1000 messages, 128K tokens)
- 💝 **Doesn't judge** - Share anything without getting lectured
- 🔒 **Keeps secrets** - All data stays LOCAL on your device
- 🎭 **Has personality** - Not another boring corporate chatbot
- 🔄 **Hot-swaps models** - Switch AI providers on the fly
- 🌐 **Searches the web** - Real-time information when you need it

## Why Lacky Exists

We got tired of:
- AI assistants that treat you like a child
- Privacy policies longer than the Bible
- $20/month subscriptions for basic features
- "I cannot help with that" responses to normal questions
- Corporate AI that forgot you exist between sessions

So we built the opposite. **An AI friend that's actually yours.**

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ 
- [Ollama](https://ollama.ai/) (recommended for local AI)

### Install & Run

```bash
# Clone it
git clone https://github.com/Lackadaisical-Security/Lackadaisical-AI-Chat.git
cd Lackadaisical-AI-Chat

# Install deps
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Fire it up
npm run dev
```

**Windows users:** Just double-click `start-lackadaisical-ai.bat`

Open http://localhost:3000 and start chatting. That's it. 

---

## ✨ Features

### 🧠 Memory That Actually Works
- **1000 message context** - Remembers way more than you'd expect
- **128K token window** - Massive context for complex conversations
- **Cross-session memory** - References past conversations when relevant
- **Personal learning** - Learns your preferences, interests, triggers

### �� Emotional Intelligence (Unrestricted)
- **All emotions valid** - Anger, sadness, joy, fear - no minimizing
- **No judgment zone** - Share anything without lectures
- **Genuine support** - Real responses, not corporate deflection
- **Trust building** - Gets to know you over time

### 🔄 Hot-Swap AI Models
Switch between providers without restarting:
- **Ollama** (Local) - Free, private, your hardware
- **OpenAI** - GPT-4, GPT-3.5
- **Anthropic** - Claude 3 Opus, Sonnet
- **Google** - Gemini Pro, Flash
- **xAI** - Grok (uncensored vibes)

### 🌐 Web Fetching
- Real-time web search
- URL content extraction
- News lookups
- Weather and time info

### 🔌 Plugin System
- Weather updates
- Daily horoscopes
- Poem generator
- Easy to build your own

### 🎨 Clean UI
- React + Tailwind + DaisyUI
- Dark/light themes
- Real-time streaming responses
- Mobile-friendly

---

## 🛠️ API Endpoints

### Chat
```
POST /api/v1/chat          - Send message
GET  /api/v1/chat/stream   - Stream response (SSE)
```

### Models (Hot-Swap)
```
GET  /api/models           - List all models
POST /api/models/switch    - Switch active model
GET  /api/models/current   - Get current model
GET  /api/models/ollama/endpoints - List Ollama endpoints
POST /api/models/ollama/pull - Pull new model
```

### Memory & Sessions
```
GET  /api/chat/preferences - Get memory settings
PUT  /api/chat/preferences - Update settings
GET  /api/chat/sessions/summaries - Past session summaries
GET  /api/chat/search/all  - Search all sessions
```

### Full API docs: [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

---

## 🏗️ Architecture

```
lackadaisical-ai-chat/
├── backend/              # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── ai/           # AI provider adapters
│   │   ├── services/     # Core services
│   │   │   ├── AIService.ts
│   │   │   ├── ModelManager.ts      # Hot-swap models
│   │   │   ├── WebFetcher.ts        # Web search
│   │   │   ├── EmotionalIntelligence.ts
│   │   │   ├── EnhancedMemoryService.ts
│   │   │   └── ...
│   │   └── routes/       # API endpoints
│   └── package.json
├── frontend/             # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── services/     # API client
│   │   └── store/        # Zustand state
│   └── package.json
├── plugins/              # Plugin directory
└── database/             # SQLite storage
```

---

## 🔧 Configuration

Copy `env.example` to `.env` and configure:

```env
# AI Providers (optional - Ollama works without keys)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
XAI_API_KEY=...

# Ollama (default local)
OLLAMA_HOST=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama3.2:latest

# Server
BACKEND_PORT=3001
FRONTEND_PORT=3000

# Security
JWT_SECRET=change-this-in-production
```

---

## 🤝 Contributing

We're building something special here. Want in?

1. **Fork it**
2. **Build something cool**
3. **PR it**

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the full vibe check.

No corporate BS, no 47-step approval process. Just build cool stuff.

---

## 📜 License

**MIT** - Do whatever you want with it:
- ✅ Personal use
- ✅ Commercial use
- ✅ Modify it
- ✅ Distribute it
- ✅ Make money with it

Just don't be evil. And maybe star the repo if you like it. ⭐

---

## ⚠️ Legal Stuff

- **US Export Controls apply** - See [SECURITY.md](SECURITY.md)
- **Not for surveillance/military use** - Don't be that person
- **"As is" without warranty** - We're not responsible if it becomes sentient

---

## 🔗 Links

- 📖 [Full Documentation](DOCUMENTATION.md)
- 🔧 [Installation Guide](INSTALL.md)
- 🐛 [Troubleshooting](TROUBLESHOOTING.md)
- 📋 [Changelog](CHANGELOG.md)
- 🔒 [Security Policy](SECURITY.md)
- 💬 [Discord](https://discord.gg/nyyXufEpeE)

---

## 🙏 Credits

Built by [Lackadaisical Security](https://lackadaisical-security.com) and contributors who believe AI should be:
- **Free** (as in freedom AND beer)
- **Private** (your data, your device)
- **Uncensored** (within reason, don't be weird)
- **Human** (genuine connection > corporate polish)

---

**Now stop reading and go chat with your new AI homie.** 🚀

```
"In a world of corporate AI overlords, be the open-source rebel."
```
