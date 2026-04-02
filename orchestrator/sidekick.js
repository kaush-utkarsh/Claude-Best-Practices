// =============================================================
// orchestrator/sidekick.js
// THE SIDEKICK REVEAL — hidden until minute 230
// ─────────────────────────────────────────────────────────────
// This file is opened for the first time at minute 230.
// The audience has spent 4 hours building 5 standalone demos.
// They are about to see all five live inside one system.
//
// Run: node orchestrator/sidekick.js
//
// One prompt fires everything:
// "Investigate order-sync failure APP-123, check logs,
//  identify root cause, plan fix, draft PR."
// =============================================================

import { callClaude, countTokens, MODELS } from "../demos/backend/shared/api-client.js";
import { executeTool, TOOL_SCHEMAS }        from "../demos/backend/shared/mock-executors.js";
import { estimateCostUSD, JOURNEY_EVENTS }  from "../demos/backend/shared/mock-data.js";


// =============================================================
// SECTION 1 — TRACE LOGGER
// Every action in Sidekick is logged with timestamp + duration.
// This is your audit trail — who did what, when, how long.
// =============================================================

const trace = [];

function log(section, event, detail = "") {
  const entry = {
    timestamp: new Date().toISOString(),
    section,
    event,
    detail,
  };
  trace.push(entry);

  const sectionPad = section.padEnd(20);
  const eventPad   = event.padEnd(22);
  console.log(`  [${sectionPad}] ${eventPad} ${detail ? `— ${detail}` : ""}`);
}

function printTraceHeader() {
  console.log("\n" + "═".repeat(64));
  console.log("  SIDEKICK — LIVE TRACE");
  console.log("  Every line below maps to a demo you built today.");
  console.log("═".repeat(64));
  console.log(`\n  ${"SECTION".padEnd(22)} ${"EVENT".padEnd(24)} DETAIL`);
  console.log(`  ${"─".repeat(60)}`);
}


// =============================================================
// SECTION 2 — SKILL REGISTRY
// Sidekick routes every prompt to a skill.
// Skills define: model preference, tools, ACL, system prompt.
// =============================================================

const SKILL_REGISTRY = {
  "bug-triage": {
    description:    "Investigate production issues — Jira + Kibana + Repo",
    preferredModel: MODELS.SONNET,
    tools:          ["get_jira_issue", "search_kibana_logs", "get_repo_context"],
    allowWrite:     false,
    systemPrompt:   `You are a senior Java/Spring Boot debugging expert embedded in Sidekick.
Investigate issues thoroughly. Gather evidence before drawing conclusions.
Always: identify root cause, pinpoint the exact file and line, suggest a fix.`,
  },

  "incident-responder": {
    description:    "Respond to incidents — read + write to Jira + GitHub",
    preferredModel: MODELS.SONNET,
    tools:          ["get_jira_issue", "search_kibana_logs", "get_repo_context",
                     "create_jira_comment", "create_github_pr"],
    allowWrite:     true,
    systemPrompt:   `You are an incident response assistant embedded in Sidekick.
After investigating, take action: document findings in Jira and draft a PR with the fix.`,
  },

  "journey-monitor": {
    description:    "Monitor user sessions for anomalies",
    preferredModel: MODELS.HAIKU,
    tools:          ["get_journey_events", "search_kibana_logs"],
    allowWrite:     false,
    systemPrompt:   `You are a user journey monitor. Classify each step and flag anomalies.`,
  },
};

function classifyIntent(prompt) {
  const p = prompt.toLowerCase();

  if (p.includes("investigate") || p.includes("debug") || p.includes("root cause")) {
    return p.includes("fix") || p.includes("pr") || p.includes("draft")
      ? "incident-responder"
      : "bug-triage";
  }

  if (p.includes("journey") || p.includes("session") || p.includes("user flow")) {
    return "journey-monitor";
  }

  return "bug-triage";
}


// =============================================================
// SECTION 3 + 4 — TOKEN COUNTER + MODEL SELECTOR
// ← DEMO 1: Count before you call. Route by complexity.
// =============================================================

async function selectModel(skill, systemPrompt, messages, tools) {
  log("TOKEN COUNTER", "counting tokens", "always on Haiku — never Opus");

  const countResult = await countTokens({ system: systemPrompt, messages, tools });
  const tokenCount  = countResult.input_tokens;
  const model       = SKILL_REGISTRY[skill].preferredModel;
  const cost        = estimateCostUSD(model, tokenCount);

  log("TOKEN COUNTER", "count complete",    `${tokenCount} input tokens`);
  log("MODEL SELECTOR", "model selected",   model.split("-")[1]);
  log("MODEL SELECTOR", "estimated cost",   `$${cost.totalCost}`);

  return { model, tokenCount };
}


// =============================================================
// SECTION 5 — ACL GATE
// ← DEMO 2: Skill-scoped permissions. Read vs write.
// =============================================================

const WRITE_TOOLS = ["create_jira_comment", "create_github_pr"];

function checkACL(skill, toolName) {
  const skillConfig = SKILL_REGISTRY[skill];

  if (!skillConfig.tools.includes(toolName)) {
    log("ACL GATE", "DENIED", `${skill} → ${toolName}`);
    throw new Error(`ACL DENIED — ${skill} cannot call ${toolName}`);
  }

  if (WRITE_TOOLS.includes(toolName) && !skillConfig.allowWrite) {
    log("ACL GATE", "DENIED (write)", `${skill} → ${toolName}`);
    throw new Error(`ACL DENIED — ${skill} does not have write permission`);
  }

  if (WRITE_TOOLS.includes(toolName)) {
    log("ACL GATE", "write approved", `${toolName} — logged for audit`);
  } else {
    log("ACL GATE", "passed", toolName);
  }

  return true;
}


// =============================================================
// SECTION 6 — TOOL LOOP
// ← DEMO 3: Claude selects tools. Sidekick executes them.
// =============================================================

const MAX_STEPS = 6;

async function runToolLoop(skill, systemPrompt, messages, tools) {
  log("TOOL LOOP", "starting", `max ${MAX_STEPS} steps`);

  let step       = 0;
  let stopReason = null;
  const model    = SKILL_REGISTRY[skill].preferredModel;

  while (step < MAX_STEPS) {
    step++;
    log("TOOL LOOP", `step ${step}`, "calling Claude...");

    const response = await callClaude({
      model,
      system:     systemPrompt,
      messages,
      tools,
      max_tokens: 1000,
    });

    stopReason = response.stop_reason;
    messages.push({ role: "assistant", content: response.content });

    if (stopReason === "end_turn") {
      log("TOOL LOOP", "complete", `finished in ${step} step(s)`);
      const finalText = response.content.find(b => b.type === "text");
      return { conclusion: finalText?.text, steps: step };
    }

    if (stopReason === "tool_use") {
      const toolUseBlocks = response.content.filter(b => b.type === "tool_use");

      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        log("TOOL LOOP", "tool requested", toolUse.name);

        // ACL check before every execution ← DEMO 2
        checkACL(skill, toolUse.name);

        // Execute ← control plane runs this, never Claude
        const result = await executeTool(toolUse.name, toolUse.input);
        log("TOOL LOOP", "tool executed", `${toolUse.name} → success`);

        toolResults.push({
          type:        "tool_result",
          tool_use_id: toolUse.id,
          content:     JSON.stringify(result),
        });
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  log("TOOL LOOP", "step limit hit", `graceful degradation at ${MAX_STEPS} steps`);
  return { conclusion: null, steps: step };
}


// =============================================================
// SECTION 7 — BUG TRIAGE CHAIN
// ← DEMO 4: Symptom → Evidence → Root Cause → Fix → Test
// =============================================================

async function runBugTriage(skill, issueId) {
  log("BUG TRIAGE", "starting", `${issueId}`);

  const skillConfig = SKILL_REGISTRY[skill];
  const tools       = TOOL_SCHEMAS.filter(t => skillConfig.tools.includes(t.name));
  const messages    = [{
    role:    "user",
    content: `Investigate ${issueId}. Check Jira, find ERROR logs in order-service, examine the code. Identify root cause and recommend fix.`,
  }];

  const { model } = await selectModel(skill, skillConfig.systemPrompt, messages, tools);

  log("BUG TRIAGE", "evidence gathering", "Jira + Kibana + Repo");
  const { conclusion, steps } = await runToolLoop(skill, skillConfig.systemPrompt, messages, tools);

  log("BUG TRIAGE", "complete", `${steps} steps — root cause identified`);
  return { conclusion, tools };
}


// =============================================================
// SECTION 8 — JOURNEY TRACE
// ← DEMO 5: Instrument every step. Flag anomalies. Haiku.
// =============================================================

async function runJourneyTrace(sessionId) {
  log("JOURNEY TRACER", "starting", `session ${sessionId}`);

  const events    = JOURNEY_EVENTS.filter(e => e.sessionId === sessionId);
  const anomalies = [];

  for (const event of events) {
    const response = await callClaude({
      model:  MODELS.HAIKU,   // ← cheapest. High frequency operation.
      system: `You are a journey monitor. Classify each step: NORMAL, SLOW, or ANOMALY.
Reply in one line: STATUS: [X] | NOTE: [one sentence]`,
      messages: [{
        role:    "user",
        content: `Step: ${event.step} | Status: ${event.status} | Duration: ${event.durationMs}ms | Anomaly: ${event.anomaly}`,
      }],
      max_tokens: 60,
    });

    const text   = response.content[0].text;
    const status = text.match(/STATUS:\s*(\w+)/)?.[1] || "UNKNOWN";

    if (status === "ANOMALY" || event.anomaly) {
      anomalies.push({ step: event.step, text });
      log("JOURNEY TRACER", `step: ${event.step}`, `⚠️  ANOMALY — ${event.step}`);
    } else {
      log("JOURNEY TRACER", `step: ${event.step}`, status);
    }
  }

  log("JOURNEY TRACER", "complete", `${anomalies.length} anomaly(s) found`);
  return { anomalies, eventCount: events.length };
}


// =============================================================
// SECTION 9 — MAIN ENTRYPOINT
// One prompt. Everything fires.
// This is what Sidekick looks like in production.
// =============================================================

async function sidekick(userPrompt) {
  const startTime = Date.now();

  // ── HEADER ────────────────────────────────────────────────
  console.log("\n" + "╔" + "═".repeat(62) + "╗");
  console.log("║  SIDEKICK — AI ORCHESTRATION LAYER" + " ".repeat(27) + "║");
  console.log("║  One prompt. Five systems. One trace." + " ".repeat(24) + "║");
  console.log("╚" + "═".repeat(62) + "╝");

  console.log(`\n  Prompt: "${userPrompt}"`);
  printTraceHeader();

  // ── STEP 1: CLASSIFY INTENT ───────────────────────────────
  const skill = classifyIntent(userPrompt);
  log("INTENT CLASSIFIER", "skill selected", skill);
  log("INTENT CLASSIFIER", "routing to",     SKILL_REGISTRY[skill].description);

  // ── STEP 2: BUG TRIAGE (Demos 1 + 2 + 3 + 4) ─────────────
  console.log(`\n  ${"─".repeat(60)}`);
  console.log(`  ← DEMO 1 (Token) + DEMO 2 (ACL) + DEMO 3 (Loop) + DEMO 4 (Triage)`);
  console.log(`  ${"─".repeat(60)}`);

  const { conclusion } = await runBugTriage(skill, "APP-123");

  // ── STEP 3: JOURNEY TRACE (Demo 5) ────────────────────────
  console.log(`\n  ${"─".repeat(60)}`);
  console.log(`  ← DEMO 5 (Journey Tracer)`);
  console.log(`  ${"─".repeat(60)}`);

  const { anomalies } = await runJourneyTrace("sess-7f3a9b");

  // ── STEP 4: WRITE ACTIONS (if skill allows) ───────────────
  if (SKILL_REGISTRY[skill].allowWrite) {
    console.log(`\n  ${"─".repeat(60)}`);
    console.log(`  ← DEMO 2 (ACL write gate) firing`);
    console.log(`  ${"─".repeat(60)}`);

    try {
      checkACL(skill, "create_jira_comment");
      await executeTool("create_jira_comment", {
        issue_id: "APP-123",
        comment:  `Sidekick investigation complete.\nRoot cause: ${conclusion?.slice(0, 200) || "NullPointerException at OrderProcessor.java:142"}\nFix: Add null check for deliveryWindow field.`,
      });
      log("WRITE ACTION", "jira comment added", "APP-123");

      checkACL(skill, "create_github_pr");
      await executeTool("create_github_pr", {
        title:  "fix: null check for optional deliveryWindow field",
        body:   `## Root Cause\nNullPointerException at OrderProcessor.java:142\n\n## Fix\nAdd null check for deliveryWindow field which became optional in vendor contract v2.4\n\n## Test\n- deliveryWindow = null → default to STANDARD\n- deliveryWindow = "AM" → use "AM"`,
        branch: "fix/order-processor-null-check",
      });
      log("WRITE ACTION", "github PR created", "fix/order-processor-null-check");
    } catch (err) {
      log("WRITE ACTION", "blocked by ACL", err.message.slice(0, 50));
    }
  }

  // ── FINAL REPORT ──────────────────────────────────────────
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n\n" + "╔" + "═".repeat(62) + "╗");
  console.log("║  SIDEKICK — INVESTIGATION COMPLETE" + " ".repeat(27) + "║");
  console.log("╠" + "═".repeat(62) + "╣");
  console.log(`║  Skill:           ${skill.padEnd(43)}║`);
  console.log(`║  Trace entries:   ${String(trace.length).padEnd(43)}║`);
  console.log(`║  Anomalies found: ${String(anomalies.length).padEnd(43)}║`);
  console.log(`║  Duration:        ${(duration + "s").padEnd(43)}║`);
  console.log(`║  Write actions:   ${(SKILL_REGISTRY[skill].allowWrite ? "Yes — Jira + GitHub PR" : "None — read-only skill").padEnd(43)}║`);
  console.log("╚" + "═".repeat(62) + "╝");

  console.log(`\n  Root cause summary:\n`);
  if (conclusion) {
    console.log(`  ${conclusion.slice(0, 400).replace(/\n/g, "\n  ")}`);
  }

  // ── THE CLOSING LINE ──────────────────────────────────────
  console.log("\n\n" + "─".repeat(64));
  console.log(`
  Token counter    — Demo 1
  ACL gate         — Demo 2
  Tool loop        — Demo 3
  Bug triage       — Demo 4
  Journey tracer   — Demo 5

  This is what it looks like when all five live in one system.
  The orchestrator didn't teach you anything new.
  You already built everything inside it.
  `);
  console.log("─".repeat(64) + "\n");
}


// =============================================================
// RUN — The reveal prompt
// =============================================================
sidekick(
  "Investigate order-sync failure APP-123, check logs, identify root cause, plan fix, draft PR."
).catch(err => {
  console.error("\n❌ Sidekick error:", err.message);
  process.exit(1);
});