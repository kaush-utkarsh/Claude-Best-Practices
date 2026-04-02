// =============================================================
// demo5-exercise.js
// EXERCISE: Journey Tracer
// ─────────────────────────────────────────────────────────────
// Time:     10 minutes
// Goal:     Add a new step. See Claude classify it.
// Run:      node demos/backend/demo5-exercise.js
// =============================================================

import { callClaude, MODELS } from "./shared/api-client.js";
import { JOURNEY_EVENTS } from "./shared/mock-data.js";


// -----------------------------------------------------------
// YOUR TASKS
//
// EXERCISE 1 — Add a payment step:
//   A "payment" step is missing between checkout and confirm.
//   Add it to EXTRA_STEPS below with:
//     - status: "success"
//     - durationMs: 2100   (just over the 2000ms slow threshold)
//     - metadata: { gateway: "stripe", charged: true }
//   Run it. Does Claude flag it as SLOW or NORMAL?
//
// EXERCISE 2 — Make it fail:
//   Change the payment step status to "failure".
//   Add anomaly: true to the step.
//   Add httpStatus: 402 and errorShown: true to metadata.
//   Run it. What action does Claude recommend?
//
// EXERCISE 3 — Add your own step:
//   Think about your real app. What user steps happen between
//   login and checkout that aren't tracked here?
//   Add one. What metadata would you capture?
//   What would make Claude flag it as anomalous?
// -----------------------------------------------------------

// ── ADD YOUR EXTRA STEPS HERE ─────────────────────────────────
// These are inserted between checkout (step 4) and confirm (step 5).
// stepNumber will be recalculated automatically.

const EXTRA_STEPS = [
  // ← EXERCISE 1: uncomment and fill in this step
  // {
  //   sessionId:  "sess-7f3a9b",
  //   userId:     "USR-442",
  //   step:       "payment",
  //   durationMs: 2100,          // just over slow threshold
  //   status:     "success",     // change to "failure" for exercise 2
  //   anomaly:    false,         // change to true for exercise 2
  //   metadata: {
  //     gateway:     "stripe",
  //     charged:     true,
  //     // add httpStatus: 402 and errorShown: true for exercise 2
  //   },
  // },
];


// ── BUILD THE FULL JOURNEY ────────────────────────────────────
function buildJourney() {
  // Original events split at the insertion point
  const before = JOURNEY_EVENTS.slice(0, 4);  // login, search, add_to_cart, checkout
  const after  = JOURNEY_EVENTS.slice(4);      // confirm

  // Combine with extra steps inserted between checkout and confirm
  const full = [...before, ...EXTRA_STEPS, ...after];

  // Recalculate step numbers
  return full.map((e, i) => ({ ...e, stepNumber: i + 1 }));
}


// ── ANNOTATOR (same as demo5) ─────────────────────────────────
async function annotateStep(event, totalSteps) {
  const response = await callClaude({
    model:  MODELS.HAIKU,
    system: `You are a user journey monitor for an e-commerce platform.
Classify each step in exactly this format:

STATUS: [NORMAL | SLOW | ANOMALY]
NOTE: [one sentence — what happened and why it matters]
ACTION: [NONE | INVESTIGATE | ALERT]

Rules:
- NORMAL: step completed successfully within expected duration
- SLOW: step completed but took longer than expected (>2000ms)
- ANOMALY: step failed, was skipped, or has suspicious signals
- If payment was charged but order failed → always ANOMALY + ALERT
- If payment failed with HTTP 402 → ANOMALY + ALERT
- Keep NOTE under 20 words`,
    messages: [{
      role:    "user",
      content: `Step: ${event.step} | Step #: ${event.stepNumber} of ${totalSteps} | Status: ${event.status} | Duration: ${event.durationMs ? event.durationMs + "ms" : "not reached"} | Anomaly: ${event.anomaly || false} | Metadata: ${JSON.stringify(event.metadata || {})}`,
    }],
    max_tokens: 80,
  });

  return response.content[0].text.trim();
}

function parseAnnotation(text) {
  return {
    status: text.match(/STATUS:\s*(\w+)/)?.[1]  || "UNKNOWN",
    note:   text.match(/NOTE:\s*(.+)/)?.[1]     || "",
    action: text.match(/ACTION:\s*(\w+)/)?.[1]  || "NONE",
  };
}

function statusIcon(status, eventStatus) {
  if (eventStatus === "not_reached") return "⏳";
  if (status === "ANOMALY") return "❌";
  if (status === "SLOW")    return "🐢";
  return "✅";
}


// ── EXERCISE RUNNER ───────────────────────────────────────────
async function runExercise() {
  console.log("\n" + "═".repeat(60));
  console.log("  EXERCISE — Demo 5: Journey Tracer");
  console.log("═".repeat(60));

  const journey    = buildJourney();
  const totalSteps = journey.length;

  console.log(`\n  Journey has ${totalSteps} steps:`);
  journey.forEach(e => console.log(`  ${e.stepNumber}. ${e.step}`));
  console.log(`\n  Tracing...\n`);

  const results = [];

  for (const event of journey) {
    const annotation = await annotateStep(event, totalSteps);
    const parsed     = parseAnnotation(annotation);
    results.push({ event, parsed });

    const icon     = statusIcon(parsed.status, event.status);
    const duration = event.durationMs ? `${(event.durationMs / 1000).toFixed(2)}s` : "—";

    console.log(`${"─".repeat(60)}`);
    console.log(`  ${icon}  Step ${event.stepNumber}: ${event.step.toUpperCase()}`);
    console.log(`  Duration: ${duration} | Status: ${event.status}`);
    if (event.anomaly) console.log(`  ⚠️  Anomaly flag: TRUE`);
    console.log(`  Claude: ${parsed.status} — ${parsed.note}`);
    console.log(`  Action: ${parsed.action}`);
    if (parsed.action === "ALERT") console.log(`  🚨 ALERT TRIGGERED`);
    console.log();

    await new Promise(r => setTimeout(r, 200));
  }

  // Summary
  const alerts   = results.filter(r => r.parsed.action === "ALERT").length;
  const anomalies = results.filter(r => r.parsed.status === "ANOMALY").length;
  const slow      = results.filter(r => r.parsed.status === "SLOW").length;

  console.log("═".repeat(60));
  console.log(`  JOURNEY SUMMARY — ${totalSteps} steps`);
  console.log("═".repeat(60));
  console.log(`  ANOMALY: ${anomalies} | SLOW: ${slow} | ALERTS: ${alerts}`);

  // Reflection
  console.log("\n\n" + "═".repeat(60));
  console.log("  REFLECTION QUESTIONS");
  console.log("═".repeat(60));
  console.log(`
  After adding the payment step:

  1. With durationMs: 2100 — did Claude flag it as SLOW or NORMAL?
     Is 2100ms actually slow for a payment gateway? Should the
     threshold be different per step type?

  2. After making it fail (status: failure, httpStatus: 402) —
     what action did Claude recommend? Was that the right one?

  3. Think about your real app:
     What steps are happening that you're NOT currently tracking?
     What anomalies are you missing because you don't instrument them?

  4. What's the minimum metadata you'd need per step to make
     Claude's classification reliable in your production system?
  `);
  console.log("═".repeat(60) + "\n");
}

runExercise().catch(err => {
  console.error("\n❌ Exercise failed:", err.message);
  process.exit(1);
});
