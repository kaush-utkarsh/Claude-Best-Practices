// =============================================================
// demo2-security.js
// DEMO 2: Security / ACL
// ─────────────────────────────────────────────────────────────
// Concept:  Read vs write tools. Skill-scoped ACL. Approval gates.
// Show:     TOOL_ACL table. checkACL() firing before every tool.
// Break it: Comment out checkACL(). Show what any skill can reach.
// Key rule: Claude never touches your APIs. You execute. You gate.
//           Biggest risk = your executor having no ACL.
// Runtime:  ~20 seconds
// Run:      node demos/backend/demo2-security.js
// =============================================================

import { callClaude, MODELS } from "./shared/api-client.js";
import { executeTool, TOOL_SCHEMAS } from "./shared/mock-executors.js";


// -----------------------------------------------------------
// TOOL ACL TABLE
// Every skill gets a list of tools it is allowed to call.
// Read tools = safe. Write tools = require explicit permission.
// This table lives in YOUR code — not in Claude.
// -----------------------------------------------------------
const TOOL_ACL = {
  "bug-triage": {
    allowed: ["get_jira_issue", "search_kibana_logs", "get_repo_context"],
    description: "Diagnose issues — read only",
  },
  "journey-tracer": {
    allowed: ["get_journey_events", "search_kibana_logs"],
    description: "Trace user journeys — read only",
  },
  "incident-responder": {
    allowed: ["get_jira_issue", "search_kibana_logs", "get_repo_context", "create_jira_comment"],
    description: "Respond to incidents — read + limited write",
  },
  "release-manager": {
    allowed: ["get_jira_issue", "get_repo_context", "create_jira_comment", "create_github_pr"],
    description: "Manage releases — read + write",
  },
};

// Write tools always require an extra approval gate
const WRITE_TOOLS = ["create_jira_comment", "create_github_pr", "count_affected_orders"];


// -----------------------------------------------------------
// ACL CHECK
// Called before EVERY tool execution.
// If this function isn't called — there is no security.
// That's exactly what the break-it demo shows.
// -----------------------------------------------------------
function checkACL(skill, toolName) {
  const skillACL = TOOL_ACL[skill];

  // 1. Does the skill exist?
  if (!skillACL) {
    throw new Error(`ACL DENIED — Unknown skill: "${skill}". No permissions defined.`);
  }

  // 2. Is the tool in the allowed list?
  if (!skillACL.allowed.includes(toolName)) {
    throw new Error(
      `ACL DENIED — Skill "${skill}" tried to call "${toolName}".\n` +
      `  Allowed tools: ${skillACL.allowed.join(", ")}`
    );
  }

  // 3. Is this a write tool? Require approval gate.
  if (WRITE_TOOLS.includes(toolName)) {
    console.log(`  ⚠️  WRITE TOOL DETECTED: "${toolName}"`);
    console.log(`      Skill "${skill}" has write permission — logging for audit.`);
    // In production: trigger human approval, send Slack alert, log to audit trail
  }

  return true;
}


// -----------------------------------------------------------
// SECURE TOOL EXECUTOR
// Wraps executeTool() with ACL check.
// This is what your control plane always calls — never raw executeTool().
// -----------------------------------------------------------
async function secureExecuteTool(skill, toolName, toolInput) {
  console.log(`\n  → Tool requested: "${toolName}" by skill "${skill}"`);

  // ACL CHECK — comment this out for the break-it demo
  checkACL(skill, toolName);

  console.log(`  ✅ ACL passed`);
  const result = await executeTool(toolName, toolInput);
  return result;
}


// -----------------------------------------------------------
// DEMO FLOW
// Two scenarios: one that passes ACL, one that gets blocked
// -----------------------------------------------------------
async function runDemo() {
  console.log("\n" + "═".repeat(60));
  console.log("  DEMO 2 — SECURITY / ACL");
  console.log("  Claude never touches your APIs. You execute. You gate.");
  console.log("═".repeat(60));


  // ── SHOW THE ACL TABLE ──────────────────────────────────
  console.log("\n📋 TOOL ACL TABLE:");
  console.log("─".repeat(60));
  for (const [skill, config] of Object.entries(TOOL_ACL)) {
    console.log(`\n  Skill: "${skill}"`);
    console.log(`  Desc:  ${config.description}`);
    console.log(`  Tools: ${config.allowed.join(", ")}`);
  }
  console.log("\n" + "─".repeat(60));


  // ── SCENARIO 1: Allowed call ────────────────────────────
  console.log("\n\n🔵 SCENARIO 1: bug-triage reads Jira (should PASS)");
  console.log("─".repeat(60));

  try {
    const result = await secureExecuteTool(
      "bug-triage",        // skill
      "get_jira_issue",    // tool Claude requested
      { issue_id: "APP-123" }
    );
    console.log(`\n  Result: "${result.summary}"`);
    console.log(`  Status: ${result.status} | Priority: ${result.priority}`);
  } catch (err) {
    console.log(`\n  ❌ ${err.message}`);
  }


  // ── SCENARIO 2: Blocked call ────────────────────────────
  console.log("\n\n🔴 SCENARIO 2: bug-triage tries to create a PR (should BLOCK)");
  console.log("─".repeat(60));
  console.log("  bug-triage is a READ-ONLY skill.");
  console.log("  It should never be able to push code.\n");

  try {
    const result = await secureExecuteTool(
      "bug-triage",         // skill — read only
      "create_github_pr",   // write tool — not in its ACL
      { title: "Fix: null check", body: "Added null check for deliveryWindow" }
    );
    console.log(`  Result: ${JSON.stringify(result)}`);
  } catch (err) {
    console.log(`  ❌ BLOCKED: ${err.message}`);
  }


  // ── SCENARIO 3: Write tool with approval gate ───────────
  console.log("\n\n🟡 SCENARIO 3: incident-responder adds Jira comment (WRITE — needs gate)");
  console.log("─".repeat(60));
  console.log("  incident-responder has write permission for create_jira_comment.");
  console.log("  Watch the approval gate fire.\n");

  try {
    const result = await secureExecuteTool(
      "incident-responder",
      "create_jira_comment",
      {
        issue_id: "APP-123",
        comment:  "Root cause identified: NullPointerException at OrderProcessor.java:142. Fix in progress.",
      }
    );
    console.log(`\n  ✅ Comment added: ${result.commentId}`);
  } catch (err) {
    console.log(`\n  ❌ ${err.message}`);
  }


  // ── REAL CLAUDE CALL — ACL IN ACTION ───────────────────
  console.log("\n\n🤖 LIVE: Claude requests a tool — ACL gates it before execution");
  console.log("─".repeat(60));

  const tools = TOOL_SCHEMAS.filter(t =>
    ["get_jira_issue", "search_kibana_logs"].includes(t.name)
  );

  const response = await callClaude({
    model:   MODELS.SONNET,
    system:  "You are a bug triage assistant. Use tools to investigate issues.",
    messages: [{
      role:    "user",
      content: "Investigate APP-123. Check the Jira ticket first.",
    }],
    tools,
    max_tokens: 300,
  });

  console.log(`\n  Claude stop_reason: ${response.stop_reason}`);

  if (response.stop_reason === "tool_use") {
    const toolUse = response.content.find(b => b.type === "tool_use");
    console.log(`  Claude wants to call: "${toolUse.name}"`);
    console.log(`  With input: ${JSON.stringify(toolUse.input)}`);

    // ACL gate fires HERE — before executing
    try {
      const toolResult = await secureExecuteTool("bug-triage", toolUse.name, toolUse.input);
      console.log(`\n  ✅ Tool executed. Result summary: "${toolResult.summary || JSON.stringify(toolResult).slice(0, 80)}"`);
    } catch (err) {
      console.log(`\n  ❌ BLOCKED by ACL: ${err.message}`);
    }
  }


  // ── BREAK IT INSTRUCTIONS ──────────────────────────────
  printBreakIt();
}


// -----------------------------------------------------------
// BREAK IT — show the audience what removing ACL looks like
// -----------------------------------------------------------
function printBreakIt() {
  console.log("\n\n" + "═".repeat(60));
  console.log("  ⚠️  BREAK IT — Remove the ACL check");
  console.log("═".repeat(60));
  console.log(`
  In secureExecuteTool(), comment out this line:
  
    // checkACL(skill, toolName);   ← comment this out

  Then re-run. Watch what happens:
  - bug-triage can now call create_github_pr
  - Any skill reaches any tool
  - Claude's tool choice becomes your security boundary
  
  That's the risk. Claude is not your security layer.
  YOUR executor is. And right now it has no gate.

  KEY RULE:
  Claude never touches your APIs. You execute. You gate.
  The biggest risk = your executor having no ACL.
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
