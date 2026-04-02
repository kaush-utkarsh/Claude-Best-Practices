// =============================================================
// demo3-runner.js
// THE RUNNER — what you execute on session day
// ─────────────────────────────────────────────────────────────
// Responsibilities:
//   - Define scenarios
//   - Call the agent with goals + tools
//   - Handle the break-it demo
//   - Print the architecture lesson
//
// Run: node demos/backend/demo3-runner.js
// =============================================================

import { runAgent } from "./demo3-agent.js";
import { TOOL_SCHEMAS } from "./shared/mock-executors.js";


// -----------------------------------------------------------
// MAX STEPS
// ← Change to 1 for the break-it demo
// -----------------------------------------------------------
const MAX_STEPS = 5;


// -----------------------------------------------------------
// TOOLS AVAILABLE TO THE AGENT
// The agent can only use tools you give it.
// This is your control — not Claude's.
// -----------------------------------------------------------
const INVESTIGATION_TOOLS = TOOL_SCHEMAS.filter(t =>
  ["get_jira_issue", "search_kibana_logs", "get_repo_context"].includes(t.name)
);


// -----------------------------------------------------------
// SCENARIOS
// -----------------------------------------------------------
async function runDemo() {
  console.log("\n" + "═".repeat(60));
  console.log("  DEMO 3 — TOOL LOOP / AGENTIC BASICS");
  console.log("  Claude selects tools. Control plane executes them.");
  console.log(`  MAX_STEPS = ${MAX_STEPS}`);
  console.log("═".repeat(60));


  // ── SCENARIO 1: Simple goal — watch the agent start ──────
  console.log("\n\n🔵 SCENARIO 1 — Simple goal");
  console.log("  Watch the agent make its first decision.\n");

  await runAgent({
    goal:     "What is the current status of ticket APP-123?",
    tools:    INVESTIGATION_TOOLS,
    skill:    "bug-triage",
    maxSteps: MAX_STEPS,
  });


  // ── SCENARIO 2: Complex goal — agent chains tools ─────────
  console.log("\n\n🟡 SCENARIO 2 — Full investigation");
  console.log("  Agent chains tools autonomously to reach a conclusion.\n");

  await runAgent({
    goal:     `Investigate the order sync failure in APP-123.
Check the Jira ticket, find the relevant ERROR logs in order-service,
and look at the code. Give me the root cause and the fix.`,
    tools:    INVESTIGATION_TOOLS,
    skill:    "bug-triage",
    maxSteps: MAX_STEPS,
  });


  // ── BREAK IT + ARCHITECTURE ───────────────────────────────
  printBreakIt();
  printArchitecture();
}


// -----------------------------------------------------------
// BREAK IT
// -----------------------------------------------------------
function printBreakIt() {
  console.log("\n\n" + "═".repeat(60));
  console.log("  ⚠️  BREAK IT — Set MAX_STEPS = 1");
  console.log("═".repeat(60));
  console.log(`
  At the top of demo3-runner.js, change:
    const MAX_STEPS = 5;
  to:
    const MAX_STEPS = 1;

  Re-run Scenario 2. Watch what happens:

  - Agent fires one tool call
  - Gets cut off before Claude finishes reasoning
  - Graceful degradation banner appears — no crash
  - Partial evidence is still returned

  This is the lesson:
  ✅ Graceful degradation = partial result + retry option
  ❌ Hard throw         = raw error the user should never see

  In production: log the trace, notify the user, allow retry.
  `);
  console.log("═".repeat(60));
}


// -----------------------------------------------------------
// ARCHITECTURE LESSON
// -----------------------------------------------------------
function printArchitecture() {
  console.log("\n\n" + "═".repeat(60));
  console.log("  THE PATTERN — What just happened");
  console.log("═".repeat(60));
  console.log(`
  demo3-runner.js          demo3-agent.js            Claude
  ─────────────────        ──────────────────        ──────
  Define goal         →    Send to Claude        →   Reason
  Give tools          →    Receive tool_use      ←   Decide
                           Execute tool
                           Build evidence trail
                      ←    Feed result back      →   Reason again
                           Repeat until end_turn
  Receive report      ←    Print final report

  Two files. Two responsibilities. Clean separation.

  demo3-runner.js  =  Your control plane  (what, when, how many steps)
  demo3-agent.js   =  The agent loop      (execute, trace, report)
  Claude           =  The reasoning layer (decide, never execute)

  KEY RULES:
  1. Always set MAX_STEPS — infinite loops = infinite cost.
  2. Graceful degradation — never hard throw on step limit.
  3. One orchestrator. Narrow agents. Not one giant agent.
  4. The agent sees goals. Your runner controls the guardrails.
  `);
  console.log("═".repeat(60) + "\n");
}


// -----------------------------------------------------------
// RUN
// -----------------------------------------------------------
runDemo().catch(err => {
  console.error("\n❌ Demo failed:", err.message);
  process.exit(1);
});
