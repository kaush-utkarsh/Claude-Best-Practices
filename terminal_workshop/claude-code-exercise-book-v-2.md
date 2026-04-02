# Claude Code — Guided Exercise Book
### Hands-on exercises for developers
### Session: Building With Claude Code

---

## How to Use This Book

This book has five modules. Each one builds on the last.

Every module has:
- A short concept explanation — what it is and why it matters
- One or two exercises — things you actually do, not just read
- A reflection — one question to answer before moving on

The reference section at the end is your day-to-day lookup guide.

You will need:
- Claude Code installed (see Installation below)
- A project folder — your own code or the training lab folder
- Your Anthropic API key configured

---

## Installation

```bash
# Windows users — run this first
wsl

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version

# Check everything is healthy
claude /doctor

# Update when new versions release
claude update
```

---

# MODULE 1
# The Terminal and the Agentic Loop

## What Is Claude Code

Claude Code is a coding agent that runs in your terminal. It is not a chatbot you paste code into. It is a program that reads your files, runs commands, makes changes, and reasons about what to do next — all inside a loop until the task is done or it needs you.

The loop works like this:

```
You send a message
    ↓
Claude reads your project context (git status, CLAUDE.md, date)
    ↓
Claude reasons and picks a tool to call
    ↓
You approve or it auto-approves
    ↓
Tool runs — file read, command executed, code written
    ↓
Result goes back to Claude
    ↓
Claude decides what to do next
    ↓
Repeat until done
```

Your files never leave your machine unless you use a tool that explicitly sends them (like web search or MCP tools).

---

## The Working Tree

Before Claude does anything it loads your working tree state. Every conversation starts with:

- Current git branch and last 5 commits
- Which files have changed (git status)
- Today's date
- Your CLAUDE.md files

This is why Claude already knows context when you open it. It did not guess — it read.

---

## Exercise 1.1 — Open Claude Code and Watch It Load

**Time:** 5 minutes

**Step 1:** Navigate to any project folder with git.

```bash
cd your-project-folder
```

**Step 2:** Open Claude Code.

```bash
claude
```

**Step 3:** Type this exact prompt:

```
What do you already know about this project before I tell you anything?
List everything you loaded at startup.
```

**What to notice:**
- It knows your branch name
- It knows recent commit messages
- It knows which files are modified
- It knows today's date
- It loaded your CLAUDE.md if one exists

**Step 4:** Now ask:

```
Show me the last 3 commits and tell me what this project has been working on recently.
```

Claude reads your git log and reasons about the recent work — without you pasting anything.

---

## Exercise 1.2 — Run a One-Shot Command

**Time:** 5 minutes

Claude Code does not require an interactive session. You can use it like a command-line tool.

**Step 1:** From your terminal (not inside Claude Code), run:

```bash
claude -p "What does this project do? Give me one paragraph."
```

**Step 2:** Try piping data in:

```bash
cat package.json | claude -p "What dependencies does this project have and which ones look unused?"
```

```bash
cat error.log | claude -p "Find the root cause of this error"
```

```bash
git log --oneline -10 | claude -p "Summarise what changed in these commits"
```

**Step 3:** Try with a specific file reference:

```bash
claude -p "@src/index.js explain what this file does in plain English"
```

The @ symbol references a file directly. Claude reads it before responding.

**Step 4:** Try JSON output for scripting:

```bash
claude -p "List all API endpoints in this project" --output-format json
```

**Step 5:** Limit turns for a quick focused task:

```bash
claude -p "What is the purpose of this file?" --max-turns 1
```

**Reflection question:**
When would you use one-shot mode versus interactive mode? Name two situations for each.

---

# MODULE 2
# CLAUDE.md — Your Standing Brief

## What CLAUDE.md Does

CLAUDE.md is a file Claude reads automatically at the start of every session. It does not need to be prompted. It does not expire. Every instruction in it applies to every conversation in that project — forever, until you change it.

Think of it as the standing brief you would give a new developer joining your team. Except you write it once and never repeat yourself again.

Claude Code loads CLAUDE.md files from four places, in this order:

```
~/.claude/CLAUDE.md          → applies to ALL your projects
./CLAUDE.md                  → your project root (check this into git)
./subfolder/CLAUDE.md        → loaded when working in that folder
~/.claude/my-overrides.md    → personal overrides (via @import)
```

---

## What to Put In It

The test for every line: **Would removing this cause Claude to make a mistake?**

If yes — keep it.
If no — cut it.

**Include:**
- Bash commands Claude cannot guess (your test runner, lint command, build command)
- Code style rules that differ from defaults
- Architectural decisions specific to your project
- Things Claude should never do (never commit to main, never modify migrations)
- Branch naming conventions, PR conventions
- Developer environment quirks (required env vars, non-obvious setup)

**Do not include:**
- Things Claude can figure out by reading the code
- Standard language conventions Claude already knows
- Long explanations or tutorials
- Things that change frequently
- Self-evident practices like "write clean code"
- File-by-file descriptions of the codebase

A bloated CLAUDE.md is worse than no CLAUDE.md. When it is too long, Claude ignores half of it and important rules get lost in the noise.

**Emphasis tip:** Add `IMPORTANT` or `YOU MUST` to rules Claude keeps ignoring. Example: `IMPORTANT: Never commit directly to main.`

---

## Exercise 2.1 — Generate Your First CLAUDE.md

**Time:** 10 minutes

**Step 1:** Inside a project folder, open Claude Code and run:

```
/init
```

This analyses your project and generates a starter CLAUDE.md.

**Step 2:** Open the generated file in your editor. Read it. Ask yourself for each line: *Would removing this cause Claude to make a mistake?* Cut anything that fails the test.

**Step 3:** Add at least three things from this list that apply to your project:

```markdown
# Run commands
- To run tests: [YOUR TEST COMMAND]
- To build: [YOUR BUILD COMMAND]
- To lint: [YOUR LINT COMMAND]

# Rules
- Never commit directly to main
- Always run tests before committing
- Use [YOUR IMPORT STYLE] for imports

# Architecture
- [ONE KEY ARCHITECTURAL DECISION]
- [ONE THING CLAUDE SHOULD NEVER CHANGE]
```

**Step 4:** Test it. Close and reopen Claude Code. Type:

```
What are the rules for this project?
```

Claude should recite your CLAUDE.md rules back accurately.

**Step 5:** Test enforcement. Type:

```
Write a function that calls the Anthropic API using the model string "claude-opus-4-5"
```

If your CLAUDE.md says to use constants instead of hardcoded strings — Claude should correct itself.

---

## Exercise 2.2 — Use @imports to Keep CLAUDE.md Lean

**Time:** 5 minutes

CLAUDE.md can import other files instead of repeating their content.

**Step 1:** Create a file called `docs/api-conventions.md` with your team's API design rules.

**Step 2:** In your CLAUDE.md, add:

```markdown
# API Conventions
See @docs/api-conventions.md for all REST API design rules.

# Project overview
See @README.md for project overview.
```

**Step 3:** Ask Claude:

```
What are our API conventions for URL paths?
```

Claude reads the imported file and answers from it.

**Why this matters:** Your CLAUDE.md stays short. The detail lives in the right place. When conventions change, you update one file.

**Reflection question:**
What is the single most important rule for your project that Claude must never break? Is it in your CLAUDE.md now?

---

# MODULE 3
# Permissions and the Working Tree

## How Permissions Work

Claude does not run commands on your machine without asking — unless you tell it to. Every tool call goes through a permission check:

| Result | What happens |
|---|---|
| Allow | Tool runs immediately |
| Ask | Claude pauses, shows you the command, waits for approval |
| Deny | Tool is blocked, Claude gets an error result |

There are four permission modes:

**Default mode** — Claude asks for approval on file writes and bash commands. Read-only operations (reading files, searching) are auto-approved.

**Auto mode** — A separate classifier model reviews commands before they run. Blocks risky operations automatically. You do not get interrupted for routine work.

**Accept edits mode** — File edits are auto-approved. Bash commands still ask.

**Bypass mode** — Everything runs without asking. Use only in sandboxed environments.

---

## What "Allow All" Actually Means

When you click Allow all at the start of a session you are saying: for this session, auto-approve everything in this category.

It does not mean forever. It resets when you close the session.

For live demos, click Allow all when Claude Code first opens. You do not want permission prompts interrupting your presentation.

For sensitive codebases, use Auto mode instead. A classifier reviews commands and blocks scope escalation without requiring your attention on every step.

---

## Exercise 3.1 — Explore Permissions Live

**Time:** 10 minutes

**Step 1:** Open Claude Code in default mode. Type:

```
Create a file called test-permissions.txt with the text "permission test"
```

**What to observe:** Claude asks permission before writing the file. You see the exact command it wants to run. You choose Allow or Deny.

**Step 2:** When the permission dialog appears, choose **Allow all file writes for this session.**

**Step 3:** Ask Claude to create two more files. They should run without prompting.

**Step 4:** Try restricting specific tools from the command line. Exit and restart:

```bash
claude --allowedTools "Bash(git log:*)" "Bash(git diff:*)" "Read"
```

Now ask Claude to read files and run git commands. Both work. Ask it to write a file. It is blocked.

**Step 5:** Try the reverse — block dangerous commands:

```bash
claude --disallowedTools "Bash(rm:*)" "Bash(sudo:*)"
```

Ask Claude to delete a file. Watch it get blocked.

---

## Exercise 3.2 — Auto Mode and Allowlists

**Time:** 5 minutes

**Step 1:** Try Auto mode:

```bash
claude --permission-mode auto
```

Type:

```
Run the linter and fix any issues
```

Watch Claude run the linter without asking. If it tries something risky, the classifier blocks it automatically.

**Step 2:** Inside any Claude Code session, type:

```
/permissions
```

Add an allowlist entry for your most common safe command — for example `npm run lint` or `mvn test`.

**Step 3:** Ask Claude to run that command. It should fire without asking.

**Why this matters:** After ten approvals in a row you are not reviewing anything — you are just clicking. Allowlisting safe commands removes the noise so your attention goes to things that actually need reviewing.

**Reflection question:**
Which three commands in your project are safe enough to always allow? Which ones should always ask for approval?

---

# MODULE 4
# Working Effectively — Context, Sessions, and Prompts

## The Fundamental Constraint

Everything about working well with Claude Code comes down to one thing: the context window fills up fast, and performance degrades as it fills.

Every message, every file Claude reads, every command output — it all accumulates. A single debugging session can consume tens of thousands of tokens. When the window fills, Claude starts forgetting earlier instructions and making more mistakes.

Managing context is the highest-leverage skill in working with Claude Code.

---

## The Four Patterns That Work

**1. Explore first, then plan, then code**

Do not let Claude jump straight to coding. Use Plan Mode to separate research from execution.

Press `Shift+Tab` to toggle Plan Mode. In Plan Mode, Claude reads and reasons but does not make changes.

**2. Course-correct early**

The moment you see Claude going in the wrong direction — press `Escape`. Context is preserved. You can redirect immediately. Waiting until Claude finishes a wrong approach wastes context and time.

**3. Clear context between tasks**

After you finish one task and start something unrelated — run `/clear`. Starting a new task in a context full of a previous task is like explaining a new problem to someone still thinking about the old one.

**4. Use subagents for investigation**

When you need Claude to explore a large codebase, use a subagent. It runs in its own context window, reads whatever it needs, and reports back a summary. Your main conversation stays clean.

```
Use a subagent to investigate how our authentication system handles token refresh.
Report back with a summary only — do not read files in this conversation.
```

---

## Exercise 4.1 — The Explore-Plan-Code Workflow

**Time:** 15 minutes

Pick a real task in your codebase — something you actually want to do.

**Step 1:** Open Plan Mode with `Shift+Tab`. The prompt shows `[Plan Mode]`.

**Step 2:** Ask Claude to explore first:

```
Read [relevant files or folders] and understand how [the area you are working on] works.
Do not make any changes yet.
```

**Step 3:** Ask for a plan:

```
I want to [describe your task].
What files need to change?
What is the correct approach?
Write a plan.
```

Read the plan. If something looks wrong, correct it now — before any code is written.

**Step 4:** Press `Ctrl+G` to open the plan in your text editor and edit it directly if needed.

**Step 5:** Toggle back to Normal Mode with `Shift+Tab`. Implement:

```
Implement the plan. Run tests after each change and fix any failures.
```

**What to notice:** Implementing against a plan is faster than letting Claude figure out the approach mid-implementation. Errors are caught earlier.

---

## Exercise 4.2 — Context Management in Practice

**Time:** 10 minutes

**Step 1:** Start a session and do some work. Ask a few questions, read some files.

**Step 2:** Check your context usage:

```
/cost
```

You will see how many tokens this session has used and its cost.

**Step 3:** Try a targeted compact:

```
/compact Focus on the main task — ignore the exploration files
```

Claude summarises the conversation, keeping what matters and discarding noise.

**Step 4:** Ask a quick side question without polluting context:

```
/btw what does the --verbose flag do for this npm script?
```

The answer appears in a dismissible overlay and never enters conversation history. Your context stays clean.

**Step 5:** For a completely unrelated new task, run:

```
/clear
```

Fresh start. No accumulated noise.

**Step 6:** Name your session so you can find it later:

```
/rename auth-migration
```

Resume it in a future session:

```bash
claude --continue      # resume most recent
claude --resume        # pick from list
```

---

## Exercise 4.3 — Giving Claude Verification Criteria

**Time:** 10 minutes

The single highest-leverage thing you can do is give Claude a way to verify its own work.

**Without verification:**
```
Add input validation to the checkout form
```
Claude writes something. It might work. You have to check manually.

**With verification:**
```
Add input validation to the checkout form.
Test cases:
- Empty email field → show "Email is required"
- Invalid email format → show "Enter a valid email"
- Valid email → no error shown
Run the tests after implementing and confirm all three cases pass.
```

**Step 1:** Pick a function in your codebase that has no tests.

**Step 2:** Ask Claude:

```
Write tests for [function name] covering:
- [happy path case]
- [edge case 1]
- [edge case 2]
Run the tests. If any fail, fix the function until all pass.
```

**Step 3:** Watch Claude write tests, run them, discover failures, fix the code, and verify.

**What to notice:** Claude is now the feedback loop, not you. You redirected your attention from writing tests to deciding what to test.

**Reflection question:**
What task do you do regularly that would benefit from giving Claude explicit verification criteria? Write the criteria now.

---

# MODULE 5
# Advanced Patterns

## Skills — Reusable Workflows

Skills are files in `.claude/skills/` that give Claude domain knowledge or repeatable workflows. Unlike CLAUDE.md which loads every session, skills load on demand — Claude pulls them in automatically when relevant, or you invoke them directly.

```
.claude/skills/fix-issue/SKILL.md
```

```markdown
---
name: fix-issue
description: Fix a GitHub issue end to end
---
Fix the GitHub issue: $ARGUMENTS

Steps:
1. Use gh issue view to read the issue details
2. Search the codebase for relevant files
3. Implement the fix
4. Write a test that verifies the fix
5. Run the test suite
6. Commit with a descriptive message
7. Create a PR
```

Run it with: `/fix-issue 1234`

Skills are most useful for workflows you do repeatedly — bug fixes, PR reviews, feature implementations, migration patterns.

---

## Checkpoints and Rewind

Every action Claude takes creates a checkpoint. You can rewind to any previous state.

Press `Escape + Escape` or run `/rewind` to open the rewind menu. You can:
- Restore both conversation and code state
- Restore only conversation (keep code changes)
- Restore only code (keep conversation)
- Summarise from a checkpoint

The practical implication: you can tell Claude to try something risky. If it does not work, rewind and try differently. Checkpoints persist across sessions.

---

## Exercise 5.1 — Create a Skill for Your Team

**Time:** 15 minutes

Pick a workflow your team does repeatedly. Good candidates:
- Code review checklist
- Bug triage process
- Deployment steps
- PR description format
- Onboarding a new module

**Step 1:** Create the skills folder:

```bash
mkdir -p .claude/skills/your-workflow
touch .claude/skills/your-workflow/SKILL.md
```

**Step 2:** Write the skill using this template:

```markdown
---
name: your-workflow
description: One sentence describing when to use this
---
# [Workflow Name]

Context: [When is this skill relevant?]

Steps:
1. [First thing to do]
2. [Second thing]
3. [Third thing]

Rules:
- [Important constraint]
- [Another constraint]

Output format:
[What the result should look like]
```

**Step 3:** Test it in Claude Code:

```
/your-workflow [relevant input]
```

**Step 4:** If Claude does not follow the workflow correctly, refine the SKILL.md. Treat it like code — iterate until it behaves exactly as intended.

---

## Exercise 5.2 — Rewind in Practice

**Time:** 10 minutes

**Step 1:** Ask Claude to make a change you are not 100% sure about:

```
Refactor the authentication module to use the new session pattern.
```

**Step 2:** Let it run partway.

**Step 3:** Press `Escape + Escape` to open the rewind menu.

**Step 4:** Rewind to before the change started. Confirm the code is back.

**Step 5:** Give Claude a more specific instruction before letting it proceed.

**What to notice:** The rewind is immediate. There is no undo stack. You restore a named checkpoint.

---

## Exercise 5.3 — The Interview Pattern

**Time:** 15 minutes

For larger features, do not write a long prompt. Let Claude interview you first.

**Step 1:** Type this:

```
I want to build [brief description of a feature].

Interview me using the AskUserQuestion tool.
Ask about: technical implementation, edge cases, tradeoffs, UI decisions.
Do not ask obvious questions. Dig into the hard parts I might not have considered.
Keep interviewing until we have covered everything.
Then write a complete spec to SPEC.md.
```

**Step 2:** Answer Claude's questions. If you do not know the answer to something, say so — Claude will note it as a gap.

**Step 3:** Review the SPEC.md that Claude writes.

**Step 4:** Start a fresh session to implement:

```
/clear
```

Then:

```
Implement the spec in SPEC.md. Read it fully before writing any code.
```

**Why this matters:** The spec becomes the contract. You both agree on what done looks like before any code is written.

**Reflection question:**
What is the next significant feature your team needs to build? Write one sentence describing it. That is your starting point for the interview pattern.

---

## Exercise 5.4 — Automation and CI Integration

**Time:** 10 minutes

Claude Code runs non-interactively for CI pipelines, pre-commit hooks, and scripts.

**Step 1:** Run a one-shot analysis and save the output:

```bash
claude -p "analyze this codebase for security issues" --output-format json > security-report.json
```

**Step 2:** Fan out across multiple files:

```bash
for file in src/*.js; do
  claude -p "Check $file for common bugs and return PASS or FAIL with reason" \
    --allowedTools "Read" \
    --max-turns 1
done
```

**Step 3:** Add to a pre-commit hook:

```bash
# .git/hooks/pre-commit
git diff --cached --name-only | claude -p "Review these staged files for obvious issues before commit"
```

**Step 4:** Run parallel sessions for independent tasks:

```bash
# Two Claude sessions running simultaneously
claude -p "Write unit tests for src/auth.js" > tests-auth.js &
claude -p "Write unit tests for src/payments.js" > tests-payments.js &
wait
```

**What to notice:** Non-interactive mode is identical to interactive mode in capability — same tools, same reasoning, no UI.

---

# REFERENCE

## Complete Command Reference

### Starting Claude Code

| Command | What it does |
|---|---|
| `claude` | Open interactive REPL |
| `claude "your prompt"` | Open REPL with initial prompt |
| `claude -p "prompt"` | One-shot, print and exit |
| `claude --continue` or `claude -c` | Resume most recent conversation |
| `claude --resume` | Pick from recent conversations |
| `claude --resume abc123 "query"` | Resume specific session by ID |
| `claude --version` | Check installed version |
| `claude update` | Update to latest version |

### CLI Flags

| Flag | What it does | Example |
|---|---|---|
| `--model` | Specify model | `--model claude-sonnet-4-5` |
| `--add-dir` | Add working directories | `--add-dir ../apps ../lib` |
| `--allowedTools` | Allow tools without prompting | `--allowedTools "Bash(git:*)" "Read"` |
| `--disallowedTools` | Block specific tools | `--disallowedTools "Bash(rm:*)"` |
| `--output-format` | Set output format | `--output-format json` |
| `--output-format stream-json` | Stream JSON in real time | (for large tasks) |
| `--max-turns` | Limit conversation turns | `--max-turns 3` |
| `--verbose` | Enable verbose logging | `--verbose` |
| `--permission-mode auto` | Auto-approve with classifier | (no interruptions) |
| `--dangerously-skip-permissions` | Skip all permission prompts | **Sandboxes only** |

### Slash Commands — Session

| Command | What it does |
|---|---|
| `/clear` | Reset context entirely — fresh start |
| `/compact` | Summarise conversation to free context |
| `/compact Focus on X` | Compact keeping specific context |
| `/btw your question` | Side question — never enters context |
| `/cost` | Show token usage and cost for this session |
| `/rename session-name` | Name this session for later reference |
| `/rewind` | Open checkpoint restore menu |

### Slash Commands — Configuration

| Command | What it does |
|---|---|
| `/init` | Generate starter CLAUDE.md for this project |
| `/permissions` | Manage tool allowlists |
| `/hooks` | View and configure hooks |
| `/mcp` | Manage MCP server connections |
| `/ide` | Manage IDE integrations |
| `/config` | Open configuration panel |
| `/doctor` | Check Claude Code installation health |
| `/help` | Show all available commands |

### Keyboard Shortcuts

| Shortcut | What it does |
|---|---|
| `Shift+Tab` | Toggle Plan Mode (explore without changes) |
| `Escape` | Stop Claude mid-response, context preserved |
| `Escape + Escape` | Open rewind/checkpoint menu |
| `Ctrl+G` | Open current plan in text editor |
| `Ctrl+C` | Cancel current operation |
| `Ctrl+D` | Exit Claude Code |
| `↑ / ↓` | Navigate command history |
| `Tab` | Auto-complete |

### @ References

```bash
@filename.js          # Read this file before responding
@src/folder/          # Reference all files in this folder
@README.md            # Read this specific file
```

Use in prompts:
```
@src/auth.js explain what this file does
```

Use in CLAUDE.md imports:
```markdown
See @docs/conventions.md for our API design rules.
```

---

## Piping and Automation Patterns

### Pipe data into Claude

```bash
cat error.log | claude -p "Find the root cause"
git log --oneline -20 | claude -p "Summarise what changed"
git diff HEAD~1 | claude -p "Review this PR for security issues"
ls -la | claude -p "Explain this directory structure"
docker logs app | claude -p "Find errors in these logs"
```

### Output formats for scripting

```bash
# Plain text (default)
claude -p "Explain this project" --output-format text

# JSON — for parsing with jq or scripts
claude -p "List all API endpoints" --output-format json

# Streaming JSON — for real-time processing of large tasks
claude -p "Analyze this large codebase" --output-format stream-json
```

### Batch processing

```bash
# Process multiple files
for file in src/*.js; do
  claude -p "Check $file for bugs" --max-turns 1 --allowedTools "Read"
done

# Parallel execution
claude -p "Write tests for auth module" > tests-auth.js &
claude -p "Write tests for payments module" > tests-payments.js &
wait

# Save analysis to file
claude -p "Security audit" --output-format json > audit-report.json
```

### CI/CD integration

```bash
# Pre-commit hook
git diff --cached | claude -p "Review staged changes for obvious issues"

# Release notes from commits
git log --oneline v1.0..HEAD | claude -p "Generate release notes" > RELEASE_NOTES.md

# Automated PR review
git diff main | claude -p "Review this PR. Return: APPROVE or REQUEST_CHANGES with reasons."
```

---

## Context Management Rules of Thumb

1. Clear between unrelated tasks — always
2. After two failed corrections — /clear and rewrite the prompt
3. For large codebase explorations — use subagents
4. For side questions — use /btw
5. For long sessions — /compact with specific instructions
6. CLAUDE.md should be under 50 lines or rules get ignored
7. Name sessions with /rename so you can resume them later

---

## The Mental Model

```
You provide:         Claude provides:
- The goal           - The steps
- The constraints    - The tool choices
- The verification   - The implementation
- The context        - The reasoning

You are the director.
Claude is the engineer.
CLAUDE.md is the handbook.
The context window is the budget.
```

---

## Troubleshooting

### Claude is not following CLAUDE.md rules

```
# Inside Claude Code:
What are the rules for this project?
```

If it cannot recite the rules accurately — CLAUDE.md is too long. Prune it. Keep only rules that would cause mistakes if removed.

### Performance is degrading mid-session

Context window is filling. Run:
```
/compact Focus on [your current task]
```
Or:
```
/clear
```
Then restate your task with a clean, specific prompt.

### Installation or health issues

```bash
claude --version       # confirm installation
claude /doctor         # run health check
npm uninstall -g @anthropic-ai/claude-code
npm install -g @anthropic-ai/claude-code
```

### Claude keeps making the same mistake

After two failed corrections, context is polluted with failed approaches. Do not correct a third time. Run `/clear` and start with a better prompt that incorporates what you learned.

### Permission prompts interrupting workflow

For read-only exploration, all reads are auto-approved — no action needed.
For file writes, use `/permissions` to allowlist commands you trust.
For fully unattended work, use `--permission-mode auto`.

---

## Key Rules From Anthropic's Official Best Practices

**Give Claude a way to verify its work.**
The single highest-leverage thing you can do. Tests, screenshots, expected outputs. Without verification criteria, you are the only feedback loop.

**Explore first, then plan, then code.**
Plan Mode prevents solving the wrong problem. For anything that touches more than two files — plan first.

**Correct early.**
The moment Claude goes off track, press Escape. Do not wait for it to finish. Accumulated corrections pollute context.

**Manage context aggressively.**
/clear between unrelated tasks. /compact for long sessions. Subagents for exploration. /btw for side questions.

**Keep CLAUDE.md short.**
If Claude keeps doing something wrong despite a rule in CLAUDE.md, the file is too long and the rule is getting lost. Prune ruthlessly.

**Verify before you ship.**
A plausible-looking implementation that does not handle edge cases is worse than no implementation. If you cannot verify it, do not ship it.

**Use sessions like branches.**
/rename your sessions. --resume to pick up where you left off. Treat long-running tasks as named workstreams with persistent context.
