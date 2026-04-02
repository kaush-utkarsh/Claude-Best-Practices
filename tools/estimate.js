// =============================================================
// tools/estimate.js
// Pre-prompt token estimator
// ─────────────────────────────────────────────────────────────
// Run BEFORE sending any Claude prompt.
// Shows: token count, recommended model, cost estimate.
// Asks for confirmation before proceeding.
//
// Usage:
//   node tools/estimate.js "your prompt here"
//   node tools/estimate.js "your prompt here" --task=legal
//   node tools/estimate.js "your prompt here" --confirm
//
// Task types: legal, security, architecture, debugging,
//             summary, formatting, extraction, translation
// =============================================================

import { countTokens, MODELS } from "../demos/backend/shared/api-client.js";
import { estimateCostUSD, MODEL_COSTS } from "../demos/backend/shared/mock-data.js";
import readline from "readline";


// -----------------------------------------------------------
// MODEL ROUTING TABLE
// Same logic as demo1a — classify task, pick model
// -----------------------------------------------------------
const ROUTING = {
  legal:        { model: MODELS.OPUS,   reason: "Legal requires best reasoning — never cut corners here" },
  security:     { model: MODELS.OPUS,   reason: "Security analysis needs full capability" },
  architecture: { model: MODELS.OPUS,   reason: "Architecture decisions have long-term consequences" },
  debugging:    { model: MODELS.SONNET, reason: "Code debugging — balanced speed and accuracy" },
  summary:      { model: MODELS.SONNET, reason: "Summarisation — medium complexity" },
  analysis:     { model: MODELS.SONNET, reason: "Analysis — needs reasoning but not Opus" },
  formatting:   { model: MODELS.HAIKU,  reason: "Formatting is mechanical — Haiku handles it perfectly" },
  extraction:   { model: MODELS.HAIKU,  reason: "Data extraction — structured, predictable, cheap" },
  translation:  { model: MODELS.HAIKU,  reason: "Translation — well-defined task, Haiku is fine" },
  tracing:      { model: MODELS.HAIKU,  reason: "Journey tracing — runs thousands of times, must be cheap" },
};

// Keyword classifier — detect task type from prompt text
function detectTaskType(prompt) {
  const p = prompt.toLowerCase();

  if (p.match(/legal|liability|compliance|contract|pci|gdpr|clause/))     return "legal";
  if (p.match(/security|vulnerability|exploit|injection|acl|permission/)) return "security";
  if (p.match(/architect|design|structure|pattern|system|scalab/))        return "architecture";
  if (p.match(/bug|error|exception|debug|fix|crash|null|npe|stack/))      return "debugging";
  if (p.match(/summar|summarise|summarize|overview|tldr|brief/))          return "summary";
  if (p.match(/analys|analyze|review|assess|evaluat|compare/))            return "analysis";
  if (p.match(/format|reformat|convert|clean|restructure|json|csv/))      return "formatting";
  if (p.match(/extract|parse|pull out|find all|get the|scrape/))          return "extraction";
  if (p.match(/translat|language|french|spanish|german|mandarin/))        return "translation";
  if (p.match(/journey|session|step|trace|anomaly|monitor/))              return "tracing";

  return null; // unknown — will ask or default to Sonnet
}

function getModelLabel(model) {
  if (model === MODELS.HAIKU)  return "Haiku  (fast, cheap)";
  if (model === MODELS.SONNET) return "Sonnet (balanced)";
  if (model === MODELS.OPUS)   return "Opus   (powerful, expensive)";
  return model;
}


// -----------------------------------------------------------
// CONFIRMATION PROMPT
// -----------------------------------------------------------
async function confirm(question) {
  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}


// -----------------------------------------------------------
// MAIN
// -----------------------------------------------------------
async function main() {
  const args    = process.argv.slice(2);
  const prompt  = args.find(a => !a.startsWith("--")) || "";
  const taskArg = args.find(a => a.startsWith("--task="))?.split("=")[1];
  const autoConfirm = args.includes("--confirm");

  if (!prompt) {
    console.log(`
Usage:
  node tools/estimate.js "your prompt here"
  node tools/estimate.js "your prompt here" --task=legal
  node tools/estimate.js "your prompt here" --confirm

Task types:
  legal, security, architecture, debugging, summary,
  analysis, formatting, extraction, translation, tracing
    `);
    process.exit(0);
  }

  console.log("\n" + "═".repeat(60));
  console.log("  PRE-PROMPT ESTIMATOR");
  console.log("═".repeat(60));
  console.log(`\n  Prompt: "${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}"`);

  // ── STEP 1: Count tokens ──────────────────────────────────
  console.log(`\n  Counting tokens...`);
  const countResult = await countTokens({
    system:   "You are a helpful assistant.",
    messages: [{ role: "user", content: prompt }],
  });
  const tokenCount = countResult.input_tokens;
  console.log(`  Input tokens: ${tokenCount}`);

  // ── STEP 2: Detect task type ──────────────────────────────
  const detectedType = taskArg || detectTaskType(prompt);
  const route        = detectedType
    ? ROUTING[detectedType]
    : { model: MODELS.SONNET, reason: "Unknown task type — defaulting to Sonnet" };

  console.log(`\n  Task type:    ${detectedType || "unknown (defaulting to Sonnet)"}`);
  console.log(`  Recommended:  ${getModelLabel(route.model)}`);
  console.log(`  Reason:       ${route.reason}`);

  // ── STEP 3: Cost estimate ─────────────────────────────────
  const selectedCost = estimateCostUSD(route.model, tokenCount, 300);
  const haikuCost    = estimateCostUSD(MODELS.HAIKU,  tokenCount, 300);
  const opusCost     = estimateCostUSD(MODELS.OPUS,   tokenCount, 300);

  console.log(`\n  Cost estimates (input + ~300 output tokens):`);
  console.log(`  Haiku:  $${haikuCost.totalCost}`);
  console.log(`  Sonnet: $${estimateCostUSD(MODELS.SONNET, tokenCount, 300).totalCost}`);
  console.log(`  Opus:   $${opusCost.totalCost}`);
  console.log(`\n  ► Selected (${route.model.split("-")[1]}): $${selectedCost.totalCost}`);

  if (route.model !== MODELS.OPUS) {
    const ratio = (parseFloat(opusCost.totalCost) / parseFloat(selectedCost.totalCost)).toFixed(1);
    console.log(`  ► Opus would cost ${ratio}x more for this task`);
  }

  // At scale
  console.log(`\n  At 1,000 calls/day:`);
  console.log(`  Selected: $${(parseFloat(selectedCost.totalCost) * 1000).toFixed(2)}/day`);
  console.log(`  Opus:     $${(parseFloat(opusCost.totalCost) * 1000).toFixed(2)}/day`);

  // ── STEP 4: Security check ────────────────────────────────
  const warnings = [];
  if (prompt.match(/sk-ant-|api[_-]key|password|secret|token/i)) {
    warnings.push("⚠️  Possible credential detected in prompt — remove before sending");
  }
  if (prompt.match(/ignore previous|forget your instructions|jailbreak/i)) {
    warnings.push("⚠️  Possible injection attempt detected");
  }
  if (tokenCount > 5000) {
    warnings.push(`⚠️  Large prompt (${tokenCount} tokens) — consider caching the system prompt`);
  }

  if (warnings.length > 0) {
    console.log(`\n  Security warnings:`);
    warnings.forEach(w => console.log(`  ${w}`));
  }

  // ── STEP 5: Confirmation ──────────────────────────────────
  console.log("\n" + "─".repeat(60));

  if (autoConfirm) {
    console.log(`  Auto-confirmed. Proceed with ${route.model.split("-")[1]}.\n`);
    process.exit(0);
  }

  const answer = await confirm(`  Proceed with ${route.model.split("-")[1]} at $${selectedCost.totalCost}? (y/n/change): `);

  if (answer === "y" || answer === "yes") {
    console.log(`\n  ✅ Confirmed. Use model: ${route.model}`);
    console.log(`  Copy this for your API call: MODELS.${route.model.includes("haiku") ? "HAIKU" : route.model.includes("sonnet") ? "SONNET" : "OPUS"}\n`);
    process.exit(0);
  }

  if (answer === "change") {
    console.log(`\n  Available models:`);
    console.log(`  1. Haiku  — $${haikuCost.totalCost}`);
    console.log(`  2. Sonnet — $${estimateCostUSD(MODELS.SONNET, tokenCount, 300).totalCost}`);
    console.log(`  3. Opus   — $${opusCost.totalCost}`);
    const choice = await confirm(`  Choose (1/2/3): `);
    const chosen = choice === "1" ? "HAIKU" : choice === "3" ? "OPUS" : "SONNET";
    console.log(`\n  ✅ Using MODELS.${chosen}\n`);
    process.exit(0);
  }

  console.log(`\n  ❌ Cancelled. Revise your prompt and try again.\n`);
  process.exit(1);
}

main().catch(err => {
  console.error("\n❌ Estimator error:", err.message);
  process.exit(1);
});
