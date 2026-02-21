# 🛠️ Contributing to Lackadaisical AI Chat

## yo, welcome to the sauce 🍝

So you wanna contribute to Lacky? Hell yeah. Pull up a chair, grab a drink, and let's build some cool sh*t together.

## tl;dr Quick Start

```bash
# Fork it, clone it, build it
git clone https://github.com/YOU/lackadaisical-ai-chat.git
cd lackadaisical-ai-chat
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Run it
npm run dev

# Break it (intentionally), fix it, ship it
```

## 🎯 What We Need Rn

### 🔥 Hot Priority
- Performance tuning (make it go brrr)
- Mobile responsiveness
- More AI provider integrations
- Plugin ecosystem expansion
- Better error handling

### 🌶️ Spicy Projects
- Voice chat (talk to your AI homie)
- Image generation integration
- Custom personality creation UI
- Cross-platform desktop app

### 📝 Always Welcome
- Bug fixes (squash those b*stards)
- Documentation improvements
- Tests (yes, really)
- Plugin development
- Translations (make Lacky multilingual)

## 🛠️ Dev Setup

### Requirements
- Node.js 18+ (we're not running Internet Explorer here)
- npm or pnpm (yarn if you're fancy)
- Git (obviously)
- A brain (optional but recommended)
- Coffee/energy drink (highly recommended)

### Getting Started

1. **Fork it** - Click that fork button like you mean it

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/lackadaisical-ai-chat.git
   cd lackadaisical-ai-chat
   ```

3. **Install the goods**
   ```bash
   npm install              # Root deps
   cd backend && npm install && cd ..
   cd frontend && npm install && cd ..
   ```

4. **Set up your env**
   ```bash
   cp env.example .env
   # Edit .env with your API keys if you have 'em
   ```

5. **Fire it up**
   ```bash
   npm run dev   # Both frontend + backend
   
   # Or separately:
   cd backend && npm run dev
   cd frontend && npm run dev
   ```

6. **Verify the vibes**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001
   - If it works, you're golden 🏆

## 📁 Project Structure (The Map)

```
lackadaisical-ai-chat/
├── backend/                  # Node.js/Express server
│   ├── src/
│   │   ├── ai/              # AI provider adapters
│   │   ├── config/          # Config stuff
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   └── utils/           # Helper functions
│   └── package.json
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # API client stuff
│   │   ├── store/           # Zustand state
│   │   └── types/           # TypeScript types
│   └── package.json
├── plugins/                  # Plugin directory
├── database/                 # SQLite stuff
└── scripts/                  # Utility scripts
```

## 💻 Coding Standards

### The Vibe Check

**DO:**
- Write code that a sleep-deprived dev at 3am can understand
- Add comments for weird sh*t (we all do weird sh*t sometimes)
- Use TypeScript properly (types exist for a reason)
- Test your code (at least manually, we won't judge)
- Write descriptive variable names (`userMessage` not `um`)

**DON'T:**
- Write spaghetti code (unless it's a pasta plugin)
- Commit secrets (API keys, passwords, etc.) - seriously DON'T
- Break existing functionality without good reason
- Over-engineer simple stuff
- Be a 10x jerk (we prefer 1x nice devs)

### TypeScript Guidelines

```typescript
// GOOD: Clear, typed, readable
interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  sender: 'user' | 'assistant';
}

async function sendMessage(message: ChatMessage): Promise<Response> {
  // Implementation that makes sense
}

// BAD: wtf is this
const x = async (m: any) => await fetch('/api', {body: JSON.stringify(m)})
```

### React Components

```tsx
// GOOD: Functional, typed, hooks
interface ChatProps {
  sessionId: string;
}

export const Chat: React.FC<ChatProps> = ({ sessionId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  
  return (
    <div className="chat-container">
      {/* Clean JSX */}
    </div>
  );
};

// BAD: Class components in 2025? Really?
```

## 🔀 Git Workflow

### Branch Naming
- `feat/cool-new-thing` - New features
- `fix/that-annoying-bug` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/make-it-not-suck` - Refactoring
- `test/add-missing-tests` - Tests

### Commit Messages

We use conventional commits because we're professionals (sometimes):

```
feat: add voice chat support
fix: resolve memory leak in conversation service
docs: update README with new API endpoints
refactor: clean up the spaghetti in AIService
test: add tests for emotional intelligence module
chore: update dependencies
```

### PR Process

1. **Create your branch**
   ```bash
   git checkout -b feat/your-cool-feature
   ```

2. **Make your changes**
   - Write code
   - Test it
   - Commit often with good messages

3. **Push it**
   ```bash
   git push origin feat/your-cool-feature
   ```

4. **Open PR**
   - Clear title and description
   - Link related issues
   - Add screenshots for UI changes
   - Request review

5. **Address feedback**
   - Don't take it personally
   - Learn and improve
   - Push updates

6. **Get merged** 🎉

## 🔌 Plugin Development

Want to extend Lacky? Let's go!

### Plugin Structure
```
plugins/
├── your-plugin/
│   ├── index.ts      # Main entry point
│   ├── package.json  # Metadata
│   └── README.md     # How to use it
```

### Basic Plugin
```typescript
export default {
  name: 'your-sick-plugin',
  version: '1.0.0',
  description: 'Does cool stuff',
  
  async init(config: any) {
    console.log('Plugin loaded, let\'s gooo');
  },
  
  async execute(input: any, context: any) {
    // Your magic here
    return { result: 'something cool' };
  },
  
  async cleanup() {
    console.log('Cleaning up, peace out');
  }
};
```

### Plugin Guidelines
- Don't break user privacy (that's sus)
- Handle errors gracefully
- Document your plugin properly
- Test it before shipping

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.ts

# Watch mode (for dev)
npm run test:watch

# Coverage (flex on your test coverage)
npm run test:coverage
```

### Writing Tests

```typescript
describe('MemoryService', () => {
  it('should remember things like a good AI friend', async () => {
    const memory = await memoryService.save('user123', 'important stuff');
    const recalled = await memoryService.recall('user123');
    
    expect(recalled).toContain('important stuff');
  });
  
  it('should not forget unless asked', async () => {
    // Test implementation
  });
});
```

## 🤝 Community Vibes

### Where to Find Us
- **GitHub Issues** - Bugs and feature requests
- **Discord** - Real-time chat with the crew
- **GitHub Discussions** - Longer convos and ideas

### Getting Help
1. Search existing issues first
2. Check the docs (README, TROUBLESHOOTING, etc.)
3. Ask in Discord (we don't bite)
4. Create an issue if all else fails

### Recognition

We appreciate contributors! You'll get:
- Your name in CONTRIBUTORS.md
- Shoutout in release notes
- Eternal glory in the git history
- Maybe some Discord role drip 👀

## 📜 Legal Stuff (Boring But Important)

By contributing, you agree that your code will be under the MIT license. You also confirm you have the right to contribute the code (don't steal code, that's not cool).

## 🎮 Final Boss Tips

1. **Start small** - Fix a bug or typo. Get familiar.
2. **Ask questions** - No one knows everything.
3. **Be patient** - Reviews take time.
4. **Have fun** - This is a passion project, not a corporate job.
5. **Ship it** - Done > Perfect.

---

## Quick Links

- 📖 [Main README](README.md)
- 🔧 [Install Guide](INSTALL.md)
- 🐛 [Troubleshooting](TROUBLESHOOTING.md)
- 🎮 [Code of Conduct](CODE_OF_CONDUCT.md)
- 💬 [Discord](https://discord.gg/nyyXufEpeE)

---

**Now go build something awesome.** The PR button is right there. We're waiting. 🚀

*"In a world of closed-source AI, be the open-source hero."* 

Last Updated: February 2026
