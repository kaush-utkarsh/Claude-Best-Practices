// =============================================================
// demo1b-caching.js
// DEMO 1b: Caching + Output Control + Context Hygiene + Batching
// ─────────────────────────────────────────────────────────────
// Concept:  Every unnecessary token costs money. Kill them all.
// Part 1:   Prompt caching — stop re-processing the same system prompt
// Part 2:   Output token control — max_tokens is a ceiling, use it
// Part 3:   Context window hygiene — don't send the same data twice
// Part 4:   Batch API — 50% cost for non-realtime tasks
// Runtime:  ~25 seconds
// Run:      node demos/backend/demo1b-caching.js
// =============================================================

import { callClaude, countTokens, MODELS } from "./shared/api-client.js";
import { estimateCostUSD } from "./shared/mock-data.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1";
const API_KEY = process.env.ANTHROPIC_API_KEY;


// -----------------------------------------------------------
// LONG SYSTEM PROMPT
// Simulates a real skill prompt — detailed instructions,
// domain knowledge, output format rules.
// This is what gets cached.
// -----------------------------------------------------------
const SKILL_SYSTEM_PROMPT = `You are a senior Java/Spring Boot debugging assistant embedded in an 
enterprise e-commerce platform. You have deep knowledge of the following system:

ARCHITECTURE:
- user-service     → handles auth, sessions, user profiles (port 8081)
- product-service  → catalogue, search, inventory (port 8082)  
- cart-service     → basket management, pricing rules (port 8083)
- order-service    → order processing, vendor integration (port 8084)
- payment-service  → payment gateway, refunds (port 8085)

KNOWN PATTERNS:
- All services use Spring Boot 3.2, Java 17
- Distributed tracing via Spring Cloud Sleuth (traceId, spanId in logs)
- Log format: TIMESTAMP LEVEL [service,traceId,spanId] logger : message
- Vendor payloads may contain optional fields since contract v2.4 (March 2026)
- NullPointerException is the most common class of bug in vendor integrations

OUTPUT FORMAT:
- Always lead with: Root cause in one sentence
- Then: Affected service and line number
- Then: Suggested fix as a Java code snippet
- Then: Test case to verify the fix
- Keep responses under 300 words

GUARDRAILS:
- Never suggest restarting services as a fix
- Never recommend disabling null checks
- Always suggest adding unit tests for edge cases
- Flag if the fix requires a vendor contract discussion`;


// -----------------------------------------------------------
// PART 1: PROMPT CACHING
// The wrong way vs the right way.
// The wrong way silently fails — devs never know.
// -----------------------------------------------------------
async function demoCaching() {
  console.log("\n" + "═".repeat(60));
  console.log("  PART 1 — PROMPT CACHING");
  console.log("  Stop paying to re-process the same system prompt.");
  console.log("═".repeat(60));

  const message = {
    role:    "user",
    content: "Why does vendorPayload.getDeliveryWindow().toString() throw a NullPointerException?",
  };

  // ── THE WRONG WAY (top-level cache_control) ──────────────
  console.log("\n❌ WRONG WAY — top-level cache_control (silently fails):");
  console.log("─".repeat(60));
  console.log(`
  // This is how ChatGPT does it. Anthropic ignores it silently.
  {
    cache_control: { type: "ephemeral" },   ← TOP LEVEL — WRONG
    system: "Your skill instructions...",
    messages: [...]
  }

  Result: No cache. Full tokens charged. No error thrown.
  You'd never know it wasn't working.
  `);

  // ── THE RIGHT WAY (block-level cache_control) ─────────────
  console.log("✅ RIGHT WAY — block-level cache_control:");
  console.log("─".repeat(60));

  // First call — cache MISS (populates the cache)
  console.log("\n  Call 1 of 2 — Cache MISS (first time, populates cache)...");

  const cachedSystem = [
    {
      type: "text",
      text: SKILL_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },  // ← BLOCK LEVEL — CORRECT
    }
  ];

  const response1 = await callClaude({
    model:      MODELS.HAIKU,
    system:     cachedSystem,
    messages:   [message],
    max_tokens: 300,
  });

  console.log(`  Tokens used:   ${response1.usage.input_tokens} input`);
  console.log(`  Cache status:  ${response1.usage.cache_creation_input_tokens > 0
    ? `MISS — ${response1.usage.cache_creation_input_tokens} tokens written to cache`
    : "Check anthropic-beta header — caching needs: prompt-caching-2024-11-01"
  }`);

  // Second call — cache HIT (reads from cache, much cheaper)
  console.log("\n  Call 2 of 2 — Cache HIT (same system prompt, reads from cache)...");

  const response2 = await callClaude({
    model:      MODELS.HAIKU,
    system:     cachedSystem,
    messages:   [{ role: "user", content: "What unit test should I write to prevent this?" }],
    max_tokens: 300,
  });

  console.log(`  Tokens used:   ${response2.usage.input_tokens} input`);
  console.log(`  Cache status:  ${response2.usage.cache_read_input_tokens > 0
    ? `HIT — ${response2.usage.cache_read_input_tokens} tokens read from cache (90% cheaper)`
    : "Cache read — check usage object for cache_read_input_tokens"
  }`);

  const promptTokens = await countTokens({ system: cachedSystem, messages: [message] });
  const missEst  = estimateCostUSD(MODELS.HAIKU, promptTokens.input_tokens);
  const hitEst   = estimateCostUSD(MODELS.HAIKU, Math.round(promptTokens.input_tokens * 0.1));

  console.log(`\n  Cost per call without cache: $${missEst.inputCost}`);
  console.log(`  Cost per call with cache:    $${hitEst.inputCost}`);
  console.log(`  At 1,000 calls/day saving:   $${((parseFloat(missEst.inputCost) - parseFloat(hitEst.inputCost)) * 1000).toFixed(4)}/day`);

  console.log(`\n  KEY RULE: cache_control goes on the CONTENT BLOCK.`);
  console.log(`  Not on the request. Not top-level. On the block.`);
}


// -----------------------------------------------------------
// PART 2: OUTPUT TOKEN CONTROL
// max_tokens is a ceiling — set it intentionally per task
// -----------------------------------------------------------
async function demoOutputControl() {
  console.log("\n\n" + "═".repeat(60));
  console.log("  PART 2 — OUTPUT TOKEN CONTROL");
  console.log("  max_tokens is a ceiling. Use it intentionally.");
  console.log("═".repeat(60));

  const tasks = [
    {
      label:      "JSON extraction (should be tiny)",
      message:    "Extract the service name and error from this log: 2026-04-01 10:28:11 ERROR [order-service,abc123] OrderProcessor: NullPointerException at line 142",
      goodCap:    80,
      badCap:     4096,
      model:      MODELS.HAIKU,
    },
    {
      label:      "Root cause summary (medium)",
      message:    "Summarise the root cause of APP-123 in 2-3 sentences for a non-technical stakeholder.",
      goodCap:    150,
      badCap:     4096,
      model:      MODELS.HAIKU,
    },
  ];

  for (const task of tasks) {
    console.log(`\n  Task: ${task.label}`);

    const goodCost = estimateCostUSD(task.model, 80, task.goodCap);
    const badCost  = estimateCostUSD(task.model, 80, task.badCap);

    console.log(`  max_tokens = ${task.goodCap} (correct):  $${goodCost.outputCost} max output cost`);
    console.log(`  max_tokens = ${task.badCap}  (lazy):   $${badCost.outputCost} max output cost`);
    console.log(`  Difference: ${(parseFloat(badCost.outputCost) / parseFloat(goodCost.outputCost)).toFixed(0)}x more expensive ceiling`);
  }

  console.log(`\n  KEY RULE: Every task has a natural output size.`);
  console.log(`  A JSON extraction doesn't need 4096 tokens.`);
  console.log(`  Cap it. You're not limiting quality — you're removing waste.`);
}


// -----------------------------------------------------------
// PART 3: CONTEXT WINDOW HYGIENE
// Show the cost of sending duplicate or bloated context
// -----------------------------------------------------------
async function demoContextHygiene() {
  console.log("\n\n" + "═".repeat(60));
  console.log("  PART 3 — CONTEXT WINDOW HYGIENE");
  console.log("  Don't send the same data twice.");
  console.log("═".repeat(60));

  const repeatedContext = `
    Order ID: ORD-789. Error: NullPointerException at OrderProcessor.java:142.
    Vendor payload missing deliveryWindow field. HTTP 500 returned. Payment charged.
  `;

  // BAD: pasting the same context into every message turn
  const bloatedMessages = [
    { role: "user",      content: `${repeatedContext}\nWhat is the root cause?` },
    { role: "assistant", content: "The root cause is a missing null check on deliveryWindow." },
    { role: "user",      content: `${repeatedContext}\nWhat file needs to change?` },
    { role: "assistant", content: "OrderProcessor.java at line 142." },
    { role: "user",      content: `${repeatedContext}\nWhat is the fix?` },
  ];

  // GOOD: context in system prompt (cached), messages stay lean
  const cleanMessages = [
    { role: "user",      content: "What is the root cause?" },
    { role: "assistant", content: "The root cause is a missing null check on deliveryWindow." },
    { role: "user",      content: "What file needs to change?" },
    { role: "assistant", content: "OrderProcessor.java at line 142." },
    { role: "user",      content: "What is the fix?" },
  ];

  const bloatedCount = await countTokens({
    system:   "You are a debugging assistant.",
    messages: bloatedMessages,
  });

  const cleanCount = await countTokens({
    system:   `You are a debugging assistant. Context: ${repeatedContext}`,
    messages: cleanMessages,
  });

  console.log(`\n  Bloated (context repeated in every message):`);
  console.log(`  Token count: ${bloatedCount.input_tokens}`);

  console.log(`\n  Clean (context in system prompt, messages lean):`);
  console.log(`  Token count: ${cleanCount.input_tokens}`);

  const saving = bloatedCount.input_tokens - cleanCount.input_tokens;
  console.log(`\n  Tokens saved per conversation: ${saving}`);
  console.log(`  Cost saved at 1,000 convos/day (Haiku): $${
    (estimateCostUSD(MODELS.HAIKU, saving * 1000).inputCost)
  }/day`);

  console.log(`\n  KEY RULES:`);
  console.log(`  1. Context belongs in system prompt — not repeated in messages.`);
  console.log(`  2. Trim conversation history when it grows beyond what's needed.`);
  console.log(`  3. Never send the same data twice in one request.`);
}


// -----------------------------------------------------------
// PART 4: BATCH API
// 50% cost for non-realtime tasks
// Show the structure — we don't actually submit (costs money)
// -----------------------------------------------------------
async function demoBatching() {
  console.log("\n\n" + "═".repeat(60));
  console.log("  PART 4 — BATCH API");
  console.log("  50% cost reduction for non-realtime tasks.");
  console.log("═".repeat(60));

  // Show what a batch request looks like
  const batchPayload = {
    requests: [
      {
        custom_id: "triage-APP-123",
        params: {
          model:      MODELS.HAIKU,
          max_tokens: 200,
          messages:   [{ role: "user", content: "Summarise APP-123 for daily standup." }],
        },
      },
      {
        custom_id: "triage-APP-456",
        params: {
          model:      MODELS.HAIKU,
          max_tokens: 200,
          messages:   [{ role: "user", content: "Summarise APP-456 for daily standup." }],
        },
      },
      {
        custom_id: "triage-APP-789",
        params: {
          model:      MODELS.HAIKU,
          max_tokens: 200,
          messages:   [{ role: "user", content: "Summarise APP-789 for daily standup." }],
        },
      },
    ]
  };

  console.log(`\n  Batch payload structure (${batchPayload.requests.length} requests):`);
  console.log(`  POST /v1/messages/batches`);
  console.log(`\n  Each request has:`);
  console.log(`  - custom_id  → your reference, returned in results`);
  console.log(`  - params     → same shape as a normal /v1/messages call`);

  console.log(`\n  What happens after submission:`);
  console.log(`  1. Anthropic queues all requests`);
  console.log(`  2. You poll GET /v1/messages/batches/{id} for status`);
  console.log(`  3. Results available within 24hrs (usually minutes)`);
  console.log(`  4. Download results as JSONL — one line per custom_id`);

  // Cost comparison
  const singleCost = parseFloat(estimateCostUSD(MODELS.HAIKU, 100, 200).totalCost);
  const batchCost  = singleCost * 0.5;
  const requests   = 1000;

  console.log(`\n  Cost comparison (${requests} requests/day):`);
  console.log(`  Standard API: $${(singleCost * requests).toFixed(4)}/day`);
  console.log(`  Batch API:    $${(batchCost  * requests).toFixed(4)}/day`);
  console.log(`  Saving:       $${((singleCost - batchCost) * requests).toFixed(4)}/day`);

  console.log(`\n  WHEN TO USE BATCH:`);
  console.log(`  ✅ Nightly report generation`);
  console.log(`  ✅ Bulk ticket triage`);
  console.log(`  ✅ Offline data enrichment`);
  console.log(`  ✅ Any task where the user isn't waiting`);

  console.log(`\n  WHEN NOT TO USE BATCH:`);
  console.log(`  ❌ Anything user-facing (they will wait up to 24hrs)`);
  console.log(`  ❌ Real-time tool loops`);
  console.log(`  ❌ Streaming responses`);

  console.log(`\n  KEY RULE: If the user is not watching — batch it.`);
}


// -----------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------
function printSummary() {
  console.log("\n\n" + "═".repeat(60));
  console.log("  DEMO 1b SUMMARY — COST OPTIMISATION PLAYBOOK");
  console.log("═".repeat(60));
  console.log(`
  1. PROMPT CACHING
     cache_control goes on the content block — not top level.
     90% cheaper on repeated system prompts.

  2. OUTPUT TOKEN CONTROL
     Set max_tokens per task. A JSON extraction ≠ 4096 tokens.
     Cap it intentionally. Remove the ceiling you never meant to set.

  3. CONTEXT HYGIENE
     Context belongs in system prompt, not repeated in messages.
     Trim history. Never send the same data twice.

  4. BATCH API
     50% cost reduction for non-realtime tasks.
     If the user isn't watching — batch it.
  `);
  console.log("═".repeat(60) + "\n");
}


// -----------------------------------------------------------
// RUN
// -----------------------------------------------------------
async function runDemo() {
  console.log("\n" + "═".repeat(60));
  console.log("  DEMO 1b — CACHING + OUTPUT + HYGIENE + BATCHING");
  console.log("  Every unnecessary token costs money. Kill them all.");
  console.log("═".repeat(60));

  await demoCaching();
  await demoOutputControl();
  await demoContextHygiene();
  await demoBatching();
  printSummary();
}

runDemo().catch(err => {
  console.error("\n❌ Demo failed:", err.message);
  process.exit(1);
});
