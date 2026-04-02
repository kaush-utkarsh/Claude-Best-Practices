# BS Custom Training Lab — CLAUDE.md

This file tells Claude Code everything it needs to know about this project.
Read this before touching any file.

---

## What This Project Is

A hands-on AI session for a client's development team.
The client builds a Java Spring Boot e-commerce platform and uses an AI
orchestration layer called **Sidekick** that sits on top of Claude.

This repo contains all demo files, UI demos, and the Sidekick orchestrator
used during the session.

---

## Who You Are Helping

Junior developers who have just started using the project with no prior experience.
- Explain what code does in plain English before and after every change
- Never assume technical knowledge
- Always confirm what you built and why

---

## Project Structure

```
BS_custom-training-lab/
│
├── demos/
│   ├── ui/
│   │   ├── streaming-server.js     ← Express proxy server (run this first)
│   │   ├── streaming.html          ← Streaming UI demo
│   │   └── ai-generation.html      ← Generation UI demo
│   │
│   └── backend/
│       ├── shared/
│       │   ├── api-client.js       ← Anthropic API fetch wrapper (no SDK)
│       │   ├── mock-data.js        ← All mock data (Jira, Kibana, journey events)
│       │   └── mock-executors.js   ← Fake tool executors + TOOL_SCHEMAS
│       │
│       ├── demo1a-token.js         ← Token counting + model routing
│       ├── demo1b-caching.js       ← Prompt caching + output control + batching
│       ├── demo2a-security.js      ← ACL table + checkACL + break-it
│       ├── demo2b-security.js      ← Injection + rate limiting + audit + credentials
│       ├── demo3-agent.js          ← Agent core (tool loop, banners, evidence trail)
│       ├── demo3-runner.js         ← Agent runner (scenarios, break-it)
│       ├── demo4-issue-debugger.js ← Bug triage: symptom → evidence → fix → test
│       └── demo5-journey-tracer.js ← User journey instrumentation + anomaly detection
│
├── orchestrator/
│   └── sidekick.js                 ← THE REVEAL — do not open until minute 230
│
├── java-reference/
│   ├── JavaSwapPart1.java          ← JS vs Java: API call, tokens, tool loop, streaming
│   └── JavaSwapPart2.java          ← JS vs Java: caching, ACL, credentials
│
├── .env                            ← ANTHROPIC_API_KEY (never commit this)
├── CLAUDE.md                       ← this file
├── README.md                       ← setup instructions
└── package.json                    ← type: "module", dotenv dependency
```

---

## How to Run Things

### Backend demos
```bash
node demos/backend/demo1a-token.js
node demos/backend/demo1b-caching.js
node demos/backend/demo2a-security.js
node demos/backend/demo2b-security.js
node demos/backend/demo3-runner.js
node demos/backend/demo4-issue-debugger.js
node demos/backend/demo5-journey-tracer.js
```

### UI demos
```bash
node demos/ui/streaming-server.js
# Then open: http://localhost:3000           (streaming)
# Then open: http://localhost:3000/generation (generation)
```

### The reveal
```bash
node orchestrator/sidekick.js
```

---

## Language Rules — Never Break These

- **Backend demos** → Node.js, plain JS, no TypeScript
- **UI demos** → HTML + vanilla JS (served via Express)
- **Java reference** → comments only, not runnable
- **Never** suggest Python, TypeScript, or any other language for demos
- **Never** use the Anthropic SDK — all API calls use raw `fetch` / `node-fetch`
- **Always** use ES module syntax (`import`/`export`), never `require()`

---

## Architecture — Critical Concepts

### Control Plane vs Runtime
```
CONTROL PLANE (your code):        CLAUDE RUNTIME:
- Classifies intent               - Reads system + messages + tools
- Selects skill                   - Reasons about what tools to call
- Counts tokens                   - Returns tool_use OR final text
- Selects model                   → NEVER executes tools
- Checks ACL
- Executes tools
- Persists trace
→ NEVER reasons
```

### Token Counting Rule
Always count on Haiku. Never count on Opus.
```javascript
// CORRECT
POST /v1/messages/count_tokens
{ model: "claude-haiku-4-5", system, messages, tools }
```

### Prompt Caching Rule
`cache_control` goes on the content block — never top level.
```javascript
// CORRECT
system: [{ type: "text", text: "...", cache_control: { type: "ephemeral" } }]

// WRONG (silently fails)
{ cache_control: { type: "ephemeral" }, system: "..." }
```

### Tool Loop Pattern
```javascript
// Claude returns:
{ stop_reason: "tool_use", content: [{ type: "tool_use", name, input }] }

// You execute and return:
{ role: "user", content: [{ type: "tool_result", tool_use_id, content }] }

// Repeat until stop_reason === "end_turn"
```

---

## The Fictional App (Used Across All Demos)

```
App:      E-commerce platform (Spring Boot 3, Java 17)
Services: user-service, product-service, cart-service,
          order-service (has the bug), payment-service
The bug:  NullPointerException at OrderProcessor.java:142
          vendorPayload.getDeliveryWindow().toString() — no null check
          deliveryWindow became optional in vendor contract v2.4
Jira:     APP-123 — P1, OPEN
Session:  sess-7f3a9b — checkout failed, payment charged, no confirmation
```

---

## Models

```javascript
MODELS.HAIKU  = "claude-haiku-4-5"   // fast, cheap — counting, journey tracing
MODELS.SONNET = "claude-sonnet-4-5"  // balanced — most demos
MODELS.OPUS   = "claude-opus-4-5"    // powerful, expensive — show cost delta only
```

---

## What Claude Code Should Never Do

- Never open or modify `orchestrator/sidekick.js` unless explicitly asked
- Never commit or log the `.env` file or API key
- Never add TypeScript, Python, or external SDKs
- Never use `require()` — always `import`
- Never hardcode model name strings — always use `MODELS.HAIKU` etc.
- Never suggest running Java files — they are reference only

---

## Deferred Patch List

Items to fix in the cleanup round:
```
- api-client.js       → add prompt-caching beta header
- demo4               → update side-by-side confidence text
- demo5               → update break-it lesson text (Claude caught anomaly from metadata)
```

---

## Session Flow (for context)

```

 - Claude Code Intro        
 - UI: Streaming              → streaming.html
 - UI: AI Generation          → ai-generation.html
 - Break
 - Demo 1a: Token Routing     → demo1a-token.js
 - Demo 1b: Caching + Cost    → demo1b-caching.js
 - Demo 2a: ACL               → demo2a-security.js
 - Demo 2b: Hardening         → demo2b-security.js
 - Demo 3: Tool Loop          → demo3-runner.js
 - Break
 - Demo 4: Issue Debugger     → demo4-issue-debugger.js
 - Demo 5: Journey Tracer     → demo5-journey-tracer.js
 - Buffer / Q&A             
 - *** SIDEKICK REVEAL ***    → sidekick.js
 - Open Q&A + Monday plan   
```

---

## When Asked to Build Something New

1. Check if it conflicts with any decision in this file
2. Use Node.js plain JS for backend, HTML/JS for UI
3. Import from `./shared/api-client.js` and `./shared/mock-executors.js`
4. Follow the naming convention: `demo{number}{letter}-{topic}.js`
5. Explain what you built and why in plain English after every change
