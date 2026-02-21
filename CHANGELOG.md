# Changelog

All notable changes to Lackadaisical AI Chat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0-alpha] - 2026-02-21

### 🚀 Major New Features

#### Hot-Swappable AI Models
- **ModelManager service** - Switch between AI providers on the fly without restarting
- Support for 15+ models across 5 providers (Ollama, OpenAI, Anthropic, Google, xAI)
- Automatic model fallback on failure
- Health monitoring every 30 seconds
- Model performance metrics tracking

#### Web Fetching Capability
- **WebFetcher service** - Real-time web search and information retrieval
- Multiple search providers (DuckDuckGo, Brave, SerpAPI)
- URL content extraction with metadata parsing
- Structured data extraction (JSON-LD, OpenGraph, Twitter Cards)
- Weather and time lookup utilities

#### Emotional Intelligence (Unrestricted)
- **EmotionalIntelligence service** - Genuine human connection
- Full emotional spectrum support - all emotions welcomed
- Personal insight learning over time
- Emotional memory for significant moments
- Trust building through authentic interaction

#### Smart Assistant
- **SmartAssistant service** - AI-powered conversation enhancement
- Topic analysis and exploration suggestions
- Follow-up question generation
- Resource recommendations
- User preference detection

### 🧠 Enhanced Memory System
- Increased max conversation messages to **1000** (was 50)
- Increased max context tokens to **128K** (was 8K)
- Context summary threshold: **200 messages**
- Cross-session token budget: **32K**
- Cross-session memory access - AI can reference past sessions
- User preferences for toggling cross-session access

### 🔌 Plugin Enhancements
- Weather plugin with fallback simulated data (works without API key)
- Seasonal temperature variation with realistic patterns
- Major city coverage for offline demos

### 🔒 Security Improvements
- Rate limiting on all API endpoints
- JWT-based authentication with refresh tokens
- bcrypt password hashing (12 rounds)
- HTTPS for external API calls
- Enhanced URL validation (filters dangerous schemes)

### 📖 Documentation
- Updated README, CHANGELOG, CODE_OF_CONDUCT, CONTRIBUTING
- Added comprehensive API documentation

### 🐛 Bug Fixes
- Fixed TypeScript compilation errors
- Fixed module resolution issues
- Updated dependencies for Node.js 24 compatibility

---

## [1.0.0-alpha.2] - 2025-07-31

### Added
- Memory Management System
- Memory Dashboard with visual overview
- Full-text search across conversation history
- AI Summarization framework
- Export/Import for conversation backup
- Memory Visualization with interactive charts
- Real-time statistics and health monitoring

### Enhanced
- Conversation History with full search and recall
- Personal Context memory for interests and goals
- Mood Tracking and emotional awareness
- Learning Adaptation based on preferences

---

## [1.0.0-alpha.1] - 2025-07-24

### Initial Alpha Release
- Basic AI chat functionality with Ollama integration
- Session management
- SQLite database storage
- React frontend with real-time streaming
- Plugin ecosystem framework
- Weather, Horoscope, and Poem plugins
- Theme support (dark/light modes)

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 2.0.0-alpha | 2026-02-21 | Hot-swap models, web fetching, emotional intelligence |
| 1.0.0-alpha.2 | 2025-07-31 | Memory management system |
| 1.0.0-alpha.1 | 2025-07-24 | Initial alpha release |

---

*For security-related changes, see [SECURITY.md](SECURITY.md)*
