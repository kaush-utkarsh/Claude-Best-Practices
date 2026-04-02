// =============================================================
// demo5-journey-tracer.js
// DEMO 5: Journey Tracer
// ─────────────────────────────────────────────────────────────
// Concept:  Instrument every user step. AI annotates. Flags anomalies.
// Show:     traceJourneyStep() — runs on Haiku (cheapest)
// Steps:    login → search → add_to_cart → checkout → confirm
// Anomaly:  Injected at checkout (step 4 fails silently)
// Break it: Remove anomaly flag. Claude still catches it from metadata.
//           Point: flag your anomalies explicitly — don't rely on inference.
// Key rule: session_id + timestamp + step + anomaly flag = all you need
// Runtime:  ~30 seconds
// Run:      node demos/backend/demo5-journey-tracer.js
// =============================================================

import { callClaude, MODELS } from "./shared/api-client.js";
import { JOURNEY_EVENTS } from "./shared/mock-data.js";


// -----------------------------------------------------------
// STEP ANNOTATOR
// Sends one journey step to Claude for annotation.
// Always runs on Haiku — this fires on every user step.
// Cost discipline matters here more than anywhere else.
// -----------------------------------------------------------
async function annotateStep(event) {
  const response = await callClaude({
    model: MODELS.HAIKU,   // ← cheapest. This runs thousands of times a day.
    system: `You are a user journey monitor for an e-commerce platform.
You receive one step from a user session and must classify it in exactly this format:

STATUS: [NORMAL | SLOW | ANOMALY]
NOTE: [one sentence — what happened and why it matters]
ACTION: [NONE | INVESTIGATE | ALERT]

Rules:
- NORMAL: step completed successfully within expected duration
- SLOW: step completed but took longer than expected (>2000ms for most steps)
- ANOMALY: step failed, was skipped, or has suspicious signals
- If payment was charged but order failed → always ANOMALY + ALERT
- If user saw no error message on failure → always ANOMALY + ALERT
- Keep NOTE under 20 words
- Never speculate beyond what the data shows`,
    messages: [
      {
        role: "user",
        content: `Analyse this journey step:

Step:       ${event.step}
Step #:     ${event.stepNumber} of 5
Status:     ${event.status}
Duration:   ${event.durationMs ? `${event.durationMs}ms` : "not reached"}
Anomaly:    ${event.anomaly ? "true" : "false"}
Metadata:   ${JSON.stringify(event.metadata, null, 2)}`,
      }
    ],
    max_tokens: 100,
  });

  return response.content[0].text.trim();
}


// -----------------------------------------------------------
// PARSE ANNOTATION
// -----------------------------------------------------------
function parseAnnotation(text) {
  const status = text.match(/STATUS:\s*(\w+)/)?.[1] || "UNKNOWN";
  const note   = text.match(/NOTE:\s*(.+)/)?.[1]   || "";
  const action = text.match(/ACTION:\s*(\w+)/)?.[1] || "NONE";
  return { status, note, action };
}


// -----------------------------------------------------------
// STATUS ICON
// -----------------------------------------------------------
function statusIcon(status, eventStatus) {
  if (eventStatus === "not_reached") return "⏳";
  if (status === "ANOMALY") return "❌";
  if (status === "SLOW")    return "🐢";
  return "✅";
}


// -----------------------------------------------------------
// PRINT STEP
// -----------------------------------------------------------
function printStep(event, annotation, parsed) {
  const icon     = statusIcon(parsed.status, event.status);
  const duration = event.durationMs
    ? `${(event.durationMs / 1000).toFixed(2)}s`
    : "—";

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${icon}  Step ${event.stepNumber}: ${event.step.toUpperCase()}`);
  console.log(`${"─".repeat(60)}`);
  console.log(`  Status:    ${event.status}`);
  console.log(`  Duration:  ${duration}`);

  if (event.anomaly) {
    console.log(`  ⚠️  Anomaly flag: TRUE`);
  }

  if (event.metadata && Object.keys(event.metadata).length > 0) {
    const key = Object.entries(event.metadata)
      .filter(([k]) => ["httpStatus", "errorShown", "paymentCharged", "resultsCount", "method"].includes(k))
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
    if (key) console.log(`  Signals:   ${key}`);
  }

  console.log(`\n  Claude [Haiku]:`);
  console.log(`  Status: ${parsed.status}`);
  console.log(`  Note:   ${parsed.note}`);
  console.log(`  Action: ${parsed.action}`);

  if (parsed.action === "ALERT") {
    console.log(`\n  🚨 ALERT TRIGGERED — This step requires immediate attention.`);
  }
}


// -----------------------------------------------------------
// SESSION REPORT
// -----------------------------------------------------------
async function generateSessionReport(events, annotations) {
  const journey = events.map((e, i) => {
    const parsed = parseAnnotation(annotations[i] || "");
    return `Step ${e.stepNumber} (${e.step}): ${parsed.status} — ${parsed.note}`;
  }).join("\n");

  const anomalies = events.filter(e => e.anomaly);
  const alerts    = annotations.filter(a => a.includes("ALERT")).length;

  const response = await callClaude({
    model: MODELS.HAIKU,
    system: `You are a session analysis system.
Summarise the user journey in this exact format:

JOURNEY: [COMPLETED | ABANDONED | FAILED]
DROPPED_AT: [step name where session ended, or NONE]
ANOMALIES: [count]
BUSINESS_IMPACT: [one sentence — revenue/trust/data impact]
INVESTIGATE: [what to look at next — one sentence]`,
    messages: [
      {
        role: "user",
        content: `Session ID: ${events[0].sessionId}
User: ${events[0].userId}

Journey steps:
${journey}

Anomaly count: ${anomalies.length}
Alert count: ${alerts}

Generate the session report.`,
      }
    ],
    max_tokens: 150,
  });

  return response.content[0].text.trim();
}


// -----------------------------------------------------------
// PRINT SESSION REPORT
// -----------------------------------------------------------
function printSessionReport(sessionId, userId, reportText, events, annotations) {
  const get = (label) => {
    const match = reportText.match(new RegExp(`${label}:\\s*(.+)`));
    return match ? match[1].trim() : "—";
  };

  const width  = 54;
  const border = "═".repeat(width);
  const pad    = (text) => `║  ${text.slice(0, width - 4).padEnd(width - 4)}  ║`;

  const completed = events.filter(e => e.status === "success").length;
  const total     = events.length;
  const anomalies = events.filter(e => e.anomaly).length;
  const alerts    = annotations.filter(a => a.includes("ALERT")).length;

  console.log(`\n╔${border}╗`);
  console.log(pad("SESSION REPORT"));
  console.log(`║${"─".repeat(width + 2)}║`);
  console.log(pad(`Session:     ${sessionId}`));
  console.log(pad(`User:        ${userId}`));
  console.log(pad(`Steps:       ${completed} of ${total} completed`));
  console.log(pad(`Anomalies:   ${anomalies}`));
  console.log(pad(`Alerts:      ${alerts}`));
  console.log(pad(`Journey:     ${get("JOURNEY")}`));
  console.log(pad(`Dropped at:  ${get("DROPPED_AT")}`));
  console.log(`╚${border}╝`);

  console.log(`\n  Business impact:`);
  console.log(`  ${get("BUSINESS_IMPACT")}`);
  console.log(`\n  Investigate next:`);
  console.log(`  ${get("INVESTIGATE")}`);
}


// -----------------------------------------------------------
// MAIN TRACE FUNCTION
// -----------------------------------------------------------
async function traceSession(events, { withAnomalyFlag = true } = {}) {
  const sessionId = events[0].sessionId;
  const userId    = events[0].userId;

  console.log(`\n  Session:  ${sessionId}`);
  console.log(`  User:     ${userId}`);
  console.log(`  Steps:    ${events.length}`);
  console.log(`  Anomaly flag enabled: ${withAnomalyFlag}`);

  const annotations = [];

  for (const event of events) {
    const traceEvent = withAnomalyFlag
      ? event
      : { ...event, anomaly: false };

    const annotation = await annotateStep(traceEvent);
    const parsed     = parseAnnotation(annotation);

    annotations.push(annotation);
    printStep(traceEvent, annotation, parsed);

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n\n${"─".repeat(60)}`);
  console.log(`  Generating session report...`);
  const report = await generateSessionReport(events, annotations);
  printSessionReport(sessionId, userId, report, events, annotations);

  return { annotations, report };
}


// -----------------------------------------------------------
// DEMO FLOW
// -----------------------------------------------------------
async function runDemo() {
  console.log("\n" + "═".repeat(60));
  console.log("  DEMO 5 — JOURNEY TRACER");
  console.log("  Instrument every step. AI annotates. Flags anomalies.");
  console.log("═".repeat(60));

  // ── NORMAL RUN — anomaly flag on ─────────────────────────
  console.log("\n\n🔵 NORMAL RUN — Anomaly flag enabled");
  console.log("  Watch Claude catch the checkout failure in real time.\n");

  await traceSession(JOURNEY_EVENTS, { withAnomalyFlag: true });


  // ── BREAK IT — anomaly flag off ───────────────────────────
  console.log("\n\n" + "═".repeat(60));
  console.log("  ⚠️  BREAK IT — Anomaly flag removed");
  console.log("═".repeat(60));
  console.log(`
  Stripping the anomaly flag from step 4.
  Same data. Same failure. Same payment charge.

  Claude still catches it — because the metadata is explicit:
    httpStatus: 500 | errorShown: false | paymentCharged: true

  That's the system prompt doing the work — three explicit rules
  covering exactly this scenario.

  Now ask yourself: what happens in your production data?
  Will httpStatus always be there? Will paymentCharged always be set?
  Will the metadata always be this clean?

  The anomaly flag removes that dependency entirely.
  You flag it at the source. Claude reads the flag. Done.
  `);

  await traceSession(JOURNEY_EVENTS, { withAnomalyFlag: false });

  printLesson();
}


// -----------------------------------------------------------
// LESSON
// -----------------------------------------------------------
function printLesson() {
  console.log("\n\n" + "═".repeat(60));
  console.log("  THE LESSON");
  console.log("═".repeat(60));
  console.log(`
  This demo caught the anomaly BOTH times.

  With flag:    Claude read the explicit signal you set.
  Without flag: Claude inferred it from clean, explicit metadata.

  In production your metadata will not always be this clean.
  httpStatus might be missing. paymentCharged might be null.
  errorShown might not exist at all.

  The anomaly flag is your guarantee.
  It doesn't matter what the metadata looks like.
  You flagged it. Claude reads it. Alert fires.

  Don't rely on Claude to infer what you already know.
  Instrument it. Flag it. Make it explicit.

  Demo 4: Investigate a bug after it's reported.
  Demo 5: Catch it before anyone reports it.
  Same bug. Different layer. Both essential.

  KEY RULE:
  Instrument everything. Flag anomalies at the source.
  AI monitoring is only as good as your instrumentation.
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