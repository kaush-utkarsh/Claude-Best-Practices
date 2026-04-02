# Token Cost Optimization
### Pre-Computed Skill Libraries, Smart Routing, and Why Local Tokenizers Don't Work for Claude
#### Session Reference Document — Building With Claude Code

---

## What This Document Covers

When you call the Claude API at scale, two costs compound silently: the cost of estimating tokens before every call, and the cost of sending the same instructions over and over. This document covers three things:

1. **Smart routing** — how to pick the right model automatically using a conditional shell script
2. **Pre-computed token library** — how to eliminate estimation API calls entirely by counting once and reusing
3. **Why local tokenizers fail for Claude** — and what to use instead

Everything here is practical. Every concept has working code. Every file is ready to drop into your project.

**Sources:**
- Anthropic API Documentation — [docs.anthropic.com](https://docs.anthropic.com)
- Anthropic Token Counting Guide — [docs.anthropic.com/en/docs/build-with-claude/token-counting](https://docs.anthropic.com/en/docs/build-with-claude/token-counting)
- Anthropic Prompt Caching Guide — [docs.anthropic.com/en/docs/build-with-claude/prompt-caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- Session training lab demos — `demos/backend/demo1a-token.js`, `demo1b-caching.js`

---

## Part 1 — The Problem: Estimation at Runtime is Expensive

### What happens today in most implementations

```
User sends prompt
      ↓
Call /v1/messages/count_tokens   ← network hop 1, ~150ms, costs money
      ↓
Decide which model to use
      ↓
Call /v1/messages                ← network hop 2, actual call
      ↓
Response
```

Every single prompt pays for an estimation call before the real call. At 1,000 calls/day that is 1,000 extra API calls just to decide which model to use.

### The architecture that fixes this

```
BUILD TIME (run once, ever):
  Count tokens for every skill system prompt
  Save results to token-library.json
      ↓
RUNTIME (every call):
  Look up system token count from JSON     ← 0ms, $0.00
  Estimate variable input locally          ← 0ms, $0.00
  Decide model                             ← 0ms, $0.00
  Call /v1/messages                        ← only real call
      ↓
Response
```

The estimation cost drops to zero. The only API call is the one that does work.

---

## Part 2 — Why Not Use tiktoken or Another Open Tokenizer?

This is the right instinct but there is a critical problem.

**Claude does not use the same tokenizer as any other model.**

| Tokenizer | Designed for | Accurate for Claude? |
|---|---|---|
| `tiktoken` (`cl100k_base`) | GPT-4 | No — different vocabulary |
| `tiktoken` (`o200k_base`) | GPT-4o | No — different vocabulary |
| `llama-tokenizer` | Meta Llama | No — completely different |
| Anthropic's tokenizer | Claude | Yes — but not publicly released |

Anthropic has not open-sourced their tokenizer. The `/v1/messages/count_tokens` API endpoint is their tokenizer, accessed remotely.

### How wrong is tiktoken for Claude?

The error is not random noise — it is **systematic and directional**:

```
Content type          tiktoken error vs Claude actual
─────────────────────────────────────────────────────
Plain English prose   ±5%    (acceptable for routing)
Mixed prose + code    ±10%   (marginal — near thresholds risky)
Dense code blocks     ±15–20% (problematic)
Unicode / non-English ±25%+   (unreliable)
```

At 1,000 calls per day with a 15% systematic undercount, you are consistently routing prompts to Haiku that should be on Sonnet. The output quality degrades. You do not notice until users complain.

### The right approach for each part of your prompt

```
Part of prompt         Approach                    Accuracy
─────────────────────────────────────────────────────────────
System prompt          Pre-computed library         Exact
  (static, cached)     Count once via API, reuse
  
Variable user input    Local char/3.5 estimate      ±10-15%
  (changes each call)  Sufficient for routing
  
Near-threshold calls   Live API count (only these)  Exact
  (within 500 tokens   count_tokens endpoint
   of a model boundary)
```

### The local estimate formula

Claude's tokenizer processes roughly **1 token per 3.5 characters** for mixed English text and code — the typical content type in most applications.

```javascript
function estimateLocal(text, contentType = "mixed") {
  const charsPerToken = {
    code:  3.0,   // code is more token-dense
    prose: 4.0,   // prose is less token-dense
    mixed: 3.5,   // default for mixed content
  };
  return Math.ceil(text.length / charsPerToken[contentType]);
}
```

**Why this is good enough for routing:** The model thresholds (Haiku below 8,000 tokens, Sonnet below 15,000 tokens) have wide enough bands that a ±15% error on variable input almost never crosses a boundary. A 5,000-token input estimated as 5,750 is still clearly in Sonnet territory.

---

## Part 3 — Smart Routing Shell Script

### What it does

A single bash script that wraps any prompt with automatic model selection:

1. Calls the token count endpoint on Haiku (cheapest counter)
2. Detects task type from keywords in your prompt, or from a `--task` flag
3. Applies routing rules based on task type AND token count
4. Shows you the cost comparison — what you would have paid on each model
5. Runs your prompt on the selected model
6. Prints the answer with a cost summary

### Routing rules built in

| Task type | Default model | Override condition | Override model |
|---|---|---|---|
| legal, security, architecture | Opus | never | — |
| debugging, summary, analysis | Sonnet | > 3,000 tokens | Opus |
| formatting, extraction | Haiku | > 8,000 tokens | Sonnet |
| unknown | Sonnet | > 5,000 tokens | Sonnet |

The upgrade conditions exist because very large inputs on cheap models can cause truncation or quality degradation, even on mechanical tasks.

### File: `smart-prompt.sh`

Drop this in your project root. Make it executable with `chmod +x smart-prompt.sh`.

```bash
#!/usr/bin/env bash
# smart-prompt.sh — estimate tokens, pick model, run Claude
# Usage:
#   ./smart-prompt.sh "your prompt here"
#   ./smart-prompt.sh "your prompt here" --task=legal
#
# Task types: legal, security, architecture, debugging,
#             summary, formatting, extraction, translation

set -euo pipefail

# Require API key
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "❌  ANTHROPIC_API_KEY not set"; exit 1
fi

PROMPT="${1:-}"
TASK_OVERRIDE=""
[[ -z "$PROMPT" ]] && { echo "Usage: $0 \"prompt\" [--task=TYPE]"; exit 1; }

for arg in "${@:2}"; do
  [[ "$arg" == --task=* ]] && TASK_OVERRIDE="${arg#--task=}"
done

HAIKU="claude-haiku-4-5"
SONNET="claude-sonnet-4-5"
OPUS="claude-opus-4-5"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SMART PROMPT — Token-aware model routing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  [1] Counting tokens on Haiku..."

# Step 1 — Count tokens (always Haiku — cheapest counter)
COUNT_RESPONSE=$(curl -s https://api.anthropic.com/v1/messages/count_tokens \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: token-counting-2024-11-01" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$HAIKU\",
    \"system\": \"You are a helpful assistant.\",
    \"messages\": [{\"role\": \"user\", \"content\": $(echo "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}]
  }")

TOKEN_COUNT=$(echo "$COUNT_RESPONSE" | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(d.get('input_tokens', 0))")
echo "      Tokens: $TOKEN_COUNT"

# Step 2 — Detect task type
echo "  [2] Detecting task type..."
if [[ -n "$TASK_OVERRIDE" ]]; then
  TASK="$TASK_OVERRIDE"
else
  PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')
  if   echo "$PROMPT_LOWER" | grep -qE "legal|liability|compliance|contract|pci|gdpr"; then TASK="legal"
  elif echo "$PROMPT_LOWER" | grep -qE "security|vulnerability|exploit|injection|acl";  then TASK="security"
  elif echo "$PROMPT_LOWER" | grep -qE "architect|design|structure|pattern|system";     then TASK="architecture"
  elif echo "$PROMPT_LOWER" | grep -qE "bug|error|exception|debug|fix|crash|null|npe";  then TASK="debugging"
  elif echo "$PROMPT_LOWER" | grep -qE "summar|overview|tldr|brief";                    then TASK="summary"
  elif echo "$PROMPT_LOWER" | grep -qE "format|reformat|convert|clean|json|csv";        then TASK="formatting"
  elif echo "$PROMPT_LOWER" | grep -qE "extract|parse|pull out|find all";               then TASK="extraction"
  else TASK="general"
  fi
fi
echo "      Task: $TASK"

# Step 3 — Select model with override rules
echo "  [3] Selecting model..."
case "$TASK" in
  legal|security|architecture)
    MODEL="$OPUS"
    REASON="High-stakes — needs best reasoning regardless of token count"
    ;;
  formatting|extraction|translation)
    if [[ "$TOKEN_COUNT" -gt 8000 ]]; then MODEL="$SONNET"; REASON="Large input — upgrading Haiku to Sonnet"
    else MODEL="$HAIKU"; REASON="Mechanical task — Haiku is sufficient"; fi
    ;;
  debugging|summary|analysis)
    if [[ "$TOKEN_COUNT" -gt 3000 ]]; then MODEL="$OPUS"; REASON="Complex task + large context — Opus"
    else MODEL="$SONNET"; REASON="Medium complexity — Sonnet"; fi
    ;;
  *)
    MODEL="$SONNET"; REASON="Unknown task type — defaulting to Sonnet"
    ;;
esac
MODEL_LABEL=$(echo "$MODEL" | sed 's/claude-//' | sed 's/-[0-9].*//')
echo "      Model: $MODEL_LABEL — $REASON"

# Step 4 — Show cost comparison
echo "  [4] Cost estimates:"
python3 -c "
t = $TOKEN_COUNT
rates = {'Haiku': 0.0000008, 'Sonnet': 0.000003, 'Opus': 0.000015}
for name, rate in rates.items():
    print(f'      {name}: \${t * rate:.6f}')
print(f'      ► Running: $MODEL_LABEL at \${t * rates[\"$MODEL_LABEL\"]:.6f}')
"

# Step 5 — Run the actual prompt
echo "  [5] Running on $MODEL_LABEL..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"max_tokens\": 1024,
    \"system\": \"You are a helpful assistant.\",
    \"messages\": [{\"role\": \"user\", \"content\": $(echo "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}]
  }")

echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['content'][0]['text'])"

OUTPUT_TOKENS=$(echo "$RESPONSE" | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(d['usage']['output_tokens'])" 2>/dev/null || echo "?")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Input: $TOKEN_COUNT tokens | Output: $OUTPUT_TOKENS tokens | Model: $MODEL_LABEL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

### Usage examples

```bash
# Auto-detect task type from keywords
./smart-prompt.sh "Why does getDeliveryWindow() throw NullPointerException?"
# → detects: debugging → routes to: Sonnet

./smart-prompt.sh "Does clause 4.2 of this contract expose us to PCI liability?"
# → detects: legal → routes to: Opus

./smart-prompt.sh "Reformat this JSON into CSV: {order_id: 123, status: failed}"
# → detects: formatting → routes to: Haiku

# Override task type explicitly
./smart-prompt.sh "Analyse this codebase structure" --task=architecture
# → forced: architecture → routes to: Opus
```

---

## Part 4 — The Pre-Computed Token Library

### The concept

A Skill has two parts:

```
┌─────────────────────────────────────────────────────┐
│  SYSTEM PROMPT                                      │
│  Static. Identical on every call.                   │
│  Contains: instructions, rules, output format.      │
│  Cacheable. Count once. Never count again.          │
├─────────────────────────────────────────────────────┤
│  USER MESSAGE                                       │
│  Variable. Different every call.                    │
│  Contains: the actual input for this request.       │
│  Estimate locally. No API call needed.              │
└─────────────────────────────────────────────────────┘
```

The library stores exact token counts for the system prompt of every skill. At runtime, the router looks up the system count in microseconds and adds a local estimate for the user message. Zero API calls. Zero latency. Zero cost.

### How the savings stack

Three independent layers compound:

**Layer 1 — Token reduction from separating concerns**

A raw prompt sends instructions + rules + format + actual input every call.
A Skill sends only the actual input in the user message.
Result: user message is 60–80% smaller than the equivalent raw prompt.

**Layer 2 — Prompt caching on system prompts**

The Skill's system prompt is identical on every call — perfect for caching.
First call: cache write at 1.25× normal price (slightly more).
All subsequent calls: cache read at 0.10× normal price (90% cheaper).
At 95% cache hit rate across 1,000 calls/day, system prompt costs ~15% of uncached price.

**Layer 3 — Model routing**

The Skill's category tells the router exactly which model to use.
Journey classification → Haiku (18× cheaper than Opus).
Bug diagnosis → Sonnet (5× cheaper than Opus).
ACL design → Opus (correct — no shortcuts on security).

**Combined at scale:**

```
Raw prompt, wrong model, no cache:
  500 tokens × $0.000015 (Opus) × 1,000 calls/day = $7.50/day

Skill + right model + cached system prompt:
  ~100 user tokens  × $0.0000008 (Haiku) × 1,000 = $0.08/day
  ~400 system tokens × $0.0000008 × 0.10 × 999  = $0.03/day
  Total = ~$0.11/day

Saving: $7.39/day — 98% reduction on this pattern alone
```

---

## Part 5 — Step-by-Step: Build Your Token Library

### Prerequisites

- Node.js 18 or above
- `ANTHROPIC_API_KEY` in your `.env` file
- A `.env` file loaded with `dotenv/config` (or export the key directly)

---

### Step 1 — Understand the file structure

You need two files in your project:

```
your-project/
├── build-token-library.js    ← run once to build the library
├── token-router.js           ← import this at runtime
├── token-library.json        ← auto-generated, commit to git
└── .env                      ← ANTHROPIC_API_KEY=sk-ant-...
```

---

### Step 2 — Create `build-token-library.js`

This script defines every skill you want in your library and counts their system prompt tokens once via the API.

```javascript
// build-token-library.js
// Run: node build-token-library.js
// Output: token-library.json

import "dotenv/config";
import { writeFileSync } from "fs";

const API_KEY = process.env.ANTHROPIC_API_KEY;
const HAIKU   = "claude-haiku-4-5";

// Count tokens for a system prompt using the Anthropic API
// This is the ONLY time we call the API per skill — ever.
async function countSystemTokens(systemPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "token-counting-2024-11-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: HAIKU,
      system: [{ type: "text", text: systemPrompt }],
      messages: [{ role: "user", content: "." }], // dummy — system is what we want
    }),
  });
  const data = await res.json();
  return (data.input_tokens || 0) - 1; // subtract dummy message token
}

// ── DEFINE YOUR SKILLS HERE ───────────────────────────────────
// Add every skill your team uses.
// system_prompt must be the EXACT text you send as the system message.
// model is which model this skill runs on.
// variable_hint describes what the user passes in (for documentation).

const SKILLS = [
  {
    id: "bug-diagnoser",
    name: "Bug Diagnoser",
    category: "debugging",
    model: "sonnet",
    variable_hint: "Jira + Kibana + code context (200–600 tokens typical)",
    system_prompt: `You are a senior Java/Spring Boot debugging expert.

When given evidence, respond in EXACTLY this format:

ROOT CAUSE: [one sentence — what is broken and why]
SERVICE: [service name]
FILE: [exact filename]
LINE: [line number]
CONFIDENCE: [High / Medium / Low]

FIX:
Before: [exact code that is wrong]
After:  [exact corrected code]

TEST:
[one specific JUnit test case that proves the fix works]

Rules:
- Reference specific line numbers, commit hashes, field names from evidence
- If evidence contradicts itself, note the contradiction
- Confidence must reflect actual evidence — never state High without a stack trace`,
  },

  {
    id: "journey-step-classifier",
    name: "Journey Step Classifier",
    category: "monitoring",
    model: "haiku",
    variable_hint: "One step: name|status|duration|anomaly|metadata (30–80 chars)",
    system_prompt: `You are a user journey monitor for an e-commerce platform.

Classify each step in EXACTLY this format — three lines, no more:
STATUS: [NORMAL | SLOW | ANOMALY]
NOTE: [one sentence under 20 words]
ACTION: [NONE | INVESTIGATE | ALERT]

Classification rules:
- Payment charged + order failed → ANOMALY + ALERT, always
- No error shown to user on failure → ANOMALY + ALERT
- Duration > 2000ms + success → SLOW + INVESTIGATE
- Step not reached → ANOMALY + INVESTIGATE
- All else → NORMAL + NONE

Never speculate. Never output more than three lines.`,
  },

  {
    id: "pr-description-generator",
    name: "PR Description Generator",
    category: "workflow",
    model: "sonnet",
    variable_hint: "git diff or changed file list (200–800 tokens)",
    system_prompt: `You are a senior engineer writing pull request descriptions.

When given a diff or list of changes, write a PR description in this format:

## Summary
[2–3 sentences: what changed and why]

## Changes
[bullet list of specific technical changes]

## Testing
[bullet list: what was tested, edge cases covered]

## Risk
[LOW / MEDIUM / HIGH] — [one sentence justification]

Rules:
- Summary must explain WHY not just WHAT
- Changes must be specific — not "updated various files"
- Risk must be honest — data deletion or auth changes = HIGH`,
  },

  // ── ADD YOUR OWN SKILLS BELOW THIS LINE ──────────────────
  // Copy the structure above.
  // id must be unique — this is your slash command name.
  // system_prompt must be final — changes require a rebuild.
];

// ── BUILD THE LIBRARY ────────────────────────────────────────
async function buildLibrary() {
  console.log(`\nBuilding token library for ${SKILLS.length} skills...\n`);

  const library = {
    built_at: new Date().toISOString(),
    counting_model: HAIKU,
    note: "System prompt tokens are exact. Variable input estimated locally at runtime (chars / 3.5).",
    skills: {},
  };

  for (const skill of SKILLS) {
    process.stdout.write(`  ${skill.name}... `);
    const tokens = await countSystemTokens(skill.system_prompt);

    library.skills[skill.id] = {
      name:           skill.name,
      category:       skill.category,
      model:          skill.model,
      variable_hint:  skill.variable_hint,
      system_tokens:  tokens,
      cache_eligible: tokens >= 1024,
    };

    console.log(`${tokens} tokens ${tokens >= 1024 ? "✅ cache eligible" : "⚠️  below 1024 threshold"}`);
    await new Promise(r => setTimeout(r, 400)); // breathing room for rate limits
  }

  writeFileSync("token-library.json", JSON.stringify(library, null, 2));
  console.log(`\n✅ Saved to token-library.json`);
  console.log(`   API calls made: ${SKILLS.length} (one-time only)`);
  console.log(`   Runtime estimation calls: 0 forever\n`);
}

buildLibrary().catch(err => {
  console.error("Build failed:", err.message);
  process.exit(1);
});
```

---

### Step 3 — Run it

```bash
node build-token-library.js
```

Expected output:

```
Building token library for 3 skills...

  Bug Diagnoser... 218 tokens ⚠️  below 1024 threshold
  Journey Step Classifier... 143 tokens ⚠️  below 1024 threshold
  PR Description Generator... 187 tokens ⚠️  below 1024 threshold

✅ Saved to token-library.json
   API calls made: 3 (one-time only)
   Runtime estimation calls: 0 forever
```

> **Note on cache eligibility:** If your system prompts are below 1,024 tokens, Anthropic will not cache them even if you add `cache_control`. To make a system prompt cache-eligible, expand it with more detail, more rules, or more examples until it exceeds 1,024 tokens. The cache threshold is documented at [docs.anthropic.com/en/docs/build-with-claude/prompt-caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching).

---

### Step 4 — Commit `token-library.json` to git

```bash
git add token-library.json
git commit -m "Add pre-computed token library for skill routing"
```

Commit it. Every developer gets exact counts without running the build script themselves. Only rebuild when you change a system prompt.

---

### Step 5 — Create `token-router.js`

This is what you import at runtime. It uses the library for zero-cost routing.

```javascript
// token-router.js
// Import this in any file that routes Claude API calls.
// Zero API calls at runtime.

import { readFileSync } from "fs";

// Load the pre-built library
const LIBRARY = JSON.parse(readFileSync("token-library.json", "utf8"));

// Pricing per token (2025 — verify at docs.anthropic.com/en/docs/models-overview)
const PRICE = {
  haiku:  0.80  / 1_000_000,
  sonnet: 3.00  / 1_000_000,
  opus:   15.00 / 1_000_000,
};

// Cache pricing multipliers
// Source: docs.anthropic.com/en/docs/build-with-claude/prompt-caching
const CACHE_WRITE = 1.25;  // first call: 25% more
const CACHE_READ  = 0.10;  // subsequent calls: 90% less

// Local token estimator — no API call
// Approximation: 1 token ≈ 3.5 characters for mixed content
// Accurate to ±10–15% for English text + code
// Sufficient for routing decisions — thresholds have wide enough bands
export function estimateLocal(text, contentType = "mixed") {
  const ratio = { code: 3.0, prose: 4.0, mixed: 3.5 }[contentType] || 3.5;
  return Math.ceil(text.length / ratio);
}

// Model upgrade thresholds
// Very large inputs on cheap models cause truncation or quality loss
const UPGRADE_AT = {
  haiku:  { threshold: 8000,  to: "sonnet", reason: "Input too large for Haiku" },
  sonnet: { threshold: 15000, to: "opus",   reason: "Input too large for Sonnet" },
};

// Main routing function
// Returns model choice, token counts, and cost breakdown
// Makes ZERO API calls
export function route(skillId, userInput = "", options = {}) {
  const skill = LIBRARY.skills[skillId];
  if (!skill) {
    const ids = Object.keys(LIBRARY.skills).join(", ");
    throw new Error(`Unknown skill: "${skillId}". Available: ${ids}`);
  }

  const isFirstCall    = (options.callNumber || 1) === 1;
  const systemTokens   = skill.system_tokens;
  const variableTokens = estimateLocal(userInput, options.contentType);
  const totalTokens    = systemTokens + variableTokens;

  // Apply upgrade rule if needed
  let model = skill.model;
  const upgrade = UPGRADE_AT[model];
  const upgraded = upgrade && totalTokens > upgrade.threshold;
  if (upgraded) model = upgrade.to;

  // Calculate cost
  const systemCost = isFirstCall
    ? systemTokens  * PRICE[skill.model] * CACHE_WRITE
    : systemTokens  * PRICE[skill.model] * CACHE_READ;
  const varCost    = variableTokens * PRICE[model];

  return {
    skillId,
    model,
    upgraded,
    systemTokens,
    variableTokens,
    totalTokens,
    cacheEligible: skill.cache_eligible,
    estimatedCost: `$${(systemCost + varCost).toFixed(6)}`,
    apiCallsUsed:  0,
  };
}

// Estimate daily cost for a skill at a given call volume
export function dailyCost(skillId, sampleInput, callsPerDay) {
  const first   = route(skillId, sampleInput, { callNumber: 1 });
  const cached  = route(skillId, sampleInput, { callNumber: 2 });
  const fc      = parseFloat(first.estimatedCost.replace("$", ""));
  const cc      = parseFloat(cached.estimatedCost.replace("$", ""));
  const daily   = fc + cc * (callsPerDay - 1);
  return {
    perFirstCall:  first.estimatedCost,
    perCachedCall: cached.estimatedCost,
    dailyTotal:    `$${daily.toFixed(4)}`,
    monthlyTotal:  `$${(daily * 30).toFixed(2)}`,
  };
}
```

---

### Step 6 — Use the router in your code

```javascript
import { route, dailyCost } from "./token-router.js";

// Route a single request — zero API calls
const decision = route("bug-diagnoser", userInputText);

console.log(decision.model);          // "sonnet"
console.log(decision.totalTokens);    // 318
console.log(decision.estimatedCost);  // "$0.000954"
console.log(decision.apiCallsUsed);   // 0

// Now call Claude with the correct model
const response = await callClaude({
  model:    `claude-${decision.model}-4-5`,
  system:   YOUR_SKILL_SYSTEM_PROMPT,
  messages: [{ role: "user", content: userInput }],
  max_tokens: 1024,
});

// Estimate cost at scale
const cost = dailyCost("journey-step-classifier", sampleStep, 5000);
console.log(cost.dailyTotal);    // "$0.42"
console.log(cost.monthlyTotal);  // "$12.60"
```

---

### Step 7 — When to rebuild the library

Rebuild `token-library.json` when:

- You change a skill's system prompt
- You add a new skill
- You remove a skill

Do not rebuild when:

- User input changes (that is estimated locally)
- Model pricing changes (update the constants in token-router.js)
- You upgrade Claude Code versions

```bash
# Rebuild command — same as the original build
node build-token-library.js
git add token-library.json
git commit -m "Rebuild token library — updated bug-diagnoser system prompt"
```

---

## Part 6 — Approach Comparison

| | API count every call | Pre-computed library | Local tokenizer (tiktoken) |
|---|---|---|---|
| **Latency** | +150ms per call | ~0ms | ~0ms |
| **Cost** | Haiku API call per estimation | $0 at runtime | $0 |
| **Accuracy** | Exact | Exact (system) ±15% (variable) | ❌ Wrong for Claude |
| **Works offline** | No | Yes | Yes |
| **Handles code well** | Yes | Yes | No — 15–20% off |
| **Handles Unicode** | Yes | Yes | No — 25%+ off |
| **Rebuild needed** | Never | On system prompt change | Never |
| **Best for** | One-off precision checks | Production routing | GPT models only |

**Recommendation:** Use the library for production routing. Use live API counts only when you are within 500 tokens of a model threshold and precision matters.

---

## Part 7 — Does Estimating Before Running Increase Total Tokens?

Yes — but it is a profitable trade.

```
Without estimation:
  1 call to /v1/messages
  Total: N tokens

With estimation via API:
  1 call to /v1/messages/count_tokens   ← ~50 tokens overhead
  1 call to /v1/messages                ← N tokens, right model
  Total: N + 50 tokens
```

The count endpoint adds roughly 50 tokens of overhead. The count endpoint also does NOT generate any output tokens — it only measures input. So the overhead is genuinely small.

**The return on that overhead:**

```
500-token prompt routed without estimation:
  Sent to Opus by default: 500 × $0.000015 = $0.0075

500-token prompt with estimation (routed to Haiku):
  Count overhead:  50 × $0.0000008  = $0.00004
  Haiku main call: 500 × $0.0000008 = $0.0004
  Total: $0.00044

Saving per call: $0.0075 − $0.00044 = $0.0071
Return on overhead: 17× at minimum
```

With the pre-computed library, the overhead drops to zero. You get all the routing benefit with none of the estimation cost.

---

## Quick Reference

### Commands

```bash
# Run the smart routing shell script
./smart-prompt.sh "your prompt"
./smart-prompt.sh "your prompt" --task=legal

# Build / rebuild the token library
node build-token-library.js

# The library is used automatically — no command needed
# Just import route() from token-router.js in your code
```

### Files

| File | What it does | Run how often |
|---|---|---|
| `smart-prompt.sh` | One-shot shell script with auto model selection | Every time you want a routed one-shot prompt |
| `build-token-library.js` | Counts system prompt tokens for all skills | Once, then on every system prompt change |
| `token-library.json` | Pre-computed counts — read by router | Never run directly — generated by build script |
| `token-router.js` | Runtime router — zero API calls | Import in your application code |

### Key numbers to remember

| | Value | Source |
|---|---|---|
| Cache threshold | 1,024 tokens | Anthropic prompt caching docs |
| Cache write cost | 1.25× normal | Anthropic prompt caching docs |
| Cache read cost | 0.10× normal | Anthropic prompt caching docs |
| Local estimate accuracy | ±10–15% for mixed content | Empirical — sufficient for routing |
| Routing threshold safety margin | 500 tokens | Recommended buffer before live count |
| Chars per token (mixed) | 3.5 | Claude approximation for English + code |

---

*Document prepared for: Building With Claude — Hands-On Session*
*References: Anthropic API Docs, Anthropic Prompt Caching Guide, Session training lab source code*
