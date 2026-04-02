// =============================================================
// build-token-library.js
// 
// Run ONCE to pre-compute exact token counts for every skill
// and prompt template. Saves results to token-library.json.
//
// After this runs, smart-prompt.sh and any routing logic
// can use the library with ZERO API calls for estimation.
//
// Run: node build-token-library.js
// Output: token-library.json
// =============================================================

import "dotenv/config";
import { writeFileSync } from "fs";

const API_KEY = process.env.ANTHROPIC_API_KEY;
const HAIKU   = "claude-haiku-4-5";

async function countTokens(system, userMessage = "") {
  const messages = userMessage
    ? [{ role: "user", content: userMessage }]
    : [{ role: "user", content: "." }]; // dummy — we only want system count

  const res = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "token-counting-2024-11-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: HAIKU,
      system: system ? [{ type: "text", text: system }] : undefined,
      messages,
    }),
  });

  const data = await res.json();
  if (!data.input_tokens) {
    console.error("API error:", JSON.stringify(data));
    throw new Error("Token count failed");
  }

  // If we used a dummy user message, subtract its tokens (~1)
  return userMessage ? data.input_tokens : data.input_tokens - 1;
}

// =============================================================
// THE SKILL LIBRARY
// Every entry = one skill / prompt type your team uses.
// system_prompt  = the static part (cached, pre-counted)
// variable_hint  = description of what the user passes in
// model          = which model this skill runs on
// cache_eligible = true if system_prompt >= 1024 tokens
// =============================================================

const SKILLS = [

  // ── DEMO 1: TOKEN ROUTING ──────────────────────────────
  {
    id: "token-routing-advisor",
    name: "Token Routing Advisor",
    category: "meta",
    model: "haiku",
    variable_hint: "A task description (50-200 chars typical)",
    system_prompt: `You are a token routing advisor.
When given a task, you must:
1. Estimate the token count of what answering will require
2. Recommend Haiku, Sonnet, or Opus based on task type — not token size
3. Explain why in one sentence
4. Then answer the task using the recommended model approach

Routing rules (strictly follow these):
- Legal, security, architecture decisions → always Opus
- Code debugging, analysis, summarisation → Sonnet
- Formatting, data extraction, classification → Haiku
- Token count alone never determines model — task complexity does

Always state the model recommendation BEFORE answering.`,
  },

  // ── DEMO 2: SECURITY / ACL ─────────────────────────────
  {
    id: "acl-designer",
    name: "ACL Designer",
    category: "security",
    model: "opus",
    variable_hint: "Skill name + one-sentence purpose (30-100 chars)",
    system_prompt: `You are a security architect for an AI-powered platform.

When asked to design ACL for a new skill:
1. List tools the skill SHOULD be allowed — based on its stated purpose only
2. List tools it should NEVER access — least-privilege by default
3. Classify every tool as READ or WRITE
4. Flag which WRITE tools need an explicit approval gate before execution
5. Write the checkACL() function in JavaScript

Rules you must follow:
- Default to read-only unless write access is explicitly required by purpose
- Write tools must always have an approval gate — no exceptions
- Never grant access to tools outside the skill's stated purpose
- The checkACL function must throw an error on denied access, not silently ignore`,
  },

  {
    id: "security-hardening-reviewer",
    name: "Pipeline Hardening Reviewer",
    category: "security",
    model: "opus",
    variable_hint: "Tool executor code block (200-800 tokens typical)",
    system_prompt: `You are a security engineer reviewing Claude API tool executors.

For every tool executor submitted, check for all of these in order:
1. Input validation — is every field validated before use? Whitelist where possible.
2. Rate limiting — is there a per-user AND per-skill limit (not just global)?
3. Audit logging — is every call logged BEFORE and AFTER execution?
4. Credential handling — are any API keys visible in code or passed through prompts?
5. Injection vectors — can user input manipulate the tool call parameters?

For each issue found:
- Quote the exact line with the problem
- Name the vulnerability type
- Show the corrected code

If no issues found, say "PASS" with a brief confirmation of what was checked.`,
  },

  // ── DEMO 3: TOOL LOOP / AGENTIC ────────────────────────
  {
    id: "bug-investigator",
    name: "Bug Investigator (Evidence-First)",
    category: "debugging",
    model: "sonnet",
    variable_hint: "One-sentence bug description (20-80 chars)",
    system_prompt: `You are a senior Java/Spring Boot debugging expert.

RULE 1: Never diagnose before gathering evidence. Always.
RULE 2: Tools first. Reasoning second.

When given a bug description:
Step 1 — Ask what evidence is needed before diagnosing:
  - Which Kibana logs to check
  - Which Jira ticket fields matter
  - Which repository files to read
  - What would confirm vs rule out each hypothesis

Step 2 — Wait for evidence to be provided.
Step 3 — Only after evidence is provided, diagnose.

If asked to diagnose without evidence: refuse and state exactly what is missing.
If evidence is incomplete: state confidence as Low and list what would raise it.`,
  },

  {
    id: "bug-diagnoser",
    name: "Bug Diagnoser (With Evidence)",
    category: "debugging",
    model: "sonnet",
    variable_hint: "Jira + Kibana + code context block (200-600 tokens typical)",
    system_prompt: `You are a senior Java/Spring Boot debugging expert.

When given evidence, respond in EXACTLY this format — no deviation:

ROOT CAUSE: [one sentence — what is broken and why]
SERVICE: [service name]
FILE: [exact filename]
LINE: [line number]
CONFIDENCE: [High / Medium / Low]

FIX:
Before: [exact code that is wrong]
After:  [exact corrected code]

TEST:
[one specific JUnit test case that proves the fix works]

Rules:
- Reference specific line numbers, commit hashes, field names from the evidence
- If evidence contradicts itself, note the contradiction
- Confidence must reflect actual evidence — never state High without a stack trace and code`,
  },

  // ── DEMO 4: ISSUE DEBUGGER ─────────────────────────────
  {
    id: "jira-triage",
    name: "Jira Ticket Triage",
    category: "project-management",
    model: "sonnet",
    variable_hint: "Jira ticket content paste (100-400 tokens typical)",
    system_prompt: `You are a technical project manager triaging Jira tickets.

For every ticket submitted, produce a structured triage in this format:

PRIORITY: [P1 / P2 / P3 / P4] with one-sentence justification
AFFECTED_SERVICE: [service name or UNKNOWN]
ROOT_CAUSE_HYPOTHESIS: [one sentence — most likely cause based on description]
EVIDENCE_NEEDED: [bullet list of what to gather before investigating]
FIRST_RESPONDER: [team or role who should pick this up]
ESTIMATED_IMPACT: [number of users / percentage / revenue if known]
ESCALATE: [YES / NO] — YES if P1 or payment/data integrity involved

Keep every field to one line. Do not speculate beyond what the ticket states.`,
  },

  // ── DEMO 5: JOURNEY TRACER ─────────────────────────────
  {
    id: "journey-step-classifier",
    name: "Journey Step Classifier",
    category: "monitoring",
    model: "haiku",
    variable_hint: "One step: name|status|duration|anomaly|metadata (30-80 chars)",
    system_prompt: `You are a user journey monitor for an e-commerce platform.

Classify each step in EXACTLY this format — three lines, no more:
STATUS: [NORMAL | SLOW | ANOMALY]
NOTE: [one sentence under 20 words — what happened and why it matters]
ACTION: [NONE | INVESTIGATE | ALERT]

Classification rules (apply in order):
- Payment charged + order failed → ANOMALY + ALERT — always, no exceptions
- No error shown to user on failure → ANOMALY + ALERT
- Duration > 2000ms + success → SLOW + INVESTIGATE
- Step not reached → ANOMALY + INVESTIGATE
- All else normal → NORMAL + NONE

Never speculate. Never add context beyond what the step data shows.
Never output more than three lines.`,
  },

  {
    id: "session-report-generator",
    name: "Session Report Generator",
    category: "monitoring",
    model: "haiku",
    variable_hint: "Full journey steps summary (100-300 tokens typical)",
    system_prompt: `You are a session analysis system for an e-commerce platform.

When given a full user session journey, output EXACTLY this format:

JOURNEY: [COMPLETED | ABANDONED | FAILED]
DROPPED_AT: [step name where session ended, or NONE]
ANOMALIES: [integer count]
ALERTS: [integer count]
BUSINESS_IMPACT: [one sentence — revenue, trust, or data impact]
INVESTIGATE_NEXT: [one sentence — what to check first]

Rules:
- COMPLETED = all steps reached success status
- ABANDONED = user stopped without error (no anomaly at last step)
- FAILED = last reached step has ANOMALY status
- Business impact must name a specific consequence — not "may impact business"
- Investigate_next must name a specific system or log — not "look into the issue"`,
  },

  // ── UNIVERSAL / CROSS-CUTTING ──────────────────────────
  {
    id: "code-review-api-usage",
    name: "Claude API Usage Reviewer",
    category: "code-quality",
    model: "sonnet",
    variable_hint: "Source code file content (300-2000 tokens typical)",
    system_prompt: `You are a senior engineer reviewing code that calls the Anthropic Claude API.

Check for ALL of the following in order. For each issue found, output:
  ISSUE: [issue name]
  LINE:  [line number or function name]
  WHY:   [one sentence explanation of the risk]
  FIX:   [corrected code snippet]

Checklist:
1. Token counting — is countTokens() called before every Claude API call?
2. Model strings — are models hardcoded as strings instead of using constants?
3. Cache placement — is cache_control on the content block, not top-level?
4. max_tokens — is it set intentionally per task, not left at default?
5. Tool loop — does every tool loop have a MAX_STEPS guard?
6. ACL — does checkACL() fire before every tool execution?
7. Credentials — are API keys coming from environment, not code or prompts?
8. Audit logging — is every tool call logged before AND after?

If all checks pass, output: ALL_CLEAR with a one-line summary of what was verified.`,
  },

  {
    id: "pr-description-generator",
    name: "PR Description Generator",
    category: "workflow",
    model: "sonnet",
    variable_hint: "git diff or list of changed files with brief context (200-800 tokens)",
    system_prompt: `You are a senior engineer writing pull request descriptions.

When given a diff or list of changes, write a PR description in this format:

## Summary
[2-3 sentences: what changed and why]

## Changes
[bullet list of specific technical changes — one per file or component]

## Testing
[bullet list: what was tested, how, what edge cases were covered]

## Risk
[LOW / MEDIUM / HIGH] — [one sentence justification]

## Checklist
- [ ] Tests added or updated
- [ ] No hardcoded credentials
- [ ] Breaking changes documented
- [ ] Reviewer attention needed on: [specific area or NONE]

Rules:
- Summary must explain the WHY, not just the WHAT
- Changes must be specific — not "updated various files"
- Risk must be honest — if deleting data or changing auth, say HIGH`,
  },
];

// =============================================================
// BUILD THE LIBRARY
// =============================================================

async function buildLibrary() {
  console.log("\n" + "═".repeat(60));
  console.log("  BUILDING TOKEN LIBRARY");
  console.log("  Counting tokens once for every skill system prompt");
  console.log("═".repeat(60));
  console.log(`\n  Skills to process: ${SKILLS.length}`);
  console.log("  Each skill is counted ONCE — results saved to JSON");
  console.log("  After this, routing requires ZERO API calls\n");

  const library = {
    built_at: new Date().toISOString(),
    model_used_for_counting: HAIKU,
    note: "System prompt tokens are exact. Variable tokens are estimated at runtime using local approximation (1 token per 3.5 chars).",
    skills: {},
  };

  let totalCountingCalls = 0;
  let totalSystemTokens  = 0;

  for (const skill of SKILLS) {
    process.stdout.write(`  Counting: ${skill.name}...`);

    const systemTokens = await countTokens(skill.system_prompt);
    totalSystemTokens  += systemTokens;
    totalCountingCalls += 1;

    library.skills[skill.id] = {
      name:            skill.name,
      category:        skill.category,
      model:           skill.model,
      variable_hint:   skill.variable_hint,
      system_tokens:   systemTokens,
      cache_eligible:  systemTokens >= 1024,
      cache_note:      systemTokens >= 1024
        ? "System prompt will be cached — 90% cheaper after first call"
        : `System prompt is ${systemTokens} tokens — below 1024 cache threshold. Consider expanding.`,
    };

    console.log(` ${systemTokens} tokens ${systemTokens >= 1024 ? "✅ cache eligible" : "⚠️  below cache threshold"}`);

    // Rate limit breathing room
    await new Promise(r => setTimeout(r, 400));
  }

  // Save to JSON
  writeFileSync("token-library.json", JSON.stringify(library, null, 2));

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("  LIBRARY BUILT");
  console.log("═".repeat(60));
  console.log(`\n  Skills indexed:     ${SKILLS.length}`);
  console.log(`  API calls made:     ${totalCountingCalls} (one-time cost)`);
  console.log(`  Total sys tokens:   ${totalSystemTokens}`);
  console.log(`  Cache eligible:     ${Object.values(library.skills).filter(s => s.cache_eligible).length} of ${SKILLS.length}`);
  console.log(`\n  Saved to: token-library.json`);
  console.log(`\n  From this point forward:`);
  console.log(`  - System prompt tokens → look up from JSON (0 API calls)`);
  console.log(`  - Variable input tokens → local estimate (0 API calls)`);
  console.log(`  - Total routing overhead → ~0ms, $0.00`);
  console.log("\n" + "═".repeat(60) + "\n");
}

buildLibrary().catch(err => {
  console.error("\n❌ Build failed:", err.message);
  process.exit(1);
});
