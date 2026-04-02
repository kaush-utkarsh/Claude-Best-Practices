# Claude Code — CLI Cheat Sheet
### Commands + what to actually say to use them

---

## Starting Up

| Command | What it does | Say this |
|---|---|---|
| `claude` | Opens Claude Code in current directory 
| `claude "your question"` | One-shot answer, no interactive session 
| `claude --help` | Shows all available flags 

---

## Inside a Session — Slash Commands

| Command | What it does | Say this |
|---|---|---|
| `/help` | Lists all slash commands 
| `/clear` | Clears conversation — fresh context 
| `/compact` | Summarises long conversation to save context 
| `/cost` | Shows token usage and cost for this session 
| `/exit` or `Ctrl+C` | Closes Claude Code 

---

## Working With Files

| Command | What it does | Say this |
|---|---|---|
| `/add demos/backend/demo1a-token.js` | Adds a specific file to context 
| `/add demos/backend/shared/` | Adds an entire folder 
| `Escape` | Stops Claude mid-response 

---

## The Commands You'll Actually Use Daily

These aren't slash commands — just plain English typed into Claude Code:

```
"Explain what this file does"
"Why does this function throw an error?"
"Add a null check before line 142"
"Write a unit test for this method"
"What's the difference between these two approaches?"
"Refactor this to be more readable"
"What would break if I changed this?"
"Find all places where we call the Anthropic API"
"Add error handling to this function"
"Make this match the style of the other files in this project"
```

---

## CLAUDE.md — The Most Important File

```bash
# Claude Code reads this automatically when it opens your project
# It's your standing instructions — write it once, Claude Code follows it forever

# Create it:
touch CLAUDE.md

# Claude Code will ask to read it on first open
# Or you can just reference it:
"Follow the rules in CLAUDE.md"
```

**What to put in CLAUDE.md:**
- What the project does
- Folder structure
- Language rules (never TypeScript, always use MODELS.HAIKU not hardcoded strings)
- What Claude Code should never touch
- Architecture principles
- Run commands

---

## Keyboard Shortcuts

| Shortcut | What it does |
|---|---|
| `Escape` | Interrupt Claude mid-generation |
| `Ctrl+C` | Exit Claude Code |
| `↑` arrow | Recall previous message |
| `Ctrl+L` | Clear screen (keeps context) |

---

## How to Ask For Things — Plain English Patterns

**Explain:**
```
"Explain how the tool loop works in demo3-agent.js"
"Why does this fail when MAX_STEPS is 1?"
"What's the difference between callClaude and countTokens?"
```

**Write:**
```
"Write a function that..."
"Add error handling to..."
"Create a test for..."
"Build a new demo that shows..."
```

**Fix:**
```
"This is throwing a NullPointerException — fix it"
"The output is duplicating. Find why and fix it"
"The cache isn't activating. What's wrong?"
```

**Review:**
```
"Review this function for security issues"
"Is this the right way to implement ACL?"
"What edge cases am I missing?"
```

**Refactor:**
```
"Make this more readable"
"Split this into two functions"
"This is too long — simplify it"
```

---

## Common Mistakes

| What you do | What to do instead |
|---|---|
| Paste the whole file and ask a vague question | Point to the specific function and ask a specific question |
| "Fix my code" | "This function throws X when Y — fix it" |
| Ask Claude Code to do 5 things at once | One task at a time, review between each |
| Accept every change without reading | Always read the diff before accepting |
| Never update CLAUDE.md | Update it whenever you establish a new project rule |

---

## The One Rule

> *Claude Code is only as good as your instructions.*
>
> *Vague prompt → vague code.*
> *Specific prompt → specific, useful code.*
>
> *The skill is knowing what to ask for. Not typing faster.*
