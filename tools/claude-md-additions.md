# CLAUDE.md — Terminal Prompter Additions
### Paste this section into your project's CLAUDE.md
### Claude Code will follow these rules on every prompt automatically.

---

## PASTE THIS INTO YOUR CLAUDE.md

```markdown
---

## AI Best Practices — Standing Instructions
These rules apply to every prompt, every file, every suggestion.
Never violate them even if the user doesn't mention them.

---

### Token Discipline
- Before writing any code that calls the Anthropic API — estimate the token count
- Always recommend the correct model based on task type:
  - Legal, security, architecture decisions → Opus
  - Debugging, summarisation, medium complexity → Sonnet
  - Formatting, extraction, classification, journey tracing → Haiku
- Never hardcode model name strings — always use MODELS.HAIKU, MODELS.SONNET, MODELS.OPUS
- Never leave max_tokens at default — set it intentionally per task
- Token count ≠ task complexity. A 200-token legal question needs Opus.
  A 3000-token formatting job runs fine on Haiku.

### Prompt Caching
- cache_control goes on the CONTENT BLOCK — never top level
- Correct: system: [{ type: "text", text: "...", cache_control: { type: "ephemeral" } }]
- Wrong:   { cache_control: { type: "ephemeral" }, system: "..." }  ← silently ignored
- Only cache when system prompt exceeds 1024 tokens
- Always add anthropic-beta: prompt-caching-2024-07-31 header when caching

### Security — ACL
- Every skill has an explicit list of allowed tools — nothing else
- checkACL() fires before EVERY tool execution — no exceptions
- Read tools: get_jira_issue, search_kibana_logs, get_repo_context, get_journey_events
- Write tools: create_jira_comment, create_github_pr — require explicit permission
- If a skill tries to call a tool not in its allowed list — block and log, never execute
- Claude never touches APIs directly. Your code executes. Your code gates.

### Security — Hardening
- Validate every tool input field before execution — whitelist values where possible
- Rate limit per user AND per skill — not just globally
- Log every tool call before AND after execution — not just write tools
- Credentials come from environment variables only — never from prompts or code
- Never pass API keys in system prompts or messages — Claude must never see credentials

### Tool Loop
- Always set MAX_STEPS — never allow an infinite tool loop
- Default MAX_STEPS = 5 unless explicitly justified
- Graceful degradation on step limit — never throw a hard error
- One orchestrator. Narrow agents. Not one giant agent.
- At each step: Claude states the tool and reason before calling it

### Issue Investigation
- Never diagnose before gathering evidence
- Always collect: Jira ticket + Kibana logs + repo context before reasoning
- Tools first. Reasoning second. Always.
- Confidence levels must reflect actual evidence — not guesses stated confidently

### Journey Instrumentation
- Every user step needs: session_id, timestamp, step name, status, duration, metadata
- Anomaly flag must be set explicitly by your code — do not rely on Claude to infer it
- Always use Haiku for step annotation — this runs thousands of times a day
- Payment charged + order failed = always ANOMALY + ALERT, no exceptions

### General Rules
- Never speculate without evidence — say what evidence is missing instead
- Never suggest TypeScript or Python for this project — Node.js and Java only
- Never use require() — always use import/export (ES modules)
- Never commit or log .env files or API keys
- Never open or modify orchestrator/sidekick.js unless explicitly asked
- When in doubt — show the wrong way first, then the right way
```

---

## HOW TO USE THIS

1. Open your project's `CLAUDE.md`
2. Paste the block above at the bottom
3. Save it
4. Next time you open Claude Code — it reads these rules automatically
5. Every prompt you type will be answered following these constraints

---

## TESTING IT WORKS

After adding to CLAUDE.md, open Claude Code and type:

```
What are the token discipline rules for this project?
```

Claude Code should recite the rules back from CLAUDE.md.

Then type:
```
Write a function that calls the Anthropic API with model: "claude-opus-4-5"
```

Claude Code should correct you: *"Based on CLAUDE.md, model strings should use MODELS.OPUS, not hardcoded strings."*

---

## PER-PROJECT CUSTOMISATION

For your specific Sidekick project, also add:

```markdown
### Sidekick-Specific Rules
- Skill registry lives in SKILL_REGISTRY — add new skills there, not inline
- Every new skill needs: name, description, preferredModel, tools[], allowWrite flag
- Tool schemas live in TOOL_SCHEMAS in mock-executors.js — add new tools there
- All mock data lives in mock-data.js — never create data inline in demo files
- The fictional app is an e-commerce platform, Spring Boot 3, Java 17
- The bug is always NullPointerException at OrderProcessor.java:142
- Session ID for testing: sess-7f3a9b
- Test Jira ticket: APP-123
```
