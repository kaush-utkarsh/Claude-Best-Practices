// =============================================================
// demo1a-exercise.js
// EXERCISE: Token Optimization
// ─────────────────────────────────────────────────────────────
// Time:     10 minutes
// Goal:     Change the routing table. See the cost impact live.
// Run:      node demos/backend/demo1a-exercise.js
// =============================================================

import { callClaude, countTokens, MODELS } from "./shared/api-client.js";
import { estimateCostUSD } from "./shared/mock-data.js";


// -----------------------------------------------------------
// YOUR TASK
// The routing table below controls which model handles each task.
//
// EXERCISE 1 — Make it expensive:
//   Change "debugging" from MODELS.SONNET → MODELS.OPUS
//   Run the file. See the cost jump.
//
// EXERCISE 2 — Make it smart:
//   Change "formatting" from MODELS.HAIKU → MODELS.OPUS
//   Run again. Calculate: how much more does this cost per day?
//
// EXERCISE 3 — Restore sanity:
//   Put everything back to the original values.
//   What is the total cost difference between "naive" and "smart" routing?
// -----------------------------------------------------------

const ROUTING_TABLE = {
  // ↓ CHANGE THESE to experiment
  debugging:  { model: MODELS.SONNET, label: "Code debugging"    },  // try MODELS.OPUS
  formatting: { model: MODELS.HAIKU,  label: "Text formatting"   },  // try MODELS.OPUS
  legal:      { model: MODELS.OPUS,   label: "Legal analysis"    },  // leave this one
  extraction: { model: MODELS.HAIKU,  label: "Data extraction"   },  // leave this one
};

const TASKS = [
  {
    type:    "debugging",
    message: "Why does vendorPayload.getDeliveryWindow().toString() throw NullPointerException?",
    system:  "You are a Java debugging expert. Be concise.",
  },
  {
    type:    "formatting",
    message: "Reformat this: order_id=ORD-789, status=failed, service=order-service, error=NPE at line 142",
    system:  "You are a data formatter. Return clean JSON only.",
  },
  {
    type:    "legal",
    message: "Does a silent 500 error on a charged transaction expose us to PCI-DSS liability?",
    system:  "You are a legal and compliance expert. Be precise.",
  },
  {
    type:    "extraction",
    message: "Extract: timestamp, service, level, message from: 2026-04-01 10:28:11 ERROR [order-service] OrderProcessor: NullPointerException at line 142",
    system:  "Extract structured data. Return JSON only.",
  },
];

async function runExercise() {
  console.log("\n" + "═".repeat(60));
  console.log("  EXERCISE — Demo 1a: Token Routing");
  console.log("  Change the routing table. Watch the cost change.");
  console.log("═".repeat(60));

  let totalCost    = 0;
  let totalOpusCost = 0;

  for (const task of TASKS) {
    const route    = ROUTING_TABLE[task.type];
    const messages = [{ role: "user", content: task.message }];

    console.log(`\n${"─".repeat(60)}`);
    console.log(`  Task:   ${task.type}`);
    console.log(`  Model:  ${route.model.split("-")[1]} (${route.label})`);

    // Count tokens
    const count = await countTokens({ system: task.system, messages });
    console.log(`  Tokens: ${count.input_tokens}`);

    // Estimate cost
    const selected = estimateCostUSD(route.model, count.input_tokens);
    const opus     = estimateCostUSD(MODELS.OPUS, count.input_tokens);

    console.log(`  Cost (selected): $${selected.totalCost}`);
    if (route.model !== MODELS.OPUS) {
      console.log(`  Cost (if Opus):  $${opus.totalCost}  ← ${(parseFloat(opus.totalCost) / parseFloat(selected.totalCost)).toFixed(1)}x more expensive`);
    }

    totalCost     += parseFloat(selected.totalCost);
    totalOpusCost += parseFloat(opus.totalCost);

    // Call Claude with selected model
    const response = await callClaude({
      model:      route.model,
      system:     task.system,
      messages,
      max_tokens: 150,
    });

    console.log(`  Response: "${response.content[0].text.slice(0, 80).replace(/\n/g, " ")}..."`);
  }

  // Summary
  console.log("\n\n" + "═".repeat(60));
  console.log("  COST SUMMARY");
  console.log("═".repeat(60));
  console.log(`\n  Your routing total:  $${totalCost.toFixed(6)}`);
  console.log(`  All-Opus total:      $${totalOpusCost.toFixed(6)}`);
  console.log(`  Ratio:               ${(totalOpusCost / totalCost).toFixed(1)}x`);
  console.log(`\n  At 10,000 calls/day:`);
  console.log(`  Your routing: $${(totalCost * 10000).toFixed(2)}/day`);
  console.log(`  All Opus:     $${(totalOpusCost * 10000).toFixed(2)}/day`);
  console.log(`  Difference:   $${((totalOpusCost - totalCost) * 10000).toFixed(2)}/day`);

  console.log("\n\n" + "═".repeat(60));
  console.log("  REFLECTION QUESTIONS");
  console.log("═".repeat(60));
  console.log(`
  1. Which task type most benefits from being on a cheaper model?
  2. Which task type would you NEVER move to Haiku, regardless of cost?
  3. How would you route a task that's 3000 tokens but very simple?
  4. What's the difference between token count and task complexity?
  `);
  console.log("═".repeat(60) + "\n");
}

runExercise().catch(err => {
  console.error("\n❌ Exercise failed:", err.message);
  process.exit(1);
});
