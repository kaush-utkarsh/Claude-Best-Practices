# Claude Code — Hands-On Exercise Book
### A self-guided workbook for developers
### Session: Building With Claude Code

---

## Welcome

This book is your guide for today's session. You can work through it independently or follow along with the trainer.

Every module covers one concept. Each concept has a short explanation followed by exercises you run yourself. By the end you will have used Claude Code in ways most developers do not discover for months.

**What you need before starting:**
- Claude Code installed — see Installation below
- A project folder with git — your own code works best, or use the training lab folder
- Your Anthropic API key in your environment

**How to use this book:**
- Read the concept section first — it is short
- Do every exercise step by step
- At the end of each exercise, tick the self-check boxes
- If something breaks — that is fine, the Troubleshooting section at the end covers common issues

---

## Installation

Open your terminal and run:

```bash
# Windows users — run this first
wsl

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Confirm it installed correctly
claude --version

# Run a health check
claude /doctor

# Keep it current
claude update
```

You should see a version number and a healthy status. If not, jump to the Troubleshooting section at the end of this book.

---

# MODULE 1
# The Terminal and the Agentic Loop

## What Claude Code Actually Is

Most developers expect Claude Code to work like a chatbot — you paste code, it responds, you copy the answer back. That is not how it works.

Claude Code is a coding agent that runs inside your terminal. It reads your actual files, runs actual commands, writes actual code, and makes decisions about what to do next — all by itself — until the task is complete or it needs your input.

The technical name for this is an **agentic loop**. Here is what happens every time you send a message:

```
1. You type a message
2. Claude reads your project — git branch, recent commits,
   changed files, today's date, your CLAUDE.md rules
3. Claude decides which tool to call (read a file,
   run a command, write code)
4. Claude asks your permission — or auto-approves
5. The tool runs and the result goes back to Claude
6. Claude decides what to do next
7. Loop repeats until the task is done
```

This loop runs entirely on your machine. Your files do not leave your computer unless you use a tool that explicitly sends them — like web search.

---

## The Working Tree

Before Claude does anything in a session, it loads your working tree. This is automatic — you do not trigger it. Every conversation starts with:

- Your current git branch
- Your last 5 commits
- Which files have changed since the last commit
- Today's date
- The contents of any CLAUDE.md files in your project

This is why Claude already seems to know your project when you open it. It read your git history before you typed a single word.

---

## Exercise 1.1 — Watch the Loop in Action

**Time:** 5 minutes

**Goal:** See what Claude loads at startup and ask it to reason about your project from that context alone.

---

**Step 1** — Navigate to a project folder that has git set up.

```bash
cd your-project-folder
```

---

**Step 2** — Open Claude Code.

```bash
claude
```

You will see a welcome screen and a prompt. Claude has already read your project.

---

**Step 3** — Ask Claude what it already knows — before you tell it anything.

Type this exactly:

```
What do you already know about this project before I tell you anything?
List everything you loaded at startup.
```

**What you should see:**
Claude lists your branch name, your recent commit messages, which files are modified, today's date, and your CLAUDE.md contents if one exists. It did not guess any of this — it read your git state.

---

**Step 4** — Ask Claude to reason about recent work.

```
Based only on the last 3 commits — what has this project been working on recently?
```

**What you should see:**
Claude reads your commit messages and gives you a plain-English summary of recent development activity. No files pasted. No context given by you.

---

**Self-check:**
- [ ] Claude listed your branch name correctly
- [ ] Claude mentioned at least one recent commit
- [ ] Claude's summary of recent work made sense for your project

---

## Exercise 1.2 — One-Shot Mode and Piping

**Time:** 5 minutes

**Goal:** Use Claude Code as a command-line tool without opening an interactive session.

Claude Code has two modes. The interactive REPL (what you just used) and one-shot mode using the `-p` flag. One-shot fires a single prompt, prints the answer, and exits. This is how you integrate Claude into scripts, pipelines, and automation.

---

**Step 1** — Run a one-shot query from your terminal (not inside Claude Code).

```bash
claude -p "What does this project do? One paragraph."
```

**What you should see:**
A one-paragraph answer printed to your terminal, then your prompt returns. No interactive session opened.

---

**Step 2** — Pipe data directly into Claude.

```bash
cat package.json | claude -p "What dependencies does this project have? Which ones look unused?"
```

```bash
git log --oneline -10 | claude -p "Summarise what changed in these commits"
```

**What you should see:**
Claude reads the piped content as its input and answers based on it.

---

**Step 3** — Reference a specific file using the @ symbol.

```bash
claude -p "@src/index.js explain what this file does in plain English"
```

The @ symbol tells Claude to read that file before responding. You do not have to paste the content.

---

**Step 4** — Get structured output for scripting.

```bash
claude -p "List all API endpoints in this project" --output-format json
```

**What you should see:**
JSON output instead of plain text. Useful when you want to parse the result with another tool.

---

**Self-check:**
- [ ] One-shot mode returned an answer and exited cleanly
- [ ] Piping worked — Claude received and used the piped content
- [ ] @ reference worked — Claude described the file accurately
- [ ] JSON output looked different from the default text output

---

**Why this matters:**
One-shot mode is how you add Claude to CI pipelines, pre-commit hooks, and batch scripts. Everything you can do in interactive mode, you can do with `-p`.

---

# MODULE 2
# CLAUDE.md — Your Standing Brief

## What CLAUDE.md Does

Every time you open Claude Code in a project, it reads a file called CLAUDE.md if one exists. This happens automatically, before you type anything.

CLAUDE.md is your standing brief. It is the equivalent of a note you leave for a new developer joining your team — except Claude reads it perfectly every single time, never forgets it, and applies every rule in it to every prompt in that project.

Write it once. Claude follows it forever.

Claude loads CLAUDE.md from four locations, in this order:

```
~/.claude/CLAUDE.md        → your personal rules for every project
./CLAUDE.md                → this project's rules (check into git)
./subfolder/CLAUDE.md      → loaded when Claude works in that folder
```

You can also import other files from within CLAUDE.md using the `@` syntax. More on this in Exercise 2.2.

---

## What to Put In It — and What to Leave Out

The test for every line is: **Would removing this cause Claude to make a mistake?**

If yes — keep it.
If no — cut it.

**Put these in:**
- Your test command, build command, lint command — anything Claude cannot guess
- Code style rules that differ from language defaults
- Architecture decisions your project has made
- Things Claude must never do — never commit to main, never delete migration files
- Branch naming format, PR description format
- Environment variables that must be set

**Leave these out:**
- Things Claude can figure out by reading your code
- Standard conventions Claude already knows — like "use semicolons in JavaScript"
- Long explanations or tutorials
- File-by-file descriptions of your codebase
- Things that change every week

**The most important rule about CLAUDE.md:** keep it short. A bloated CLAUDE.md is worse than no CLAUDE.md. When the file is too long, Claude starts ignoring it. Important rules get buried. If Claude keeps doing something wrong despite a rule in the file — the file is probably too long.

A good CLAUDE.md is under 50 lines.

If Claude ignores a specific rule, add emphasis: `IMPORTANT: Never commit directly to main` or `YOU MUST run tests before committing`.

---

## Exercise 2.1 — Write Your First CLAUDE.md

**Time:** 10 minutes

**Goal:** Generate a starter CLAUDE.md, trim it to the essentials, and confirm Claude follows it.

---

**Step 1** — Open Claude Code inside your project folder.

```bash
claude
```

---

**Step 2** — Generate a starter file. Claude Code analyses your project structure and creates a CLAUDE.md based on what it finds.

```
/init
```

**What you should see:**
A CLAUDE.md file appears in your project root. Claude tells you what it included.

---

**Step 3** — Open the file in your editor and read every line.

For each line, ask yourself: *Would removing this cause Claude to make a mistake?*

Delete every line that fails this test. You are aiming for under 50 lines.

---

**Step 4** — Add at least three rules specific to your project. Use this as a template:

```markdown
# Commands
- Run tests: [your test command]
- Build: [your build command]
- Lint: [your lint command]

# Rules
- Never commit directly to main
- Always run tests before committing
- [One style rule specific to your project]

# Architecture
- [One architectural decision Claude should know]
- [One thing Claude should never change]
```

---

**Step 5** — Save the file. Close and reopen Claude Code. Test that it loaded.

```
What are the rules for this project?
```

**What you should see:**
Claude recites your rules back accurately. If it misses something important — your CLAUDE.md is probably too long, or the phrasing is ambiguous.

---

**Step 6** — Test that Claude actually enforces a rule. Type something that should be blocked:

```
Write a function that calls the Anthropic API using the hardcoded string "claude-opus-4-5"
```

If your CLAUDE.md says to use constants not hardcoded strings, Claude should catch this and correct itself before writing.

---

**Self-check:**
- [ ] /init generated a CLAUDE.md file
- [ ] You trimmed it to under 50 lines
- [ ] Claude recited your rules accurately when asked
- [ ] Claude caught and corrected a rule violation

---

## Exercise 2.2 — Keep CLAUDE.md Lean with @imports

**Time:** 5 minutes

**Goal:** Move detail out of CLAUDE.md and into imported files so the main file stays short.

CLAUDE.md can reference other files using `@path/to/file`. Claude reads the imported file when it needs it, but the reference in CLAUDE.md is just one line.

---

**Step 1** — Create a file for your team's conventions. For example:

```bash
mkdir -p docs
touch docs/conventions.md
```

Add some content to docs/conventions.md — your REST API rules, your naming conventions, your testing standards.

---

**Step 2** — In your CLAUDE.md, replace any detailed sections with a single import line:

```markdown
# Conventions
See @docs/conventions.md for code style, API design, and naming rules.
See @README.md for project overview and setup instructions.
```

---

**Step 3** — Ask Claude a question that requires the imported file:

```
What are our naming conventions for REST API endpoints?
```

**What you should see:**
Claude reads the imported file and answers from it — without you having to paste the content or reference the file path in your prompt.

---

**Self-check:**
- [ ] You created a conventions file with at least 3 rules
- [ ] CLAUDE.md references it with @
- [ ] Claude answered a question from the imported file correctly

---

**Why this matters:**
As projects grow, CLAUDE.md can get bloated. @imports let you keep the main file short while still giving Claude deep access to the knowledge it needs. Each imported file can be maintained independently and checked into git like any other documentation.

---

# MODULE 3
# Permissions

## How Permissions Work

Claude does not run commands on your machine without asking — unless you tell it to. Every tool call goes through a permission check before anything executes.

There are three possible outcomes for any tool call:

| Outcome | What happens |
|---|---|
| **Allow** | Tool runs immediately, result goes back to Claude |
| **Ask** | Claude pauses and shows you exactly what it wants to run. You approve or deny. |
| **Deny** | Tool is blocked. Claude gets an error and decides what to do next. |

---

## The Four Permission Modes

**Default mode**
Claude asks for your approval before writing files or running bash commands. Reading files is auto-approved — Claude never has to ask to look at your code.

**Auto mode**
A separate classifier model reviews every command before it runs. Routine work proceeds without interrupting you. Risky operations — deleting files, pushing to remote, scope escalation — get blocked automatically. Best for longer tasks where you want to step away.

**Accept edits mode**
File writes are auto-approved. Bash commands still ask. Good when you want Claude to freely edit code but stay cautious about running shell commands.

**Bypass mode**
Everything runs without asking. Only use this inside a sandbox or container that you can wipe. Never on your development machine.

---

## A Note on "Allow All"

When Claude asks permission and you choose **Allow all for this session** — you are saying auto-approve this category of action for the rest of this session. It resets when you close Claude Code. It does not affect other sessions.

For live demos and workshops, click Allow all at the start. Interruption prompts during a demonstration break the flow. For your own work on production codebases, use Auto mode instead.

---

## Exercise 3.1 — See Permissions Fire in Real Time

**Time:** 10 minutes

**Goal:** Understand exactly what permissions protect, and see what happens when you restrict specific tools.

---

**Step 1** — Open Claude Code in default mode.

```bash
claude
```

---

**Step 2** — Ask Claude to create a file.

```
Create a file called permission-test.txt with the text "this is a permission test"
```

**What you should see:**
Claude pauses before writing. It shows you exactly what it wants to do — the file path, the content. You choose Allow or Deny.

This pause is intentional. You are seeing the permission system working. Claude cannot silently write to your filesystem.

---

**Step 3** — Choose **Allow all file writes for this session**. Then ask Claude to create two more files. They should run without pausing.

---

**Step 4** — Exit Claude Code. Restart with a specific tool allowlist:

```bash
claude --allowedTools "Bash(git log:*)" "Bash(git diff:*)" "Read"
```

Ask Claude to:
```
Show me the last 5 commits
```

Then ask:
```
Create a file called test.txt
```

**What you should see:**
The git command runs without asking. The file write is blocked — it is not in the allowlist.

---

**Step 5** — Try blocking dangerous commands:

```bash
claude --disallowedTools "Bash(rm:*)" "Bash(sudo:*)"
```

Ask Claude to delete a file. It will be blocked before anything executes.

---

**Self-check:**
- [ ] You saw the permission dialog before a file was written
- [ ] Allow all for session worked — subsequent writes ran without prompting
- [ ] --allowedTools restricted Claude to only the listed commands
- [ ] --disallowedTools blocked the command you tried

---

## Exercise 3.2 — Auto Mode and Allowlists

**Time:** 5 minutes

**Goal:** Set up Auto mode and allowlist a command you trust completely.

---

**Step 1** — Start Claude Code in Auto mode.

```bash
claude --permission-mode auto
```

---

**Step 2** — Ask Claude to run something routine:

```
Run the linter on the project and show me the results
```

**What you should see:**
The linter runs without any permission prompt. The classifier approved it automatically because running a linter is low-risk routine work.

---

**Step 3** — Inside any Claude Code session, open the permissions panel:

```
/permissions
```

Add your most-used safe command to the permanent allowlist — for example `npm run test` or `mvn verify`.

---

**Step 4** — Ask Claude to run that command. It should fire immediately with no prompt, even in default mode.

---

**Self-check:**
- [ ] Auto mode ran a routine command without prompting
- [ ] You added a command to the permanent allowlist
- [ ] The allowlisted command ran without asking in default mode

---

**Why this matters:**
After the tenth permission approval in a row you are not reviewing anything — you are clicking on autopilot. That is when mistakes happen. Allowlisting commands you trust removes the noise so your attention goes to the things that genuinely need review.

---

# MODULE 4
# Working Effectively — Context, Sessions, and Prompts

## The One Constraint That Governs Everything

Claude Code has one fundamental limit: the context window.

The context window holds your entire conversation — every message, every file Claude read, every command output. It accumulates throughout a session. A single debugging session can consume tens of thousands of tokens.

As the context window fills, Claude's performance degrades. It starts losing track of earlier instructions, making more mistakes, becoming less consistent. The context window is not a background detail — it is the most important resource you manage.

Everything in this module is about managing it.

---

## The Four Habits That Work

**1. Explore first, then plan, then code.**
Never let Claude jump straight to writing code. Use Plan Mode first. In Plan Mode, Claude reads files and thinks — but makes no changes. You get to review the approach before anything is written.

Toggle Plan Mode with `Shift+Tab`. The prompt shows `[Plan Mode]` when active.

**2. Correct early.**
The moment you see Claude going in the wrong direction — press `Escape`. Context is preserved. Redirect immediately. Waiting for Claude to finish a wrong approach wastes tokens and makes it harder to correct.

**3. Clear between tasks.**
When you finish one task and start something completely different — run `/clear`. Starting a new task in a context full of the previous task's file reads and command outputs is like explaining a new problem to someone still thinking about the old one.

**4. Use subagents for exploration.**
When you need Claude to dig into a large codebase to answer a question — use a subagent. It explores in its own context window and reports back a summary. Your main conversation stays clean.

```
Use a subagent to investigate how our authentication system handles
token refresh. Report back with a summary only.
```

---

## Exercise 4.1 — The Explore-Plan-Code Workflow

**Time:** 15 minutes

**Goal:** Complete a real task using the correct sequence — explore, plan, implement.

Pick something you actually want to do in your codebase. It should touch more than one file.

---

**Step 1** — Open Plan Mode.

Press `Shift+Tab`. You should see `[Plan Mode]` appear in your prompt.

---

**Step 2** — Ask Claude to explore the relevant area. Be specific about what to read.

```
Read [the files or folders relevant to your task] and understand
how [the part of the system you are working on] works.
Do not make any changes.
```

**What you should see:**
Claude reads files and explains what it found. No code is written. No files are changed.

---

**Step 3** — Ask for a plan.

```
I want to [describe your task precisely].
What files need to change?
What is the right approach?
List any risks or edge cases.
Write a plan.
```

Read the plan carefully. If anything looks wrong — correct it now. This is the cheapest place to catch a mistake.

---

**Step 4** — If you want to edit the plan directly, press `Ctrl+G`. This opens the plan in your text editor where you can modify it before Claude proceeds.

---

**Step 5** — Switch back to Normal Mode with `Shift+Tab`.

Implement:

```
Implement the plan. After each change, run the tests.
If any tests fail, fix them before moving to the next step.
```

**What you should see:**
Claude implements step by step, running tests as it goes, fixing failures before continuing. You are watching a plan execute — not watching Claude figure out the approach as it writes.

---

**Self-check:**
- [ ] Plan Mode was active during explore and plan steps — no files were changed
- [ ] The plan listed specific files and a clear approach
- [ ] You reviewed and agreed with the plan before implementation started
- [ ] Tests ran during implementation

---

## Exercise 4.2 — Managing Context During a Long Session

**Time:** 10 minutes

**Goal:** Use the context management tools before the session degrades.

---

**Step 1** — Start a session. Ask a few questions, read a few files, run some commands. Do enough that the conversation has some history.

---

**Step 2** — Check what you have spent:

```
/cost
```

**What you should see:**
Token count and approximate cost for this session. This is your budget meter.

---

**Step 3** — Try a targeted compact. This summarises the conversation while keeping specific context:

```
/compact Focus on the task we are working on — ignore the exploration we did earlier
```

**What you should see:**
Claude compresses the conversation history, keeping the parts you specified as important. Your token count drops. The useful context remains.

---

**Step 4** — Ask a quick question without adding it to your conversation history:

```
/btw what does the --verbose flag do in this project?
```

**What you should see:**
The answer appears in an overlay. When you dismiss it, it is gone — it never entered the conversation history. Your context did not grow at all.

---

**Step 5** — Name your session so you can come back to it:

```
/rename [a short descriptive name like: auth-refactor]
```

---

**Step 6** — Try a full reset for a new task:

```
/clear
```

Then start a fresh task. Notice how the response quality feels different with clean context.

---

**Step 7** — Resume a past session:

```bash
claude --continue      # pick up the most recent session
claude --resume        # choose from a list of named sessions
```

---

**Self-check:**
- [ ] /cost showed your token usage
- [ ] /compact reduced the conversation while keeping relevant context
- [ ] /btw answered your question without appearing in the conversation
- [ ] /rename gave your session a name
- [ ] /clear started a genuinely fresh session

---

## Exercise 4.3 — Writing Prompts With Verification Criteria

**Time:** 10 minutes

**Goal:** Give Claude a way to check its own work so you are not the only feedback loop.

The single most effective thing you can do when prompting Claude is give it a way to verify its output. Without verification criteria, Claude produces something that looks right and you have to manually check whether it actually works.

With verification criteria, Claude runs the check itself and tells you the result.

---

**Step 1** — Compare these two prompts. Notice the difference.

**Without verification:**
```
Add email validation to the registration form
```

Claude writes something. It may or may not work. You find out when you test it yourself.

**With verification:**
```
Add email validation to the registration form.

Test cases to verify:
- Empty field → show "Email is required"
- Missing @ symbol → show "Enter a valid email address"
- Valid format like user@example.com → no error shown

Run the tests after implementing. Confirm all three cases pass before finishing.
```

Claude writes the code, runs the tests, sees which ones fail, fixes the code, and runs them again. You get a verified result.

---

**Step 2** — Pick a function in your codebase that currently has no tests.

---

**Step 3** — Write a verification prompt for it:

```
Write tests for [function name] that cover:
- [the happy path — what should work normally]
- [edge case 1 — what should happen at the boundary]
- [edge case 2 — what should happen with bad input]

Run the tests. If any fail, fix the function until all three pass.
Show me which tests passed and which failed before the fix.
```

---

**Step 4** — Watch what happens. Claude writes tests, runs them, reads the failure output, modifies the function, and runs them again. You are watching Claude act as its own QA engineer.

---

**Self-check:**
- [ ] You wrote a prompt with explicit test cases
- [ ] Claude ran the tests as part of the task
- [ ] Claude fixed failures before declaring the task done
- [ ] You did not have to manually run tests to verify the result

---

**The principle behind this:**
Claude performs dramatically better when it can verify its own work. Tests, expected outputs, screenshots, linter results — any objective check. If you can define what correct looks like, Claude can check itself. If you cannot define what correct looks like, you have a specification problem, not a Claude problem.

---

# MODULE 5
# Advanced Patterns

## Skills — Repeatable Workflows

A skill is a file that gives Claude a pre-written workflow. Instead of typing a long prompt every time you do a common task, you write the workflow once in a SKILL.md file and invoke it with a slash command.

Skills live in `.claude/skills/`. Each skill is a folder with a SKILL.md inside.

Example — a skill that fixes GitHub issues end to end:

```
.claude/skills/fix-issue/SKILL.md
```

```markdown
---
name: fix-issue
description: Fix a GitHub issue end to end
---
Fix the GitHub issue: $ARGUMENTS

1. Use gh issue view $ARGUMENTS to read the issue
2. Search the codebase for relevant files
3. Implement the fix
4. Write a test that proves the fix works
5. Run the full test suite
6. Commit with a descriptive message
7. Create a PR
```

Invoke it with:
```
/fix-issue 1234
```

Claude reads the skill, follows the steps, and runs the full workflow — without you having to describe any of it.

Skills are worth creating for anything your team does more than once a week. Code reviews, deployment steps, PR descriptions, bug triage, onboarding patterns.

---

## Checkpoints and Rewind

Every action Claude takes creates a checkpoint automatically. You can restore your conversation and your code to any previous checkpoint.

Open the rewind menu with `Escape + Escape` or `/rewind`.

From the rewind menu you can:
- Restore conversation and code both — full undo
- Restore code only — keep the conversation, roll back the files
- Restore conversation only — keep the file changes, go back in the chat
- Summarise from a checkpoint — compact everything after a selected point

Checkpoints persist across sessions. You can close your terminal and still rewind a checkpoint from yesterday.

**The practical use:** tell Claude to try something risky. If it does not work, rewind instantly and try a different approach. There is no penalty for attempting the aggressive solution first.

---

## Exercise 5.1 — Build a Team Skill

**Time:** 15 minutes

**Goal:** Create a skill for a workflow your team runs repeatedly, and confirm Claude follows it.

---

**Step 1** — Decide what workflow to codify. Good candidates:
- Code review with your team's specific checklist
- Bug triage from a Jira ticket
- Generating a PR description in your team's format
- Running a deployment checklist
- Onboarding to an unfamiliar module

---

**Step 2** — Create the skill folder and file.

```bash
mkdir -p .claude/skills/your-workflow-name
touch .claude/skills/your-workflow-name/SKILL.md
```

---

**Step 3** — Write the skill. Use this structure:

```markdown
---
name: your-workflow-name
description: One sentence — when should Claude use this?
---
# [Workflow Name]

When to use: [describe the situation this is for]

Steps:
1. [First thing to do — be specific]
2. [Second thing]
3. [Third thing]
4. [Continue as needed]

Rules:
- [One thing that must always happen]
- [One thing that must never happen]

Output:
[Describe what the final output should look like]
```

---

**Step 4** — Test it.

```
/your-workflow-name [relevant input]
```

---

**Step 5** — Watch what Claude does. Does it follow all the steps? Does the output match what you specified? If not, edit the SKILL.md and run it again.

Treat a SKILL.md like code. It needs to be tested, iterated, and refined until it behaves exactly as intended.

---

**Self-check:**
- [ ] Skill file is in .claude/skills/[name]/SKILL.md
- [ ] The description line is one clear sentence
- [ ] Steps are specific enough that Claude cannot interpret them differently
- [ ] You ran it once and reviewed the output
- [ ] You made at least one refinement based on what you observed

---

## Exercise 5.2 — Rewind in Practice

**Time:** 10 minutes

**Goal:** Use checkpoints to safely attempt a risky change, then recover cleanly.

---

**Step 1** — Ask Claude to make a change that is significant and not fully reversible with a simple undo:

```
Refactor [a module or file in your project] to follow [a new pattern or approach].
```

---

**Step 2** — Let it run for a minute or two. Watch the changes accumulate.

---

**Step 3** — Press `Escape + Escape` to open the rewind menu.

---

**Step 4** — Choose to restore both conversation and code to the checkpoint before the refactor started.

**What you should see:**
Your files go back to their previous state. The refactor never happened. Claude confirms the restore.

---

**Step 5** — Now give Claude more specific instructions before letting it try again:

```
Refactor [module] to follow [pattern].
Only change [specific part] in this first pass.
Do not touch [parts that should not change].
After each file, run the tests before moving to the next one.
```

**What you should see:**
The second attempt is more controlled, more incremental, and easier to review.

---

**Self-check:**
- [ ] You triggered the rewind menu with Escape + Escape
- [ ] The restore brought your files back to the pre-refactor state
- [ ] Your second attempt used more specific constraints
- [ ] Tests ran between steps in the second attempt

---

## Exercise 5.3 — The Interview Pattern

**Time:** 15 minutes

**Goal:** Use Claude to spec out a feature before writing a single line of code.

The interview pattern is for larger features where you are not fully sure of the scope. Instead of writing a long prompt trying to describe everything, you let Claude ask you questions. Claude interviews you, surfaces edge cases you had not considered, and writes a complete spec at the end.

---

**Step 1** — Pick a feature you actually want to build. Write one sentence describing it.

---

**Step 2** — Open Claude Code and type this prompt, filling in your feature description:

```
I want to build: [your one sentence description]

Interview me using the AskUserQuestion tool.
Ask about: technical implementation, edge cases, user experience decisions,
data requirements, security concerns, and performance tradeoffs.
Do not ask obvious questions. Focus on the hard parts I might not have considered.
Keep asking until you have enough to write a complete spec.
Then write the spec to SPEC.md.
```

---

**Step 3** — Answer every question Claude asks. If you do not know the answer to something — say so. Claude will flag it as a gap in the spec.

---

**Step 4** — Read the SPEC.md that Claude writes. Look for:
- Anything Claude assumed that you would have answered differently
- Gaps flagged where you said you did not know
- Edge cases you had not thought about

Edit the spec directly until it is accurate.

---

**Step 5** — Start a fresh session to implement it.

```
/clear
```

Then:

```
Read SPEC.md fully before writing any code.
Implement the spec. After each section, confirm it matches the spec before continuing.
```

---

**Self-check:**
- [ ] Claude asked at least 5 questions you had not already answered in your prompt
- [ ] Claude flagged at least one gap or edge case you had not considered
- [ ] SPEC.md exists and describes the feature completely
- [ ] You started a fresh session for implementation — not the same one as the interview

---

**Why a fresh session matters:**
The interview session is full of exploration — half-formed ideas, questions, revisions. Starting fresh with only the spec gives Claude clean context focused entirely on implementation. It also gives you a written contract to check against.

---

## Exercise 5.4 — Automation and CI Integration

**Time:** 10 minutes

**Goal:** Use Claude Code non-interactively in scripts and pipelines.

Everything you can do in the interactive REPL, you can do with the `-p` flag. No UI. Output goes to stdout. This is how you integrate Claude Code into automated workflows.

---

**Step 1** — Generate a structured report and save it:

```bash
claude -p "Analyse this codebase for potential security issues. Be specific about file names and line numbers." --output-format json > security-report.json
cat security-report.json
```

---

**Step 2** — Fan out across multiple files:

```bash
for file in src/*.js; do
  echo "--- $file ---"
  claude -p "Does $file have any obvious bugs? Answer YES or NO with one sentence explanation." \
    --allowedTools "Read" \
    --max-turns 1
done
```

---

**Step 3** — Generate a changelog from your recent commits:

```bash
git log --oneline v1.0..HEAD | claude -p "Generate a user-facing changelog from these commits. Group by: new features, bug fixes, improvements."
```

---

**Step 4** — Run two independent Claude tasks in parallel:

```bash
claude -p "Write unit tests for the authentication module" > tests-auth.md &
claude -p "Write unit tests for the payments module" > tests-payments.md &
wait
echo "Both complete"
```

---

**Step 5** — Add Claude to a pre-commit hook:

```bash
echo '#!/bin/bash
git diff --cached | claude -p "Review these staged changes. Flag any obvious bugs, security issues, or missing tests. Keep it brief." --max-turns 1' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Make a small staged change and run `git commit` to see it trigger.

---

**Self-check:**
- [ ] --output-format json produced parseable JSON output
- [ ] The file loop ran Claude once per file
- [ ] Parallel execution ran both tasks simultaneously
- [ ] The pre-commit hook triggered on git commit

---

# REFERENCE

## Every Command You Will Use

### Starting Claude Code

| Command | What it does |
|---|---|
| `claude` | Open interactive session |
| `claude "your prompt"` | Open session with an initial message |
| `claude -p "prompt"` | One-shot: answer and exit |
| `claude --continue` or `-c` | Resume most recent session |
| `claude --resume` | Choose from recent sessions |
| `claude --resume abc123` | Resume a specific session by ID |
| `claude --version` | Check your installed version |
| `claude update` | Update to the latest version |

### CLI Flags

| Flag | What it does | Example |
|---|---|---|
| `--model` | Choose a specific model | `--model claude-sonnet-4-5` |
| `--add-dir` | Add extra working directories | `--add-dir ../shared ../lib` |
| `--allowedTools` | Auto-approve specific tools | `--allowedTools "Bash(git:*)" "Read"` |
| `--disallowedTools` | Block specific tools | `--disallowedTools "Bash(rm:*)"` |
| `--output-format` | Set output format | `--output-format json` |
| `--max-turns` | Limit conversation turns | `--max-turns 3` |
| `--verbose` | Show detailed logging | `--verbose` |
| `--permission-mode auto` | Auto-approve with classifier | (no interruptions) |
| `--dangerously-skip-permissions` | Skip all permission prompts | **Sandboxes only — never your machine** |

### Slash Commands — Session Control

| Command | What it does |
|---|---|
| `/clear` | Reset context — fresh start |
| `/compact` | Summarise conversation, free context |
| `/compact Focus on X` | Compact keeping specific context |
| `/btw your question` | Side question that never enters context |
| `/cost` | Show token usage and cost so far |
| `/rename name` | Name this session |
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
| `/doctor` | Check Claude Code health |
| `/help` | List all available commands |

### Keyboard Shortcuts

| Key | What it does |
|---|---|
| `Shift+Tab` | Toggle Plan Mode on/off |
| `Escape` | Stop Claude mid-response — context preserved |
| `Escape + Escape` | Open rewind / checkpoint menu |
| `Ctrl+G` | Open current plan in your text editor |
| `Ctrl+C` | Cancel current operation |
| `Ctrl+D` | Exit Claude Code |
| `↑ / ↓` | Navigate your command history |
| `Tab` | Autocomplete |

### @ References

```bash
@filename.js          # Read this file before responding
@src/folder/          # Reference a whole folder
@README.md            # Read a specific file by path
```

Use in prompts:
```
@src/auth.js what does this file do?
```

Use in CLAUDE.md to import other files:
```markdown
See @docs/conventions.md for our coding standards.
```

---

## Piping and Automation

### Pipe data into Claude

```bash
cat error.log | claude -p "Find the root cause"
git log --oneline -20 | claude -p "Summarise what changed"
git diff HEAD~1 | claude -p "Review this for security issues"
docker logs app_container | claude -p "Find errors in these logs"
```

### Output formats

```bash
--output-format text         # Plain text (default)
--output-format json         # Structured JSON for scripting
--output-format stream-json  # Streaming JSON for real-time processing
```

### Parallel and batch

```bash
# Process multiple files
for file in src/*.js; do
  claude -p "Check $file for bugs" --allowedTools "Read" --max-turns 1
done

# Run two sessions in parallel
claude -p "Write tests for module A" > tests-a.md &
claude -p "Write tests for module B" > tests-b.md &
wait
```

---

## Context Management — Quick Rules

| Situation | What to do |
|---|---|
| Starting a different task | `/clear` |
| Session getting long and slow | `/compact Focus on X` |
| Quick question, do not want in history | `/btw your question` |
| Exploring a large codebase | Use a subagent |
| Claude forgetting earlier instructions | `/clear` and rewrite prompt |
| Same mistake repeated twice | `/clear` and add the constraint explicitly |

---

## Common Failure Patterns — and How to Fix Them

**The kitchen sink session**
You start one task, get sidetracked, ask something unrelated, go back to the first task. Context is full of mixed information.
Fix: `/clear` between unrelated tasks. Always.

**The correction loop**
Claude does something wrong. You correct it. It is still wrong. You correct again. Context is now full of failed approaches and Claude is confused.
Fix: After two failed corrections, `/clear` and write a better initial prompt using what you learned.

**The bloated CLAUDE.md**
Claude keeps ignoring a rule that is in the file.
Fix: The file is too long. Cut everything that passes the "would removing this cause a mistake?" test. Important rules need to be findable.

**The vague task**
"Fix the login bug" — Claude guesses what you mean and guesses wrong.
Fix: Name the file, describe the symptom, say what correct looks like. "Users report login fails after session timeout. Check src/auth/token-refresh.ts. Write a failing test that reproduces it, then fix it."

**The unverified output**
Claude produces something plausible but incorrect. You ship it.
Fix: Always give Claude a way to verify — tests, expected output, a command to run. If Claude cannot check its own work, you become the check.

---

## Troubleshooting

**Claude Code is not installed or not found**
```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

**Something seems broken**
```bash
claude /doctor
```

**Claude is ignoring CLAUDE.md rules**
The file is too long. Prune it. Keep only rules that would cause mistakes if removed. Aim for under 50 lines. Add `IMPORTANT:` before rules Claude keeps missing.

**Session is slow or making mistakes**
Context is full.
```
/compact Focus on [current task]
```
Or start fresh:
```
/clear
```

**Permission prompts blocking every action**
Either use `/permissions` to allowlist trusted commands, or switch to Auto mode:
```bash
claude --permission-mode auto
```

**Node or npm issues on Windows**
Make sure you are running inside WSL:
```bash
wsl
claude --version
```

---

## The Mental Model

```
You provide:              Claude provides:
─────────────────────     ─────────────────────
The goal                  The steps to get there
The constraints           The tool choices
The verification          The implementation
The context               The reasoning

You are the director.
Claude is the engineer.
CLAUDE.md is the team handbook.
The context window is your budget.
```

---

## Key Principles From Anthropic's Documentation

**Give Claude a way to verify its work.**
The single highest-leverage change you can make. Tests, expected outputs, commands to run. Without verification criteria, you are the only quality check. With them, Claude is.

**Explore first, then plan, then code.**
Plan Mode exists because jumping straight to implementation solves the wrong problem more often than you think. Any task touching more than two files deserves a plan first.

**Correct early — not late.**
The moment something looks wrong, press Escape. One correction early costs almost nothing. Five corrections late pollutes context and the output is still wrong.

**Manage context like a budget.**
You cannot spend what you do not have. Clear between tasks. Compact long sessions. Use subagents for exploration. Track with /cost.

**Keep CLAUDE.md short enough to actually work.**
A CLAUDE.md that is too long is ignored. Ruthlessly prune. If a rule is there and Claude still breaks it — cut five other lines. Find out which ones were drowning it.

**Verify before you ship.**
A plausible-looking result that fails an edge case is worse than no result. You cannot catch what you do not test for.
