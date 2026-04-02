# BS Custom Training Lab

Hands-on AI training session for developers building with the Claude API.

---

## What This Is

A set of runnable demos covering production-grade Claude API patterns.
Each demo is standalone, tested, and designed to run live in a terminal or browser.

The session builds toward a surprise reveal at the end — all five demos
unified inside a single orchestration system called **Sidekick**.

---

## Prerequisites

Make sure you have these installed before the session:

| Tool | Version | Check |
|---|---|---|
| Node.js | v18+ | `node --version` |
| npm | v8+ | `npm --version` |
| Git Bash (Windows) or Terminal (Mac) | any | — |
| VS Code | any | — |

---

## Setup

**1. Clone or download this repo**
```bash
cd ~/Documents
# If cloning:
git clone <repo-url> BS_custom-training-lab
cd BS_custom-training-lab
```

**2. Install dependencies**
```bash
npm install
```

**3. Create your `.env` file**
```bash
cp .env.example .env
# Then open .env and add your Anthropic API key
```

Or manually create `.env` in the root folder:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**4. Test your API key**
```bash
node demos/backend/shared/api-client.js
```

You should see:
```
✅ Token count: X tokens
✅ Response: 2 + 2 = 4.
```

If that works — you're ready.

---

## Running the Demos

### Backend demos — run in terminal
```bash
node demos/backend/demo1a-token.js
node demos/backend/demo1b-caching.js
node demos/backend/demo2a-security.js
node demos/backend/demo2b-security.js
node demos/backend/demo3-runner.js
node demos/backend/demo4-issue-debugger.js
node demos/backend/demo5-journey-tracer.js
```

### UI demos — run in browser
```bash
# Start the server first
node demos/ui/streaming-server.js

# Then open in your browser:
# Streaming demo:   http://localhost:3000
# Generation demo:  http://localhost:3000/generation
```

### The Sidekick reveal
```bash
node orchestrator/sidekick.js
```

> ⚠️ Don't run `sidekick.js` until the reveal moment in the session.

---

## What Each Demo Covers

| File | Topic | Key concept |
|---|---|---|
| `demo1a-token.js` | Token optimization | Count before you call. Route by complexity. |
| `demo1b-caching.js` | Cost optimization | Caching, output control, batching |
| `demo2a-security.js` | ACL | Skill-scoped permissions. Read vs write. |
| `demo2b-security.js` | Pipeline hardening | Injection, rate limiting, audit, credentials |
| `demo3-runner.js` | Agentic basics | Claude selects tools. You execute. |
| `demo4-issue-debugger.js` | Bug triage | Symptom → Evidence → Root cause → Fix |
| `demo5-journey-tracer.js` | Journey tracing | Instrument every step. Flag anomalies. |
| `streaming.html` | Streaming UI | Token-by-token rendering |
| `ai-generation.html` | AI generation | Components, copy, layouts on demand |
| `sidekick.js` | The reveal | All five demos in one system |

---

## Folder Structure

```
BS_custom-training-lab/
│
├── demos/
│   ├── ui/                          ← Browser demos
│   │   ├── streaming-server.js
│   │   ├── streaming.html
│   │   └── ai-generation.html
│   │
│   └── backend/                     ← Terminal demos
│       ├── shared/
│       │   ├── api-client.js
│       │   ├── mock-data.js
│       │   └── mock-executors.js
│       ├── demo1a-token.js
│       ├── demo1b-caching.js
│       ├── demo2a-security.js
│       ├── demo2b-security.js
│       ├── demo3-agent.js
│       ├── demo3-runner.js
│       ├── demo4-issue-debugger.js
│       └── demo5-journey-tracer.js
│
├── orchestrator/
│   └── sidekick.js                  ← The reveal
│
├── java-reference/
│   ├── JavaSwapPart1.java           ← JS vs Java reference (not runnable)
│   └── JavaSwapPart2.java
│
├── .env                             ← Your API key (never commit this)
├── CLAUDE.md                        ← Project standards for Claude Code
├── README.md                        ← This file
└── package.json
```

---

## Common Issues

**`ERR_MODULE_NOT_FOUND`**
Make sure `package.json` has `"type": "module"`. Run `npm install`.

**`Invalid API key`**
Check your `.env` file. Key should start with `sk-ant-`.
Make sure there are no spaces around the `=` sign.

**`ENOENT: no such file or directory`**
You're running the command from the wrong folder.
Always run from inside `BS_custom-training-lab/`.

**UI demos show blank page**
Make sure the server is running: `node demos/ui/streaming-server.js`
Then go to `http://localhost:3000` — not just `localhost`.

**Port 3000 already in use**
Another process is using port 3000.
Find and kill it: `npx kill-port 3000`

---

## Notes

- All backend demos use mock data — no real Jira, Kibana, or GitHub needed
- The fictional app is a Spring Boot e-commerce platform with a real bug baked in
- Java reference files are side-by-side comparisons only — they will not compile
- Never commit your `.env` file — it contains your API key

---

## The Core Framing

> *"You're already calling the Claude API.*
> *Today isn't about what Claude can do.*
> *It's about what your current implementation is missing —*
> *and by the end of today you'll have seen the production-grade version of every gap."*
