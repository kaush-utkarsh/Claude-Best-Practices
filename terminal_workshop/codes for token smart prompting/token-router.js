// =============================================================
// token-router.js
// 
// Runtime router that uses the pre-built token-library.json.
// ZERO API calls for estimation.
//
// Uses:
//   - Exact system prompt tokens from the library (pre-counted)
//   - Local character-based approximation for variable user input
//   - No network requests until the actual Claude call
//
// Usage:
//   import { route, estimateLocal } from "./token-router.js";
//   const decision = route("bug-diagnoser", userInputText);
//   console.log(decision.model, decision.totalTokens, decision.costEstimate);
// =============================================================

import { readFileSync } from "fs";

// ── LOAD LIBRARY ─────────────────────────────────────────────
let LIBRARY;
try {
  LIBRARY = JSON.parse(readFileSync("token-library.json", "utf8"));
} catch {
  throw new Error("token-library.json not found. Run: node build-token-library.js");
}

// ── PRICING (per token) ──────────────────────────────────────
const PRICE = {
  haiku:  0.80  / 1_000_000,
  sonnet: 3.00  / 1_000_000,
  opus:   15.00 / 1_000_000,
};

const CACHE_READ_MULTIPLIER  = 0.10;  // 90% cheaper
const CACHE_WRITE_MULTIPLIER = 1.25;  // 25% more on first call

// ── LOCAL TOKEN ESTIMATOR ─────────────────────────────────────
// Claude's actual tokenizer is proprietary.
// This approximation (1 token per 3.5 chars) is accurate to ±10-15%
// for English text — sufficient for routing decisions.
//
// Why 3.5 chars?
//   - English words average 5 chars, ~1.4 tokens (incl. spaces/punct)
//   - Code is denser — more tokens per char
//   - 3.5 is the empirical midpoint for mixed text+code content
//
// For pure code, use 3.0. For pure prose, use 4.0.
export function estimateLocal(text, contentType = "mixed") {
  const charsPerToken = { code: 3.0, prose: 4.0, mixed: 3.5 };
  const ratio = charsPerToken[contentType] || 3.5;
  return Math.ceil(text.length / ratio);
}

// ── MODEL THRESHOLDS ─────────────────────────────────────────
// These override the skill's default model when token count is extreme.
// A formatting skill normally runs on Haiku — but if the input is
// 10,000 tokens, Haiku may truncate. Upgrade to Sonnet.
const TOKEN_OVERRIDES = {
  haiku:  { upgrade_at: 8000,  upgrade_to: "sonnet", reason: "Input too large for Haiku — upgrading to Sonnet" },
  sonnet: { upgrade_at: 15000, upgrade_to: "opus",   reason: "Input too large for Sonnet — upgrading to Opus" },
  opus:   { upgrade_at: null }, // Opus stays Opus regardless of size
};

// ── MAIN ROUTER ──────────────────────────────────────────────
export function route(skillId, userInput = "", options = {}) {
  const skill = LIBRARY.skills[skillId];
  if (!skill) {
    const available = Object.keys(LIBRARY.skills).join(", ");
    throw new Error(`Unknown skill: "${skillId}". Available: ${available}`);
  }

  const contentType   = options.contentType || "mixed";
  const callNumber    = options.callNumber   || 1;    // 1 = first call, 2+ = cache hit
  const isFirstCall   = callNumber === 1;

  // Token counts
  const systemTokens  = skill.system_tokens;
  const variableTokens = estimateLocal(userInput, contentType);
  const totalTokens   = systemTokens + variableTokens;

  // Model selection with override
  let model        = skill.model;
  let overrideNote = null;
  const override   = TOKEN_OVERRIDES[model];
  if (override?.upgrade_at && totalTokens > override.upgrade_at) {
    model        = override.upgrade_to;
    overrideNote = override.reason;
  }

  // Cost calculation
  const systemCost = isFirstCall
    ? systemTokens  * PRICE[skill.model] * CACHE_WRITE_MULTIPLIER
    : systemTokens  * PRICE[skill.model] * CACHE_READ_MULTIPLIER;

  const variableCost = variableTokens * PRICE[model];
  const totalCost    = systemCost + variableCost;

  return {
    skillId,
    skillName:       skill.name,
    model,
    modelOverride:   overrideNote,
    systemTokens,
    variableTokens,
    totalTokens,
    cacheEligible:   skill.cache_eligible,
    isFirstCall,
    costBreakdown: {
      systemCost:   `$${systemCost.toFixed(6)}  (${isFirstCall ? "cache write — 1.25x" : "cache read — 0.10x"})`,
      variableCost: `$${variableCost.toFixed(6)}  (user input — full price)`,
      totalCost:    `$${totalCost.toFixed(6)}`,
    },
    apiCallsUsed: 0, // routing was FREE — no API calls made
  };
}

// ── BATCH ESTIMATOR ─────────────────────────────────────────
// Estimate cost for N calls to the same skill.
export function estimateDailyCost(skillId, sampleInput, callsPerDay) {
  const firstCall  = route(skillId, sampleInput, { callNumber: 1 });
  const cachedCall = route(skillId, sampleInput, { callNumber: 2 });

  const firstCallCost  = parseFloat(firstCall.costBreakdown.totalCost.replace("$", ""));
  const cachedCallCost = parseFloat(cachedCall.costBreakdown.totalCost.replace("$", ""));

  const dailyCost = firstCallCost + (cachedCallCost * (callsPerDay - 1));

  return {
    skillId,
    callsPerDay,
    firstCallCost:  `$${firstCallCost.toFixed(6)}`,
    cachedCallCost: `$${cachedCallCost.toFixed(6)}`,
    dailyCost:      `$${dailyCost.toFixed(4)}`,
    monthlyCost:    `$${(dailyCost * 30).toFixed(2)}`,
    cacheSaving:    `${((1 - CACHE_READ_MULTIPLIER) * 100 * (firstCall.systemTokens / firstCall.totalTokens)).toFixed(0)}% on system tokens`,
  };
}

// ── DEMO / SELF-TEST ─────────────────────────────────────────
if (process.argv[1].endsWith("token-router.js")) {
  console.log("\n" + "═".repeat(60));
  console.log("  TOKEN ROUTER — Using pre-built library");
  console.log("  Zero API calls. Instant. Exact for system prompts.");
  console.log("═".repeat(60));

  const testCases = [
    {
      skillId:   "journey-step-classifier",
      userInput: "checkout | failure | 8743ms | anomaly:true | httpStatus:500 | paymentCharged:true",
      calls:     5000,
    },
    {
      skillId:   "bug-diagnoser",
      userInput: "APP-123 evidence: NPE at OrderProcessor.java:142, getDeliveryWindow() null, last commit by james.okafor changed vendor schema",
      calls:     200,
    },
    {
      skillId:   "acl-designer",
      userInput: "skill: order-monitor — monitors order processing errors and alerts on anomalies",
      calls:     50,
    },
    {
      skillId:   "pr-description-generator",
      userInput: "Changed OrderProcessor.java line 142 to add null check for deliveryWindow. Added unit tests. Updated vendor contract handling.",
      calls:     300,
    },
  ];

  for (const tc of testCases) {
    console.log(`\n${"─".repeat(60)}`);
    const decision = route(tc.skillId, tc.userInput);
    const daily    = estimateDailyCost(tc.skillId, tc.userInput, tc.calls);

    console.log(`  Skill:          ${decision.skillName}`);
    console.log(`  Model:          ${decision.model.toUpperCase()}`);
    if (decision.modelOverride) console.log(`  ⚠️  Override:   ${decision.modelOverride}`);
    console.log(`  System tokens:  ${decision.systemTokens}  (exact — from library)`);
    console.log(`  Variable tokens:${decision.variableTokens}  (estimated locally — no API call)`);
    console.log(`  Total:          ${decision.totalTokens} tokens`);
    console.log(`  Cache eligible: ${decision.cacheEligible ? "Yes ✅" : "No — below 1024 threshold"}`);
    console.log(`\n  Cost (call 1):  ${decision.costBreakdown.systemCost}`);
    console.log(`                  ${decision.costBreakdown.variableCost}`);
    console.log(`  Total call 1:   ${decision.costBreakdown.totalCost}`);
    console.log(`\n  At ${tc.calls.toLocaleString()} calls/day:`);
    console.log(`  Per cached call: ${daily.cachedCallCost}`);
    console.log(`  Daily total:     ${daily.dailyCost}`);
    console.log(`  Monthly total:   ${daily.monthlyCost}`);
    console.log(`  Cache saving:    ${daily.cacheSaving}`);
    console.log(`\n  API calls for routing: ${decision.apiCallsUsed} ← this is the point`);
  }

  console.log("\n\n" + "═".repeat(60));
  console.log("  COMPARISON: API Estimation vs Library vs Local Tokenizer");
  console.log("═".repeat(60));
  console.log(`
  APPROACH 1 — Call count_tokens API every time
    Latency:    +100-200ms per request
    Cost:       Haiku API call per estimation
    Accuracy:   Exact
    Offline:    No

  APPROACH 2 — Pre-built library (this file)
    Latency:    ~0ms (JSON lookup)
    Cost:       Zero at runtime
    Accuracy:   Exact for system prompts, ±15% for variable input
    Offline:    Yes — no network needed for routing
    Rebuild:    Only when skill system prompts change

  APPROACH 3 — Local open-source tokenizer (tiktoken / GPT)
    Latency:    ~0ms
    Cost:       Zero
    Accuracy:   ❌ WRONG for Claude — different vocabulary
                tiktoken uses GPT-4 BPE, not Claude's tokenizer
                Off by 5-20% — larger for code, unicode, special chars
    Offline:    Yes
    Risk:       At scale, systematic 15% undercount = wrong model
                selections that compound into real budget overruns

  APPROACH 4 — anthropic SDK countTokens (if available)
    Latency:    +100-200ms (still a network call)
    Cost:       Same as approach 1
    Accuracy:   Exact (same endpoint, same tokenizer)
    Offline:    No
    Note:       Same as approach 1, just wrapped in SDK

  WINNER: Library (Approach 2) for static parts
          Local estimate (chars/3.5) for variable parts
          Exact API count only when precision is critical
          (billing reconciliation, near-threshold decisions)
  `);
  console.log("═".repeat(60) + "\n");
}
