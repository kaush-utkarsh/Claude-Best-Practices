// =============================================================
// skill-token-analysis.js
// 
// Builds a reference map of:
//   - Every prompt pattern from prompts.md
//   - The equivalent Skill that replaces it
//   - Token cost of sending the raw prompt vs using the Skill
//   - Token cost of using prompt caching on the Skill's system prompt
//
// Explains what is happening at each stage.
// =============================================================

import "dotenv/config";

const API_KEY = process.env.ANTHROPIC_API_KEY;
const HAIKU   = "claude-haiku-4-5";

// ── TOKEN COUNTER ────────────────────────────────────────────
async function countTokens(system, userMessage) {
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
      system: [{ type: "text", text: system }],
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = await res.json();
  return data.input_tokens || 0;
}

// ── COST CALCULATOR ──────────────────────────────────────────
// Prices per million input tokens (2025 pricing):
const PRICE_PER_TOKEN = {
  haiku:  0.80  / 1_000_000,
  sonnet: 3.00  / 1_000_000,
  opus:   15.00 / 1_000_000,
};

// Cache pricing:
// - Cache write: 1.25x normal (costs slightly more on first call)
// - Cache read:  0.10x normal (90% cheaper on subsequent calls)
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER  = 0.10;

function cost(tokens, model, isCacheRead = false, isCacheWrite = false) {
  const base = tokens * PRICE_PER_TOKEN[model];
  if (isCacheRead)  return base * CACHE_READ_MULTIPLIER;
  if (isCacheWrite) return base * CACHE_WRITE_MULTIPLIER;
  return base;
}

function fmt(n) { return `$${n.toFixed(6)}`; }
function fmtBig(n) { return `$${n.toFixed(2)}`; }

// ── THE REFERENCE MAP ─────────────────────────────────────────
// Each entry has:
//   name         - the pattern name from prompts.md
//   model        - which model runs this task
//   rawPrompt    - what the developer types every time (the direct prompt)
//   skillSystem  - the system prompt inside the Skill (static, cacheable)
//   skillUser    - the variable part the developer passes to the Skill (/skill-name INPUT)
//   note         - what the Skill does differently

const PATTERNS = [
  {
    name: "Token Routing Check",
    model: "haiku",
    rawPrompt: `Before you answer this — estimate the token count of your response,
recommend whether this needs Haiku, Sonnet, or Opus, and explain why.
Then proceed.

My task: Why does vendorPayload.getDeliveryWindow().toString() throw NullPointerException?`,

    skillSystem: `You are a token routing advisor.
When given a task, you must:
1. Estimate token count
2. Recommend Haiku, Sonnet, or Opus based on task type — not token size
3. Explain why in one sentence
4. Then answer the task on the recommended model

Rules:
- Legal, security, architecture → always Opus
- Debugging, summary, analysis → Sonnet
- Formatting, extraction, classification → Haiku
- Token count ≠ task complexity`,

    skillUser: `Why does vendorPayload.getDeliveryWindow().toString() throw NullPointerException?`,
    note: "System prompt is static across all routing checks — perfect for caching",
  },

  {
    name: "Bug Investigation (no evidence)",
    model: "sonnet",
    rawPrompt: `I have a bug to investigate: Order sync failure — checkout silently returns 500

Do NOT diagnose yet.

First, tell me:
1. What evidence do you need before you can diagnose this?
2. Which systems do you need to check? (logs, code, tickets)
3. What would confirm your hypothesis vs rule it out?

Once I provide the evidence, then diagnose.

Here is what I have so far: none yet`,

    skillSystem: `You are a senior Java/Spring Boot debugging expert.

When investigating a bug:
1. Never diagnose before gathering evidence
2. First ask: what evidence do you need?
3. List the systems to check (Jira, Kibana, repo)
4. Describe what would confirm vs rule out each hypothesis
5. Only diagnose after evidence is provided

Rules:
- Tools first. Reasoning second. Always.
- If evidence is missing, state what is missing. Do not speculate.
- Confidence must reflect actual evidence — not guesses stated confidently`,

    skillUser: `Investigate: Order sync failure — checkout silently returns 500. No evidence yet.`,
    note: "The investigation rules never change — same system prompt for every bug",
  },

  {
    name: "Bug Diagnosis (with evidence)",
    model: "sonnet",
    rawPrompt: `Here is the evidence for bug APP-123:

JIRA TICKET: APP-123 — Order sync failure — checkout silently returns 500. P1, OPEN.
Reporter: monitoring-alert. 12% of orders affected since vendor contract update.

KIBANA LOGS: 2 errors found.
Top error: NullPointerException at OrderProcessor.java:142
Stack: Cannot invoke String.toString() because VendorPayload.getDeliveryWindow() is null

CODE CONTEXT:
Line 141: // deliveryWindow was required — now optional since v2.4 contract
Line 142: String window = vendorPayload.getDeliveryWindow().toString(); // NPE HERE
Line 143: this.orderRecord.setDeliveryWindow(window);

Now diagnose. Respond in exactly this format:

ROOT CAUSE: [one sentence]
SERVICE: [service name]
FILE: [filename]
LINE: [line number]
CONFIDENCE: [High/Medium/Low]

FIX:
[before and after code]

TEST:
[one specific test case]`,

    skillSystem: `You are a senior Java/Spring Boot debugging expert.

When given evidence, diagnose in exactly this format:

ROOT CAUSE: [one sentence — what is broken and why]
SERVICE: [service name]
FILE: [filename]
LINE: [line number if known]
CONFIDENCE: [High/Medium/Low]

FIX:
[exact code change — before and after]

TEST:
[one specific test case to verify the fix]

Rules:
- Be precise. Reference specific line numbers, commit hashes, field names from evidence
- If evidence is missing, say so — do not speculate
- Confidence must reflect actual evidence provided`,

    skillUser: `Evidence for APP-123:
JIRA: Order sync failure, P1, 12% orders affected since vendor contract update.
KIBANA: NPE at OrderProcessor.java:142 — getDeliveryWindow() returns null.
CODE: Line 142: vendorPayload.getDeliveryWindow().toString() — comment says optional since v2.4`,
    note: "Format instructions are identical every time — pure cache hit after first call",
  },

  {
    name: "Journey Step Classification",
    model: "haiku",
    rawPrompt: `Analyse this user journey. For each step, classify it as:
STATUS: [NORMAL | SLOW | ANOMALY]
ACTION: [NONE | INVESTIGATE | ALERT]

Rules:
- SLOW = completed but took longer than 2000ms
- ANOMALY = failed, skipped, or suspicious signals
- If payment charged but order failed → always ANOMALY + ALERT
- If user saw no error message on failure → always ANOMALY + ALERT

Journey steps:
Step: checkout | Status: failure | Duration: 8743ms | Anomaly: true | httpStatus: 500 | errorShown: false | paymentCharged: true

After all steps: provide a one-line session summary and business impact.`,

    skillSystem: `You are a user journey monitor for an e-commerce platform.

Classify each step in exactly this format:
STATUS: [NORMAL | SLOW | ANOMALY]
NOTE: [one sentence — what happened and why it matters]
ACTION: [NONE | INVESTIGATE | ALERT]

Rules:
- NORMAL: step completed successfully within expected duration
- SLOW: completed but took longer than expected (>2000ms)
- ANOMALY: step failed, was skipped, or has suspicious signals
- If payment charged but order failed → always ANOMALY + ALERT
- If user saw no error message on failure → always ANOMALY + ALERT
- Keep NOTE under 20 words
- Never speculate beyond what the data shows`,

    skillUser: `Step: checkout | Status: failure | Duration: 8743ms | Anomaly: true | httpStatus: 500 | errorShown: false | paymentCharged: true`,
    note: "This runs thousands of times per day on Haiku — caching the system prompt is essential",
  },

  {
    name: "ACL Design for New Skill",
    model: "opus",
    rawPrompt: `I am building a skill called "order-monitor".
Its purpose is: Monitor order processing errors and alert on anomalies

Before we write any code:
1. List the tools this skill should be allowed to call
2. List the tools it should NEVER be allowed to call
3. Classify each tool as READ or WRITE
4. Tell me which write tools need an approval gate
5. Show me the checkACL() function for this skill`,

    skillSystem: `You are a security architect for an AI-powered platform.

When asked to design ACL for a new skill:
1. List tools the skill SHOULD be allowed — based on its stated purpose
2. List tools it should NEVER access — based on least-privilege principle
3. Classify every tool as READ or WRITE
4. Flag which WRITE tools need an explicit approval gate before execution
5. Write the checkACL() function

Rules:
- Default to read-only unless write access is explicitly required
- Write tools must always have an approval gate
- Never grant access to tools outside the skill's stated purpose
- Show the JavaScript checkACL() function with the exact tool list`,

    skillUser: `Design ACL for skill: "order-monitor" — monitors order processing errors and alerts on anomalies`,
    note: "Security design instructions are identical for every skill — one cache write covers all ACL designs",
  },
];

// ── MAIN ANALYSIS ────────────────────────────────────────────
async function runAnalysis() {
  const CALLS_PER_DAY = 1000;
  const CACHE_HIT_RATE = 0.95; // 95% of calls after first are cache reads

  console.log("\n" + "═".repeat(70));
  console.log("  SKILL + PROMPT LIBRARY — TOKEN ANALYSIS");
  console.log("  What you save by using Skills with cached system prompts");
  console.log("═".repeat(70));

  const summary = [];

  for (const p of PATTERNS) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`  PATTERN: ${p.name}`);
    console.log(`  Model:   ${p.model.toUpperCase()}`);
    console.log(`${"─".repeat(70)}`);

    // ── Count tokens for both approaches ──
    const system = "You are a helpful assistant.";
    const rawTokens  = await countTokens(system, p.rawPrompt);
    const skillSysTokens  = await countTokens(p.skillSystem, "");
    const skillUserTokens = await countTokens("", p.skillUser);
    const skillTotalTokens = skillSysTokens + skillUserTokens;

    console.log(`\n  RAW PROMPT (typed every time):`);
    console.log(`    Tokens: ${rawTokens}`);
    console.log(`    Cost per call (${p.model}): ${fmt(cost(rawTokens, p.model))}`);

    console.log(`\n  SKILL APPROACH:`);
    console.log(`    System prompt tokens: ${skillSysTokens}  ← this part is cached`);
    console.log(`    User input tokens:    ${skillUserTokens}  ← this part changes`);
    console.log(`    Total tokens:         ${skillTotalTokens}`);

    // First call: cache write (1.25x on system prompt)
    const skillFirstCall = cost(skillSysTokens, p.model, false, true) 
                         + cost(skillUserTokens, p.model);

    // Subsequent calls: cache read (0.10x on system prompt)
    const skillCachedCall = cost(skillSysTokens, p.model, true, false) 
                          + cost(skillUserTokens, p.model);

    console.log(`\n  COST COMPARISON:`);
    console.log(`    Raw prompt every call:     ${fmt(cost(rawTokens, p.model))}`);
    console.log(`    Skill — call 1 (cache write): ${fmt(skillFirstCall)}  ← slightly more`);
    console.log(`    Skill — call 2+ (cache read): ${fmt(skillCachedCall)}  ← 90% cheaper on system`);

    // At scale
    const rawDailyCost   = cost(rawTokens, p.model) * CALLS_PER_DAY;
    const skillDailyCost = skillFirstCall 
                         + (skillCachedCall * (CALLS_PER_DAY - 1) * CACHE_HIT_RATE)
                         + (cost(skillTotalTokens, p.model) * (CALLS_PER_DAY - 1) * (1 - CACHE_HIT_RATE));
    const dailySaving    = rawDailyCost - skillDailyCost;
    const savingPct      = (dailySaving / rawDailyCost * 100).toFixed(1);

    console.log(`\n  AT ${CALLS_PER_DAY.toLocaleString()} CALLS/DAY:`);
    console.log(`    Raw prompts:   ${fmtBig(rawDailyCost)}/day`);
    console.log(`    With Skills + cache: ${fmtBig(skillDailyCost)}/day`);
    console.log(`    Daily saving:  ${fmtBig(dailySaving)}/day  (${savingPct}% reduction)`);
    console.log(`    Monthly saving: ${fmtBig(dailySaving * 30)}/month`);

    console.log(`\n  WHY: ${p.note}`);

    summary.push({
      name: p.name,
      model: p.model,
      rawTokens,
      skillTotalTokens,
      tokenReduction: rawTokens - skillTotalTokens,
      rawDailyCost,
      skillDailyCost,
      dailySaving,
      savingPct,
    });

    await new Promise(r => setTimeout(r, 500)); // rate limit breathing room
  }

  // ── SUMMARY TABLE ────────────────────────────────────────
  console.log("\n\n" + "═".repeat(70));
  console.log("  SUMMARY TABLE");
  console.log("═".repeat(70));
  console.log(`\n  ${"Pattern".padEnd(32)} ${"Raw tok".padStart(8)} ${"Skill tok".padStart(10)} ${"Saved/day".padStart(12)} ${"% cut".padStart(7)}`);
  console.log(`  ${"─".repeat(72)}`);

  let totalRawDaily   = 0;
  let totalSkillDaily = 0;

  for (const s of summary) {
    console.log(
      `  ${s.name.padEnd(32)} ` +
      `${String(s.rawTokens).padStart(8)} ` +
      `${String(s.skillTotalTokens).padStart(10)} ` +
      `${fmtBig(s.dailySaving).padStart(12)} ` +
      `${(s.savingPct + "%").padStart(7)}`
    );
    totalRawDaily   += s.rawDailyCost;
    totalSkillDaily += s.skillDailyCost;
  }

  const totalDailySaving = totalRawDaily - totalSkillDaily;
  const totalSavingPct   = (totalDailySaving / totalRawDaily * 100).toFixed(1);

  console.log(`  ${"─".repeat(72)}`);
  console.log(`  ${"TOTAL (all patterns, 1k calls/day each)".padEnd(52)} ${fmtBig(totalDailySaving).padStart(12)} ${(totalSavingPct + "%").padStart(7)}`);
  console.log(`\n  Monthly total saving: ${fmtBig(totalDailySaving * 30)}/month`);

  // ── EXPLANATION ──────────────────────────────────────────
  console.log("\n\n" + "═".repeat(70));
  console.log("  WHAT JUST HAPPENED — EXPLAINED");
  console.log("═".repeat(70));
  console.log(`
  THREE LAYERS OF SAVING — each independent, all compounding:

  LAYER 1 — TOKEN REDUCTION (Skill vs Raw Prompt)
  ─────────────────────────────────────────────────
  A raw prompt contains everything: the instructions, the rules,
  the output format, the context, AND the actual input.
  Every call sends all of it.

  A Skill separates the static part (instructions, rules, format)
  from the variable part (the actual input for this call).
  The user message in a Skill is usually 60-80% smaller than
  the raw prompt — because the instructions moved to the system prompt.

  LAYER 2 — PROMPT CACHING (System Prompt Cache)
  ─────────────────────────────────────────────────
  The Skill's system prompt is identical on every call.
  The first call writes it to cache (costs 1.25x — slightly more).
  Every subsequent call reads from cache (costs 0.10x — 90% cheaper).

  At 95% cache hit rate and 1000 calls/day:
    - 950 calls pay 10% of normal system prompt cost
    - 50 calls pay 125% (cold cache misses)
  Net result: system prompt costs roughly 15% of uncached price.

  LAYER 3 — MODEL ROUTING (Right Model for Right Task)
  ─────────────────────────────────────────────────────
  The Skill's description lets the router pick the right model.
  A journey classification Skill → Haiku  (18x cheaper than Opus)
  A bug diagnosis Skill → Sonnet          (5x cheaper than Opus)
  An ACL design Skill → Opus              (correct — no shortcuts)

  COMBINED EFFECT:
  ─────────────────────────────────────────────────────
  Smaller user message  ×  cheaper system prompt  ×  right model
         = the numbers above

  The saving is not from doing less — it is from not repeating
  the same instruction tokens on every single call.
  `);
  console.log("═".repeat(70) + "\n");
}

runAnalysis().catch(err => {
  console.error("\n❌ Analysis failed:", err.message);
  if (err.message.includes("API")) {
    console.error("   Check your ANTHROPIC_API_KEY in .env");
  }
  process.exit(1);
});
