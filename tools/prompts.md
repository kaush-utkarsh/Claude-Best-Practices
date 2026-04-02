# prompts.md
### Copy-paste prompt patterns — one per demo
### Fill in the [BRACKETS] and send.

---

## HOW TO USE THIS FILE

Every pattern below encodes the best practice from its demo.
Copy the pattern. Fill in the brackets. Send it.
Claude will follow the discipline built into the prompt.

---

## DEMO 1a — Token Routing
**Best practice: Count before you call. Route by complexity.**

```
Before you answer this — estimate the token count of your response,
recommend whether this needs Haiku, Sonnet, or Opus, and explain why.
Then proceed.

My task: [DESCRIBE YOUR TASK HERE]
```

**When to use:** Any time you're unsure which model to use.

---

## DEMO 1b — Prompt Caching
**Best practice: Don't re-process the same context twice.**

```
I have a system prompt I send on every call. It is:

[PASTE YOUR SYSTEM PROMPT HERE]

Tell me:
1. Is this long enough to benefit from caching? (minimum 1024 tokens)
2. Where exactly should I add cache_control?
3. Show me the correct block structure.
4. Show me the wrong way (top-level) so I know what to avoid.
```

**When to use:** When you're building a skill with a long system prompt.

---

## DEMO 2a — ACL
**Best practice: Every tool call needs a permission check.**

```
I am building a skill called "[SKILL NAME]".
Its purpose is: [DESCRIBE WHAT IT DOES]

Before we write any code:
1. List the tools this skill should be allowed to call
2. List the tools it should NEVER be allowed to call
3. Classify each tool as READ or WRITE
4. Tell me which write tools need an approval gate
5. Show me the checkACL() function for this skill
```

**When to use:** Before building any new skill in Sidekick.

---

## DEMO 2b — Pipeline Hardening
**Best practice: Validate inputs. Rate limit. Audit everything.**

```
Review this tool executor for security issues:

[PASTE YOUR TOOL EXECUTOR CODE HERE]

Check for:
1. Input validation — are all fields validated before use?
2. Rate limiting — is there a per-user, per-skill limit?
3. Audit logging — is every call logged before AND after execution?
4. Credential handling — are any keys visible in the code or prompts?

For each issue found: show the problem and the fix.
```

**When to use:** Before deploying any tool executor to production.

---

## DEMO 3 — Tool Loop / Agentic
**Best practice: Claude decides. You execute. Never infinite.**

```
You are an agent investigating [DESCRIBE THE GOAL].

Rules:
- Maximum 5 steps. Stop at 5 even if incomplete.
- At each step: state the tool you want to call and WHY before calling it.
- After each tool result: summarise what you learned in one sentence.
- Only draw conclusions after gathering evidence from at least 2 sources.
- If you hit the step limit: summarise partial findings and stop cleanly.

Available tools: [LIST YOUR TOOLS]

Begin investigation.
```

**When to use:** Any time you want Claude to investigate something autonomously.

---

## DEMO 4 — Issue Debugger
**Best practice: Evidence first. Never diagnose from symptom alone.**

```
I have a bug to investigate: [DESCRIBE THE SYMPTOM]

Do NOT diagnose yet.

First, tell me:
1. What evidence do you need before you can diagnose this?
2. Which systems do you need to check? (logs, code, tickets)
3. What would confirm your hypothesis vs rule it out?

Once I provide the evidence, then diagnose.

Here is what I have so far:
[PASTE WHATEVER EVIDENCE YOU HAVE — or write "none yet"]
```

**When to use:** Any production bug investigation.

---

## DEMO 4 — Issue Debugger (with evidence)
**Use this after gathering evidence.**

```
Here is the evidence for bug [ISSUE ID]:

JIRA TICKET:
[PASTE TICKET CONTENT]

KIBANA LOGS:
[PASTE RELEVANT LOG LINES]

CODE CONTEXT:
[PASTE THE RELEVANT CODE SECTION]

Now diagnose. Respond in exactly this format:

ROOT CAUSE: [one sentence]
SERVICE: [service name]
FILE: [filename]
LINE: [line number]
CONFIDENCE: [High/Medium/Low]

FIX:
[before and after code]

TEST:
[one specific test case]
```

**When to use:** After gathering all evidence from logs, code, and ticket.

---

## DEMO 5 — Journey Tracer
**Best practice: Instrument every step. Flag anomalies explicitly.**

```
Analyse this user journey. For each step, classify it as:
STATUS: [NORMAL | SLOW | ANOMALY]
ACTION: [NONE | INVESTIGATE | ALERT]

Rules:
- SLOW = completed but took longer than 2000ms
- ANOMALY = failed, skipped, or suspicious signals
- If payment charged but order failed → always ANOMALY + ALERT
- If user saw no error message on failure → always ANOMALY + ALERT

Journey steps:
[PASTE YOUR JOURNEY DATA HERE — step name, status, duration, metadata]

After all steps: provide a one-line session summary and business impact.
```

**When to use:** Analysing user session data for anomalies.

---

## UNIVERSAL — Before Any Claude API Call
**Use this when you're not sure which pattern to follow.**

```
Before we start:
1. Estimate token count for this task
2. Recommend the right model (Haiku/Sonnet/Opus) and why
3. Identify any security concerns (credentials, inputs, permissions)
4. Set a step limit if this involves tool use
5. Tell me what evidence you need before drawing conclusions

Task: [DESCRIBE YOUR TASK]
```

---

## UNIVERSAL — Code Review for Claude API Usage
**Use this to audit any file that calls the Anthropic API.**

```
Review this file for Claude API best practices:

[PASTE YOUR FILE HERE]

Check for:
1. Token counting before API calls? (should use countTokens on Haiku)
2. Model hardcoded as string? (should use MODELS.HAIKU constants)
3. cache_control at block level? (not top level)
4. max_tokens set intentionally? (not left at default)
5. Tool loop has MAX_STEPS? (never infinite)
6. ACL check before tool execution? (checkACL fires before executeTool)
7. Credentials in code or prompts? (should come from environment only)
8. Audit logging around tool calls? (log before AND after)

For each issue: show the line, explain the problem, show the fix.
```

**When to use:** Before any Claude API code goes to production.

---

## QUICK REFERENCE — One Line Each

```
Token routing:    "Estimate tokens, recommend model, show cost. Then proceed."
Caching:          "Show me where cache_control goes. Show the wrong way too."
ACL:              "List allowed tools. Classify read vs write. Show checkACL()."
Hardening:        "Check for: input validation, rate limits, audit logs, credentials."
Tool loop:        "Max 5 steps. State tool + reason before each call. Stop cleanly."
Issue debug:      "Tell me what evidence you need. Don't diagnose yet."
Journey trace:    "Classify each step: NORMAL/SLOW/ANOMALY. Flag payment+failure."
Universal review: "Check this file for all 7 Claude API best practices."
```
