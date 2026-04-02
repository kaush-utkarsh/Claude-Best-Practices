// =============================================================
// demo3-agent.js
// THE AGENT CORE — does not interact with user directly
// ─────────────────────────────────────────────────────────────
// Responsibilities:
//   - Run the tool loop
//   - Print decision banners at each step
//   - Maintain and display the evidence trail
//   - Print the final agent report
//
// Called by: demo3-runner.js
// Never run this file directly.
// =============================================================

import { callClaude, MODELS } from "./shared/api-client.js";
import { executeTool } from "./shared/mock-executors.js";


// -----------------------------------------------------------
// AGENT
// Main export. Called by the runner with a goal and tools.
// -----------------------------------------------------------
export async function runAgent({ goal, tools, skill = "bug-triage", maxSteps = 5 }) {

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  🤖 AGENT STARTING`);
  console.log(`  Goal: "${goal}"`);
  console.log(`  Skill: ${skill} | Max steps: ${maxSteps}`);
  console.log(`${"═".repeat(60)}`);

  const messages  = [{ role: "user", content: goal }];
  const evidence  = [];   // grows with each tool result
  const toolsUsed = [];   // tracks which tools fired

  let step             = 0;
  let stopReason       = null;
  let lastPrintedCount = 0;  // tracks last evidence count we printed

  // ── THE LOOP ──────────────────────────────────────────────
  while (step < maxSteps) {
    step++;

    // 1. Call Claude
    const response = await callClaude({
      model:   MODELS.SONNET,
      system:  `You are an autonomous bug investigation agent for a Java Spring Boot e-commerce platform.
You have access to Jira, Kibana logs, and the code repository.
Investigate thoroughly — gather evidence before drawing conclusions.
At each step, briefly explain your reasoning before calling a tool.
When you have gathered enough evidence, provide a structured root cause analysis.`,
      messages,
      tools,
      max_tokens: 1000,
    });

    stopReason = response.stop_reason;
    messages.push({ role: "assistant", content: response.content });

    // Extract Claude's reasoning text (if any — often precedes tool call)
    const reasoningText = response.content
      .filter(b => b.type === "text")
      .map(b => b.text.trim())
      .join(" ")
      .slice(0, 120);

    // 2. Done — print final report and exit
    if (stopReason === "end_turn") {
      const finalText = response.content.find(b => b.type === "text");
      printFinalReport({ step, toolsUsed, evidence, conclusion: finalText?.text });
      return { steps: step, stopReason, evidence, conclusion: finalText?.text };
    }

    // 3. Tool use — extract tools Claude wants, print banner, execute
    if (stopReason === "tool_use") {
      const toolUseBlocks = response.content.filter(b => b.type === "tool_use");

      for (const toolUse of toolUseBlocks) {
        // ── DECISION BANNER ──
        printDecisionBanner({
          step,
          maxSteps,
          toolName: toolUse.name,
          reason:   reasoningText || "Gathering evidence...",
        });

        // ── EXECUTE TOOL ──
        const result = await executeTool(toolUse.name, toolUse.input);
        toolsUsed.push(toolUse.name);

        // ── ADD TO EVIDENCE TRAIL ──
        const evidenceItem = buildEvidenceItem(toolUse.name, toolUse.input, result);
        evidence.push(evidenceItem);
      }

      // ── SHOW EVIDENCE TRAIL ONCE — only if new evidence was added ──
      if (evidence.length > lastPrintedCount) {
        printEvidenceTrail(evidence);
        lastPrintedCount = evidence.length;
      }

      // Feed results back to Claude using evidence we already collected
      const toolUseList = response.content.filter(b => b.type === "tool_use");
      const toolResultsFromEvidence = toolUseList.map((toolUse, i) => ({
        type:        "tool_result",
        tool_use_id: toolUse.id,
        content:     evidence[evidence.length - toolUseBlocks.length + i]?.raw
                     || JSON.stringify({}),
      }));

      messages.push({ role: "user", content: toolResultsFromEvidence });
      continue;
    }

    // 4. Max tokens hit
    if (stopReason === "max_tokens") {
      console.log(`\n  ⚠️  Hit max_tokens — increase max_tokens or split the task.`);
      break;
    }
  }

  // ── GRACEFUL DEGRADATION ──────────────────────────────────
  if (step >= maxSteps && stopReason !== "end_turn") {
    printEvidenceTrail(evidence);
    printGracefulDegradation({ step, maxSteps, evidence, toolsUsed });
  }

  return { steps: step, stopReason, evidence };
}


// -----------------------------------------------------------
// BUILD EVIDENCE ITEM
// Converts a raw tool result into a readable evidence entry
// -----------------------------------------------------------
function buildEvidenceItem(toolName, input, result) {
  switch (toolName) {
    case "get_jira_issue":
      return {
        tool:    toolName,
        label:   `Jira ${input.issue_id}`,
        summary: `${result.summary} [${result.status} | ${result.priority}]`,
        anomaly: result.priority === "P1",
        raw:     JSON.stringify(result),
      };

    case "search_kibana_logs":
      const errors = result.logs?.filter(l => l.level === "ERROR") || [];
      return {
        tool:    toolName,
        label:   `Kibana logs — ${result.service}`,
        summary: `${result.count} entries found, ${errors.length} ERROR(s)` +
                 (errors[0] ? ` — "${errors[0].message.slice(0, 60)}"` : ""),
        anomaly: errors.length > 0,
        raw:     JSON.stringify(result),
      };

    case "get_repo_context":
      return {
        tool:    toolName,
        label:   `Repo — ${result.file?.split("/").pop()}`,
        summary: `Last commit: "${result.lastCommit?.message}" by ${result.lastCommit?.author}`,
        anomaly: result.suggestedFix != null,
        raw:     JSON.stringify(result),
      };

    case "get_journey_events":
      const failed = result.events?.filter(e => e.status === "failure") || [];
      return {
        tool:    toolName,
        label:   `Journey — session ${input.session_id}`,
        summary: `${result.eventCount} events, ${failed.length} failure(s)`,
        anomaly: failed.length > 0,
        raw:     JSON.stringify(result),
      };

    default:
      return {
        tool:    toolName,
        label:   toolName,
        summary: JSON.stringify(result).slice(0, 80),
        anomaly: false,
        raw:     JSON.stringify(result),
      };
  }
}


// -----------------------------------------------------------
// PRINT: DECISION BANNER
// ╔══════════════════════════════════════╗
// ║  AGENT DECISION — Step 2 of 5       ║
// ║  Claude chose: search_kibana_logs   ║
// ║  Reason: NPE found in ticket        ║
// ╚══════════════════════════════════════╝
// -----------------------------------------------------------
function printDecisionBanner({ step, maxSteps, toolName, reason }) {
  const width  = 54;
  const border = "═".repeat(width);
  const pad    = (text) => `║  ${text.slice(0, width - 4).padEnd(width - 4)}  ║`;

  console.log(`\n╔${border}╗`);
  console.log(pad(`AGENT DECISION — Step ${step} of ${maxSteps}`));
  console.log(pad(`Claude chose: ${toolName}`));
  console.log(pad(`Reason: ${reason}`));
  console.log(`╚${border}╝`);
}


// -----------------------------------------------------------
// PRINT: EVIDENCE TRAIL
// Evidence gathered so far:
//   ✅ Jira APP-123 — NullPointerException, P1, OPEN
//   ✅ Kibana logs — 2 ERROR entries
//   ⏳ Repo context — pending...
// -----------------------------------------------------------
function printEvidenceTrail(evidence) {
  const allTools = ["get_jira_issue", "search_kibana_logs", "get_repo_context"];
  const gathered = new Set(evidence.map(e => e.tool));

  console.log(`\n  Evidence gathered so far:`);

  for (const tool of allTools) {
    const item = evidence.find(e => e.tool === tool);
    if (item) {
      const icon = item.anomaly ? "⚠️ " : "✅";
      console.log(`  ${icon} ${item.label} — ${item.summary}`);
    } else {
      console.log(`  ⏳ ${tool.replace(/_/g, " ")} — pending...`);
    }
  }

  // Show any extra tools not in the default list
  for (const item of evidence) {
    if (!allTools.includes(item.tool)) {
      console.log(`  ✅ ${item.label} — ${item.summary}`);
    }
  }
}


// -----------------------------------------------------------
// PRINT: FINAL AGENT REPORT
// ╔══════════════════════════════════════╗
// ║  AGENT INVESTIGATION COMPLETE       ║
// ║  Steps taken:     3                 ║
// ║  Tools used:      3                 ║
// ║  Evidence items:  3                 ║
// ║  Conclusion:      Root cause found  ║
// ╚══════════════════════════════════════╝
// -----------------------------------------------------------
function printFinalReport({ step, toolsUsed, evidence, conclusion }) {
  const width  = 54;
  const border = "═".repeat(width);
  const pad    = (text) => `║  ${text.slice(0, width - 4).padEnd(width - 4)}  ║`;
  const anomalies = evidence.filter(e => e.anomaly).length;

  console.log(`\n╔${border}╗`);
  console.log(pad(`AGENT INVESTIGATION COMPLETE`));
  console.log(`║${"─".repeat(width + 2)}║`);
  console.log(pad(`Steps taken:     ${step}`));
  console.log(pad(`Tools used:      ${toolsUsed.length}`));
  console.log(pad(`Evidence items:  ${evidence.length}`));
  console.log(pad(`Anomalies found: ${anomalies}`));
  console.log(pad(`Conclusion:      ${conclusion ? "Root cause identified" : "Inconclusive"}`));
  console.log(`╚${border}╝`);

  if (conclusion) {
    console.log(`\n  Agent conclusion:\n`);
    console.log(`  ${conclusion.replace(/\n/g, "\n  ")}`);
  }
}


// -----------------------------------------------------------
// PRINT: GRACEFUL DEGRADATION
// When MAX_STEPS is hit before end_turn
// -----------------------------------------------------------
function printGracefulDegradation({ step, maxSteps, evidence, toolsUsed }) {
  const width  = 54;
  const border = "═".repeat(width);
  const pad    = (text) => `║  ${text.slice(0, width - 4).padEnd(width - 4)}  ║`;

  console.log(`\n╔${border}╗`);
  console.log(pad(`⚠️  AGENT STEP LIMIT REACHED`));
  console.log(`║${"─".repeat(width + 2)}║`);
  console.log(pad(`Max steps:       ${maxSteps}`));
  console.log(pad(`Steps taken:     ${step}`));
  console.log(pad(`Evidence items:  ${evidence.length}`));
  console.log(pad(`Status:          Partial result — not crashed`));
  console.log(`╚${border}╝`);

  console.log(`\n  Graceful degradation activated.`);
  console.log(`  In production:`);
  console.log(`  → Return partial evidence to the user`);
  console.log(`  → Log the incomplete trace`);
  console.log(`  → Offer a retry option`);
  console.log(`  → Never surface a raw error`);
}