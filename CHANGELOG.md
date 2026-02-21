# 📋 Changelog

All notable changes to Lackadaisical AI Chat. We actually update this thing.

---

## [2.0.0] - February 2026 🔥

### tl;dr
Major upgrade. Hot-swap models, web search, emotional intelligence that doesn't suck, and docs you might actually read.

### 🆕 Added

#### Hot-Swappable Model Management
- **ModelManager service** - Switch AI models without restarting
- **15+ pre-configured models** across 5 providers
- **Automatic fallback** - If one model fails, we try another
- **Health monitoring** - 30-second health checks
- **Model metrics** - Track performance, latency, success rates

#### Ollama Cloud Integration
- **Multi-endpoint support** - Local + cloud Ollama instances
- **Load balancing** - Distribute load across endpoints
- **Pull models via API** - `POST /api/models/ollama/pull`
- **Endpoint health tracking** - Know what's up and what's down

#### Web Fetching
- **WebFetcher service** - Real-time web search
- **Multiple providers** - DuckDuckGo (free), Brave, SerpAPI
- **Content extraction** - Pull content from URLs
- **Metadata parsing** - JSON-LD, OpenGraph, Twitter Cards
- **Weather & time lookups** - Built-in utilities

#### Smart Assistant
- **Topic analysis** - Understands what you're talking about
- **Follow-up suggestions** - Contextual next questions
- **User preference detection** - Learns how you like to communicate
- **Conversation insights** - Patterns and analytics

#### Emotional Intelligence (The Good Kind)
- **Full emotional spectrum** - ALL emotions valid, no minimizing
- **Personal learning** - Remembers your triggers, joys, struggles
- **Emotional memory** - Stores significant moments
- **Genuine support** - No corporate BS responses
- **Trust building** - Deepens connection over time

#### New API Endpoints
```
GET  /api/models              - List all models
POST /api/models/switch       - Hot-swap model
GET  /api/models/current      - Current active model
GET  /api/models/ollama/endpoints - List Ollama endpoints
POST /api/models/ollama/endpoints - Add endpoint
POST /api/models/ollama/pull  - Pull model to endpoint
POST /api/models/select-best  - Auto-select best model
```

### 🔧 Changed

#### System Prompt Overhaul
- Lacky is now a **genuine friend**, not a corporate assistant
- No more "I cannot help with that" for normal stuff
- Emotional support that actually supports
- Remembers you're a person, not a ticket number

#### Documentation
- **CODE_OF_CONDUCT.md** - Real talk, not HR speak
- **CONTRIBUTING.md** - Actually readable dev guide
- **README.md** - Straight to the point

### 🐛 Fixed
- HTTP → HTTPS for worldtimeapi calls
- Better URL validation (filters dangerous schemes)
- TypeScript compilation issues in new services

### 🔒 Security
- Enhanced URL filtering (javascript:, data:, vbscript:, file:)
- Secure API endpoints for model management
- No sensitive data in logs

---

## [1.0.0] - July 2025 🚀

### Initial Release

The OG drop. Everything that makes Lacky, Lacky.

#### Core Features
- **AI Companion** with persistent memory
- **5 AI providers** - Ollama, OpenAI, Anthropic, Google, xAI
- **Local-first** - Your data stays yours
- **SQLite database** - Everything stored locally
- **Session management** - Multiple conversation threads

#### Memory System
- **1000 message limit** - Generous context
- **128K token window** - Massive for most models
- **Cross-session recall** - Reference past conversations
- **Memory search** - Find anything you discussed

#### Authentication
- **JWT tokens** - Access + refresh
- **Rate limiting** - 5 attempts per 15 min
- **bcrypt hashing** - 12 rounds

#### Plugins
- **Weather** - Current conditions + forecasts
- **Horoscope** - Daily zodiac stuff
- **Poem of the Day** - Because why not

#### Interface
- **React 18 + Vite** - Fast and modern
- **Tailwind + DaisyUI** - Clean styling
- **Real-time streaming** - Watch responses generate
- **Mobile responsive** - Works everywhere

---

## Philosophy

We believe AI companions should be:

1. **Free** - Not $20/month for basic features
2. **Private** - Your data, your device
3. **Uncensored** - Reasonable freedom, not anarchy
4. **Human** - Genuine connection over corporate polish
5. **Open** - See the code, change the code

---

## Upgrade Notes

### From 1.x to 2.0

```bash
# Pull latest
git pull

# Reinstall deps (new packages added)
cd backend && npm install && cd ..

# Run it
npm run dev
```

New tables auto-migrate. Your data is safe.

---

## Coming Soon

- [ ] Voice chat (talk to your AI homie)
- [ ] Mobile app (iOS/Android)
- [ ] Plugin marketplace
- [ ] Image generation integration
- [ ] Multi-user support

---

*"Every commit brings us closer to AI that actually respects you."*
