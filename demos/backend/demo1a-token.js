// =============================================================
// demo1-token.js
// DEMO 1: Token Optimization
// ─────────────────────────────────────────────────────────────
// Concept:  Count before you call. Route by complexity not size.
// Show:     estimateTokens() — always count on Haiku, never Opus
// Break it: Force Opus on everything. Show cost delta in trace.
// Key rule: Token count ≠ task complexity.
//           200-token legal task needs Opus.
//           2000-token formatting task is fine on Haiku.
// Runtime:  ~30 seconds
// Run:      node demos/backend/demo1-token.js
// =============================================================

import { callClaude, countTokens, MODELS } from "./shared/api-client.js";
import { estimateCostUSD, MODEL_COSTS } from "./shared/mock-data.js";


// -----------------------------------------------------------
// ROUTING RULES
// This is your control plane making model decisions.
// Claude never sees this logic — it just receives the call.
// -----------------------------------------------------------
const ROUTING_RULES = {
  // High complexity — needs best reasoning
  legal:      { model: MODELS.OPUS,   label: "Legal / compliance"       },
  security:   { model: MODELS.OPUS,   label: "Security analysis"        },
  architecture:{ model: MODELS.OPUS,  label: "Architecture decisions"   },

  // Medium complexity — balanced
  debugging:  { model: MODELS.SONNET, label: "Code debugging"           },
  summary:    { model: MODELS.SONNET, label: "Document summarisation"   },

  // Low complexity — fast and cheap
  formatting: { model: MODELS.HAIKU,  label: "Text formatting"          },
  extraction: { model: MODELS.HAIKU,  label: "Data extraction"          },
  translation:{ model: MODELS.HAIKU,  label: "Simple translation"       },
};

function selectModel(taskType, tokenCount) {
  const rule = ROUTING_RULES[taskType];
  if (!rule) return { model: MODELS.SONNET, label: "Default (unknown task type)" };

  // KEY INSIGHT: token count alone is not enough.
  // A 200-token legal question still needs Opus.
  // A 3000-token formatting job is still fine on Haiku.
  return rule;
}


// -----------------------------------------------------------
// TASK SAMPLES
// Four tasks — different types, different token sizes.
// Watch how routing ignores token count and uses task type.
// -----------------------------------------------------------
const TASKS = [
  {
    id:       1,
    type:     "legal",
    label:    "Short legal question",
    system:   "You are a legal assistant. Be precise and cite risks clearly.",
    message:  "Does our vendor contract clause 4.2 expose us to liability if deliveryWindow is null?",
    note:     "Small token count — but needs Opus. Complexity ≠ size.",
  },
  {
    id:       2,
    type:     "formatting",
    label:    "Large formatting task",
    system:   "You are a data formatter. Return clean JSON only.",
    message:  `Reformat this order data into clean JSON:\n` +
              `Order ID: ORD-789, Customer: USR-442, Items: wireless headphones x1 @ £129.99, ` +
              `Status: failed, Service: order-service, Trace: abc123, ` +
              `Error: NullPointerException at OrderProcessor.java:142, ` +
              `Timestamp: 2026-04-01T10:28:11.203Z, Payment: charged, Confirmation: not sent, ` +
              `DeliveryWindow: null, VendorRef: VND-9921, Region: GB, Currency: GBP, ` +
              `ShippingAddress: 42 Example Street London E1 4AB, Priority: standard, ` +
              `Retry: false, AlertSent: false, SupportTicket: APP-123`.repeat(3),
    note:     "Large token count — but Haiku is fine. It's just reformatting.",
  },
  {
    id:       3,
    type:     "debugging",
    label:    "Code debugging",
    system:   "You are a Java expert. Identify bugs and suggest fixes concisely.",
    message:  `Why does this throw NullPointerException?\n` +
              `String window = vendorPayload.getDeliveryWindow().toString();\n` +
              `The deliveryWindow field became optional in our last vendor contract update.`,
    note:     "Medium complexity — Sonnet is the right balance.",
  },
  {
    id:       4,
    type:     "extraction",
    label:    "Log data extraction",
    system:   "Extract structured data from log entries. Return JSON only.",
    message:  `Extract: timestamp, service, level, and error message from this log:\n` +
              `2026-04-01 10:28:11.203 ERROR [order-service,abc123,def456] ` +
              `c.example.orders.OrderProcessor : Failed to process order ORD-789 ` +
              `- NullPointerException at OrderProcessor.java:142`,
    note:     "Simple extraction — Haiku handles this perfectly.",
  },
];


// -----------------------------------------------------------
// MAIN DEMO FLOW
// -----------------------------------------------------------
async function runDemo() {
  console.log("\n" + "═".repeat(60));
  console.log("  DEMO 1 — TOKEN OPTIMIZATION");
  console.log("  Count before you call. Route by complexity not size.");
  console.log("═".repeat(60));

  const results = [];

  for (const task of TASKS) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`Task ${task.id}: ${task.label}`);
    console.log(`Type: ${task.type}`);
    console.log(`Note: ${task.note}`);

    const messages = [{ role: "user", content: task.message }];

    // ── STEP 1: Count tokens (always on Haiku — never Opus) ──
    console.log(`\n  [1] Counting tokens on Haiku...`);
    const countResult = await countTokens({
      system:   task.system,
      messages,
    });
    const tokenCount = countResult.input_tokens;
    console.log(`      Input tokens: ${tokenCount}`);

    // ── STEP 2: Select model based on task type ──
    const { model, label: modelLabel } = selectModel(task.type, tokenCount);
    console.log(`\n  [2] Model selected: ${model}`);
    console.log(`      Reason: ${modelLabel}`);

    // ── STEP 3: Estimate cost for selected model vs Opus ──
    const selectedCost = estimateCostUSD(model, tokenCount);
    const opusCost     = estimateCostUSD(MODELS.OPUS, tokenCount);
    console.log(`\n  [3] Cost estimate:`);
    console.log(`      Selected (${model.split("-")[1]}): $${selectedCost.totalCost}`);
    if (model !== MODELS.OPUS) {
      console.log(`      If Opus instead:             $${opusCost.totalCost}`);
      const ratio = (parseFloat(opusCost.totalCost) / parseFloat(selectedCost.totalCost)).toFixed(1);
      console.log(`      Savings: ${ratio}x cheaper by routing correctly`);
    }

    // ── STEP 4: Call Claude with the selected model ──
    console.log(`\n  [4] Calling Claude (${model})...`);
    const response = await callClaude({
      model,
      system:     task.system,
      messages,
      max_tokens: 200,
    });

    const reply = response.content[0].text;
    console.log(`\n  [5] Response (${response.usage.output_tokens} output tokens):`);
    console.log(`      ${reply.slice(0, 120).replace(/\n/g, " ")}...`);

    results.push({ task: task.label, tokenCount, model, selectedCost, opusCost });
  }

  // ── SUMMARY TABLE ──
  printSummary(results);

  // ── BREAK IT: what if you always used Opus? ──
  printBreakIt(results);
}


// -----------------------------------------------------------
// SUMMARY TABLE
// -----------------------------------------------------------
function printSummary(results) {
  console.log("\n\n" + "═".repeat(60));
  console.log("  SUMMARY — ROUTING DECISIONS");
  console.log("═".repeat(60));
  console.log(
    "  Task".padEnd(32) +
    "Tokens".padEnd(10) +
    "Model".padEnd(12) +
    "Cost ($)"
  );
  console.log("  " + "─".repeat(56));

  for (const r of results) {
    const modelShort = r.model.includes("haiku")  ? "Haiku"
                     : r.model.includes("sonnet") ? "Sonnet"
                     : "Opus";
    console.log(
      `  ${r.task.slice(0, 30).padEnd(32)}` +
      `${r.tokenCount}`.padEnd(10) +
      modelShort.padEnd(12) +
      `$${r.selectedCost.totalCost}`
    );
  }
}


// -----------------------------------------------------------
// BREAK IT — what if you routed everything to Opus?
// This is the "bad implementation" you show the audience.
// -----------------------------------------------------------
function printBreakIt(results) {
  console.log("\n\n" + "═".repeat(60));
  console.log("  ⚠️  BREAK IT — What if every call went to Opus?");
  console.log("═".repeat(60));

  let smartTotal = 0;
  let naiveTotal = 0;

  for (const r of results) {
    smartTotal += parseFloat(r.selectedCost.totalCost);
    naiveTotal += parseFloat(r.opusCost.totalCost);
  }

  console.log(`\n  Smart routing total:  $${smartTotal.toFixed(6)}`);
  console.log(`  Always-Opus total:    $${naiveTotal.toFixed(6)}`);
  console.log(`  Ratio:                ${(naiveTotal / smartTotal).toFixed(1)}x more expensive`);
  console.log(`\n  At 10,000 calls/day:`);
  console.log(`  Smart:  $${(smartTotal * 10000).toFixed(2)}/day`);
  console.log(`  Naive:  $${(naiveTotal * 10000).toFixed(2)}/day`);
  console.log(`  Saving: $${((naiveTotal - smartTotal) * 10000).toFixed(2)}/day`);

  console.log("\n" + "═".repeat(60));
  console.log("  KEY RULE:");
  console.log("  Token count ≠ task complexity.");
  console.log("  A 200-token legal question needs Opus.");
  console.log("  A 3000-token formatting job runs fine on Haiku.");
  console.log("  Count first. Route by what the task IS — not how big it is.");
  console.log("═".repeat(60) + "\n");
}


// -----------------------------------------------------------
// RUN
// -----------------------------------------------------------
runDemo().catch(err => {
  console.error("\n❌ Demo failed:", err.message);
  process.exit(1);
});
