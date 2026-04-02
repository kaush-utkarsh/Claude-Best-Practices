// =============================================================
// demo3-exercise.js
// EXERCISE: Tool Loop / Agentic Basics
// ─────────────────────────────────────────────────────────────
// Time:     10 minutes
// Goal:     Change MAX_STEPS. Reason with partial evidence.
// Run:      node demos/backend/demo3-exercise.js
// =============================================================

import { runAgent } from "./demo3-agent.js";
import { TOOL_SCHEMAS } from "./shared/mock-executors.js";


// -----------------------------------------------------------
// YOUR TASKS
//
// EXERCISE 1 — Starve the agent:
//   Change MAX_STEPS to 1.
//   Run it. What single piece of evidence did the agent gather?
//   Could you make a decision based on that alone?
//
// EXERCISE 2 — Give it one more step:
//   Change MAX_STEPS to 2.
//   Run it. What two pieces of evidence do you have now?
//   Is that enough to identify the root cause?
//
// EXERCISE 3 — Find the minimum:
//   What is the MINIMUM number of steps needed to get
//   a useful answer for this specific bug?
//   Hint: try 3. Is that enough?
//
// EXERCISE 4 — Add a new tool:
//   The agent currently has: get_jira_issue, search_kibana_logs,
//   get_repo_context.
//   Remove get_repo_context from INVESTIGATION_TOOLS below.
//   Can the agent still identify the root cause without the code?
// -----------------------------------------------------------

const MAX_STEPS = 5;  // ← CHANGE THIS for exercises 1, 2, 3


// ← EXERCISE 4: remove "get_repo_context" from this list
const INVESTIGATION_TOOLS = TOOL_SCHEMAS.filter(t =>
  ["get_jira_issue", "search_kibana_logs", "get_repo_context"].includes(t.name)
);


async function runExercise() {
  console.log("\n" + "═".repeat(60));
  console.log("  EXERCISE — Demo 3: Tool Loop");
  console.log(`  MAX_STEPS = ${MAX_STEPS}`);
  console.log(`  Tools available: ${INVESTIGATION_TOOLS.map(t => t.name).join(", ")}`);
  console.log("═".repeat(60));

  console.log("\n  Running agent with current settings...\n");

  const result = await runAgent({
    goal: `Investigate the order sync failure in APP-123.
Check the Jira ticket, find ERROR logs in order-service, and look at the code.
Give me the root cause and the fix.`,
    tools:    INVESTIGATION_TOOLS,
    skill:    "bug-triage",
    maxSteps: MAX_STEPS,
  });

  // Evidence summary
  console.log("\n\n" + "═".repeat(60));
  console.log("  EVIDENCE GATHERED");
  console.log("═".repeat(60));
  console.log(`\n  Steps taken:    ${result.steps}`);
  console.log(`  Evidence items: ${result.evidence.length}`);

  if (result.evidence.length > 0) {
    console.log(`\n  What the agent found:`);
    result.evidence.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.label} — ${e.summary}`);
    });
  } else {
    console.log(`\n  No evidence gathered — MAX_STEPS too low.`);
  }

  if (!result.conclusion) {
    console.log(`\n  ⚠️  Agent did not reach a conclusion.`);
    console.log(`  Partial evidence only. Increase MAX_STEPS to get more.`);
  }

  // Reflection
  console.log("\n\n" + "═".repeat(60));
  console.log("  REFLECTION QUESTIONS");
  console.log("═".repeat(60));
  console.log(`
  With MAX_STEPS = ${MAX_STEPS} and ${result.evidence.length} evidence item(s):

  1. Could you identify the root cause from this evidence alone?
     What's missing? What assumption would you have to make?

  2. What's the cost of getting it wrong with partial evidence?
     (Wrong fix deployed, time wasted, bug persists)

  3. What's the cost of running 2 more steps to get full evidence?
     (Hint: check the token cost in the trace above)

  4. What would graceful degradation look like in your Sidekick?
     What should the user see when MAX_STEPS is hit?

  5. If you removed get_repo_context from the tool list —
     could the agent still find the bug? What would it miss?
  `);
  console.log("═".repeat(60) + "\n");
}

runExercise().catch(err => {
  console.error("\n❌ Exercise failed:", err.message);
  process.exit(1);
});
