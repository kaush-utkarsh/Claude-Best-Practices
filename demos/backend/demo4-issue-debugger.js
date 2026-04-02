// =============================================================
// demo4-issue-debugger.js
// DEMO 4: Issue Debugger
// ─────────────────────────────────────────────────────────────
// Concept:  Symptom → Evidence → Root Cause → Fix → Test
// Show:     Full bug triage chain — Jira + Kibana + Repo + Claude
// Break it: Remove tool results. Claude diagnoses without evidence.
// Key rule: Never diagnose before gathering.
//           Tools first. Reasoning second.
// Runtime:  ~30 seconds
// Run:      node demos/backend/demo4-issue-debugger.js
// =============================================================

import { callClaude, MODELS } from "./shared/api-client.js";
import { executeTool, TOOL_SCHEMAS } from "./shared/mock-executors.js";


// -----------------------------------------------------------
// THE BUG TRIAGE WORKFLOW
// Five stages — every stage logged visibly
// -----------------------------------------------------------

const TRIAGE_STAGES = {
  SYMPTOM:    "1. SYMPTOM    — What was reported",
  EVIDENCE:   "2. EVIDENCE   — What the data shows",
  ROOT_CAUSE: "3. ROOT CAUSE — Why it happened",
  FIX:        "4. FIX        — What needs to change",
  TEST:       "5. TEST       — How to verify the fix",
};

function printStage(stage) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ▶  ${stage}`);
  console.log(`${"─".repeat(60)}`);
}

function printTriageHeader(issueId) {
  console.log("\n" + "═".repeat(60));
  console.log(`  🔍 BUG TRIAGE — ${issueId}`);
  console.log(`  Symptom → Evidence → Root Cause → Fix → Test`);
  console.log("═".repeat(60));
}

function printTriageReport(report) {
  const width  = 54;
  const border = "═".repeat(width);
  const pad    = (text) => `║  ${text.slice(0, width - 4).padEnd(width - 4)}  ║`;

  console.log(`\n╔${border}╗`);
  console.log(pad("TRIAGE REPORT COMPLETE"));
  console.log(`║${"─".repeat(width + 2)}║`);
  console.log(pad(`Issue:       ${report.issueId}`));
  console.log(pad(`Service:     ${report.service}`));
  console.log(pad(`File:        ${report.file}`));
  console.log(pad(`Line:        ${report.line}`));
  console.log(pad(`Confidence:  ${report.confidence}`));
  console.log(pad(`Fix ready:   ${report.fixReady ? "Yes" : "No"}`));
  console.log(`╚${border}╝`);

  console.log(`\n  Root cause:\n  ${report.rootCause}`);
  console.log(`\n  Fix:\n  ${report.fix}`);
  console.log(`\n  Test:\n  ${report.test}`);
}


// -----------------------------------------------------------
// FULL TRIAGE CHAIN
// Runs all five stages in sequence
// withEvidence = false triggers the break-it mode
// -----------------------------------------------------------
async function runTriage(issueId, { withEvidence = true } = {}) {
  printTriageHeader(issueId);

  const tools = TOOL_SCHEMAS.filter(t =>
    ["get_jira_issue", "search_kibana_logs", "get_repo_context"].includes(t.name)
  );

  // ── STAGE 1: SYMPTOM ─────────────────────────────────────
  printStage(TRIAGE_STAGES.SYMPTOM);

  const ticket = await executeTool("get_jira_issue", { issue_id: issueId });
  console.log(`\n  Issue:     ${ticket.id} [${ticket.status} | ${ticket.priority}]`);
  console.log(`  Summary:   ${ticket.summary}`);
  console.log(`  Reporter:  ${ticket.reporter}`);
  console.log(`  Since:     ${ticket.created.split("T")[0]}`);
  console.log(`  Impact:    ${ticket.description.split("\n")[2]?.trim() || "See description"}`);


  // ── STAGE 2: EVIDENCE ────────────────────────────────────
  printStage(TRIAGE_STAGES.EVIDENCE);

  const logs = await executeTool("search_kibana_logs", {
    service: "order-service",
    level:   "ERROR",
  });

  const errorLog = logs.logs.find(l => l.stackTrace);
  console.log(`\n  Kibana — order-service ERROR logs: ${logs.count} found`);

  if (errorLog) {
    console.log(`\n  Top error:`);
    console.log(`  Time:    ${errorLog.timestamp}`);
    console.log(`  Message: ${errorLog.message}`);
    console.log(`\n  Stack trace:`);
    errorLog.stackTrace.forEach(line => console.log(`  ${line}`));
  }

  const repo = await executeTool("get_repo_context", {
    file_path: "src/main/java/com/example/orders/OrderProcessor.java",
  });

  console.log(`\n  Repo context — ${repo.file}`);
  console.log(`  Last commit: "${repo.lastCommit.message}" by ${repo.lastCommit.author}`);
  console.log(`  Commit date: ${repo.lastCommit.date.split("T")[0]}`);
  console.log(`\n  Relevant code:`);
  Object.entries(repo.relevantLines).forEach(([line, code]) => {
    const marker = line === "142" ? "  ← NPE HERE" : "";
    console.log(`  Line ${line}: ${code}${marker}`);
  });


  // ── STAGE 3 + 4 + 5: Claude reasons over evidence ────────
  printStage(TRIAGE_STAGES.ROOT_CAUSE);
  console.log(`\n  Sending evidence to Claude for analysis...`);

  const evidencePayload = withEvidence
    ? buildEvidencePayload(ticket, logs, repo)
    : buildEmptyPayload(ticket);

  if (!withEvidence) {
    console.log(`\n  ⚠️  BREAK-IT MODE: Tool results withheld from Claude.`);
    console.log(`  Claude will reason without evidence.`);
    console.log(`  The system prompt says "do not speculate if evidence is missing".`);
    console.log(`  Watch what happens when you remove that guardrail too.\n`);
  }

  const response = await callClaude({
    model:   MODELS.SONNET,
    system:  withEvidence
      // WITH evidence: clear instruction to be precise
      ? `You are a senior Java/Spring Boot debugging expert.
You will receive a bug report with evidence gathered from Jira, Kibana, and the repository.
Your job is to provide a structured diagnosis in exactly this format:

ROOT CAUSE: [one sentence — what is broken and why]
SERVICE: [service name]
FILE: [filename]
LINE: [line number if known]
CONFIDENCE: [High/Medium/Low]

FIX:
[the exact code change needed — before and after]

TEST:
[specific test case to verify the fix works]

Be precise. Reference specific line numbers, commit hashes, and field names from the evidence.
If evidence is missing, say so clearly — do not speculate.`
      // WITHOUT evidence: guardrail removed — Claude will speculate
      : `You are a senior Java/Spring Boot debugging expert.
Diagnose the bug and provide a fix in this format:

ROOT CAUSE: [one sentence]
SERVICE: [service name]
FILE: [filename]
LINE: [line number]
CONFIDENCE: [High/Medium/Low]

FIX:
[the code change needed]

TEST:
[test case to verify]`,
    messages: [{ role: "user", content: evidencePayload }],
    max_tokens: 800,
  });

  const analysis = response.content[0].text;
  console.log(`\n  Claude's analysis:\n`);
  console.log(`  ${analysis.replace(/\n/g, "\n  ")}`);

  const report = parseAnalysis(analysis, issueId, repo);

  printStage(TRIAGE_STAGES.FIX);
  console.log(`\n  Suggested fix from repository context:`);
  console.log(`  File: ${repo.file}`);
  console.log(`  Line: ${repo.suggestedFix.line}`);
  console.log(`\n  Before:`);
  console.log(`    ${repo.suggestedFix.before}`);
  console.log(`\n  After:`);
  repo.suggestedFix.after.split("\n").forEach(l => console.log(`    ${l}`));

  printStage(TRIAGE_STAGES.TEST);
  console.log(`\n  Test cases to verify the fix:`);
  console.log(`  ✅ Order with deliveryWindow = null    → should default to "STANDARD"`);
  console.log(`  ✅ Order with deliveryWindow = "AM"    → should use "AM"`);
  console.log(`  ✅ Order with deliveryWindow = ""      → should default to "STANDARD"`);
  console.log(`  ✅ Checkout flow end-to-end            → no silent 500s`);

  printTriageReport(report);
  return report;
}


// -----------------------------------------------------------
// EVIDENCE PAYLOAD — what Claude receives WITH evidence
// -----------------------------------------------------------
function buildEvidencePayload(ticket, logs, repo) {
  const errorLog = logs.logs.find(l => l.stackTrace);
  return `Bug report received. Here is the evidence gathered:

JIRA TICKET ${ticket.id}:
Summary: ${ticket.summary}
Status: ${ticket.status} | Priority: ${ticket.priority}
Description: ${ticket.description}
Comments: ${ticket.comments.map(c => `${c.author}: ${c.body}`).join(" | ")}

KIBANA ERROR LOGS (order-service):
${logs.count} error(s) found.
${errorLog ? `Top error: ${errorLog.message}
Stack trace: ${errorLog.stackTrace.join(" | ")}` : "No errors found."}

REPOSITORY CONTEXT:
File: ${repo.file}
Last commit: "${repo.lastCommit.message}" by ${repo.lastCommit.author} on ${repo.lastCommit.date}
Relevant code:
${Object.entries(repo.relevantLines).map(([line, code]) => `Line ${line}: ${code}`).join("\n")}

Diagnose the root cause and provide the fix.`;
}


// -----------------------------------------------------------
// EMPTY PAYLOAD — what Claude receives WITHOUT evidence
// -----------------------------------------------------------
function buildEmptyPayload(ticket) {
  return `Bug report received.

JIRA TICKET ${ticket.id}:
Summary: ${ticket.summary}
Status: ${ticket.status} | Priority: ${ticket.priority}

No Kibana logs available.
No repository context available.

Diagnose the root cause and provide the fix.`;
}


// -----------------------------------------------------------
// PARSE CLAUDE'S STRUCTURED RESPONSE
// -----------------------------------------------------------
function parseAnalysis(text, issueId, repo) {
  const get = (label) => {
    const match = text.match(new RegExp(`${label}:\\s*(.+)`));
    return match ? match[1].trim() : "See analysis above";
  };

  return {
    issueId,
    rootCause:  get("ROOT CAUSE"),
    service:    get("SERVICE"),
    file:       get("FILE"),
    line:       get("LINE"),
    confidence: get("CONFIDENCE"),
    fixReady:   repo?.suggestedFix != null,
    fix:        repo?.suggestedFix
      ? `${repo.suggestedFix.before}\n→ ${repo.suggestedFix.after.split("\n")[0]}`
      : "See analysis above",
    test:       "deliveryWindow = null → default to STANDARD",
  };
}


// -----------------------------------------------------------
// DEMO FLOW
// -----------------------------------------------------------
async function runDemo() {
  console.log("\n" + "═".repeat(60));
  console.log("  DEMO 4 — ISSUE DEBUGGER");
  console.log("  Never diagnose before gathering. Tools first.");
  console.log("═".repeat(60));

  // ── NORMAL RUN — with evidence ────────────────────────────
  console.log("\n\n🔵 NORMAL RUN — Full triage with evidence");
  await runTriage("APP-123", { withEvidence: true });

  // ── BREAK IT — without evidence ───────────────────────────
  console.log("\n\n" + "═".repeat(60));
  console.log("  ⚠️  BREAK IT — Claude without evidence");
  console.log("═".repeat(60));
  console.log(`
  Two things change in this run:
  1. Tool results are withheld — no Kibana, no repo context
  2. The "do not speculate" guardrail is removed from the system prompt

  This is what your implementation looks like without either.
  Watch Claude give a confident, specific, wrong answer.

  KEY RULE: Never diagnose before gathering.
  Tools first. Reasoning second. Always.
  `);

  await runTriage("APP-123", { withEvidence: false });

  printSideBySide();
}


// -----------------------------------------------------------
// SIDE BY SIDE LESSON
// -----------------------------------------------------------
function printSideBySide() {
  console.log("\n\n" + "═".repeat(60));
  console.log("  WITH EVIDENCE vs WITHOUT EVIDENCE");
  console.log("═".repeat(60));
  console.log(`
  WITH EVIDENCE:                WITHOUT EVIDENCE:
  ──────────────────────────    ──────────────────────────
  Root cause: specific line     Root cause: plausible guess
  File: OrderProcessor.java     File: hallucinated
  Line: 142                     Line: wrong or missing
  Confidence: High              Confidence: stated as High
  Fix: exact null check         Fix: generic suggestion
  Test: specific scenario       Test: generic test

  The confidence level looks the same.
  The specificity looks the same.
  One is backed by evidence. One is not.
  You cannot tell the difference by reading the output.

  That is the danger.

  The guardrail that made Claude refuse in the first attempt?
  That was your system prompt. Remove it and Claude speculates.
  Claude is not your safety net. Your evidence pipeline is.

  Your senior developer spent 45 minutes on this.
  This did it in 8 seconds — and showed its work.

  KEY RULE:
  Symptom → Evidence → Root Cause → Fix → Test
  Never skip Evidence. That step is what makes the rest true.
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