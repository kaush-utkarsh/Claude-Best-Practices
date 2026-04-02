#!/usr/bin/env bash
# =============================================================
# smart-prompt.sh
# Estimate tokens → pick model → run Claude automatically
# 
# Usage:
#   ./smart-prompt.sh "your prompt here"
#   ./smart-prompt.sh "your prompt here" --task=legal
#   ./smart-prompt.sh "your prompt here" --task=formatting
#
# Task types: legal, security, architecture, debugging,
#             summary, formatting, extraction, translation
#
# How it works:
#   1. Sends prompt to Anthropic token-count endpoint (Haiku)
#   2. Detects task type from keywords (or --task flag)
#   3. Selects Haiku / Sonnet / Opus based on task + token rules
#   4. Runs the actual prompt on the chosen model
#   5. Shows token cost comparison so you see what you saved
# =============================================================

set -euo pipefail

# ── GUARD: require API key ──────────────────────────────────
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "❌  ANTHROPIC_API_KEY not set"
  exit 1
fi

# ── ARGS ────────────────────────────────────────────────────
PROMPT="${1:-}"
TASK_OVERRIDE=""

if [[ -z "$PROMPT" ]]; then
  echo "Usage: $0 \"your prompt\" [--task=legal|security|architecture|debugging|summary|formatting|extraction|translation]"
  exit 1
fi

for arg in "${@:2}"; do
  if [[ "$arg" == --task=* ]]; then
    TASK_OVERRIDE="${arg#--task=}"
  fi
done

# ── MODEL CONSTANTS ─────────────────────────────────────────
HAIKU="claude-haiku-4-5"
SONNET="claude-sonnet-4-5"
OPUS="claude-opus-4-5"

# ── STEP 1: COUNT TOKENS ────────────────────────────────────
# Always count on Haiku — cheapest counting model.
# The count endpoint does not run the prompt, it just measures it.
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SMART PROMPT — Token-aware model routing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Prompt: \"${PROMPT:0:80}...\""
echo ""
echo "  [1] Counting tokens on Haiku (cheapest counter)..."

COUNT_RESPONSE=$(curl -s https://api.anthropic.com/v1/messages/count_tokens \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: token-counting-2024-11-01" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$HAIKU\",
    \"system\": \"You are a helpful assistant.\",
    \"messages\": [{\"role\": \"user\", \"content\": $(echo "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}]
  }")

TOKEN_COUNT=$(echo "$COUNT_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('input_tokens', 0))")

echo "      Input tokens: $TOKEN_COUNT"

# ── STEP 2: DETECT TASK TYPE ────────────────────────────────
echo ""
echo "  [2] Detecting task type..."

if [[ -n "$TASK_OVERRIDE" ]]; then
  TASK="$TASK_OVERRIDE"
  echo "      Task type: $TASK (from --task flag)"
else
  PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')
  if echo "$PROMPT_LOWER" | grep -qE "legal|liability|compliance|contract|pci|gdpr|clause"; then
    TASK="legal"
  elif echo "$PROMPT_LOWER" | grep -qE "security|vulnerability|exploit|injection|acl|permission|auth"; then
    TASK="security"
  elif echo "$PROMPT_LOWER" | grep -qE "architect|design|structure|pattern|system|scalab"; then
    TASK="architecture"
  elif echo "$PROMPT_LOWER" | grep -qE "bug|error|exception|debug|fix|crash|null|npe|stack|trace"; then
    TASK="debugging"
  elif echo "$PROMPT_LOWER" | grep -qE "summar|summarise|summarize|overview|tldr|brief"; then
    TASK="summary"
  elif echo "$PROMPT_LOWER" | grep -qE "format|reformat|convert|clean|restructure|json|csv"; then
    TASK="formatting"
  elif echo "$PROMPT_LOWER" | grep -qE "extract|parse|pull out|find all|get the"; then
    TASK="extraction"
  else
    TASK="general"
  fi
  echo "      Task type: $TASK (auto-detected from keywords)"
fi

# ── STEP 3: SELECT MODEL ────────────────────────────────────
echo ""
echo "  [3] Selecting model..."

# Rules:
# - legal / security / architecture → always Opus (consequences of being wrong are high)
# - Large prompts (>3000 tokens) + complex task → Opus
# - Medium tasks → Sonnet
# - formatting / extraction / translation → Haiku (mechanical tasks)
# - Very large prompts (>8000 tokens) on simple task → Sonnet (Haiku may truncate)

case "$TASK" in
  legal|security|architecture)
    MODEL="$OPUS"
    REASON="High-stakes task — needs best reasoning regardless of token count"
    ;;
  formatting|extraction|translation)
    if [[ "$TOKEN_COUNT" -gt 8000 ]]; then
      MODEL="$SONNET"
      REASON="Mechanical task but very large prompt — Sonnet handles volume better"
    else
      MODEL="$HAIKU"
      REASON="Mechanical task — Haiku handles this perfectly"
    fi
    ;;
  debugging|summary|analysis)
    if [[ "$TOKEN_COUNT" -gt 3000 ]]; then
      MODEL="$OPUS"
      REASON="Complex task + large context — needs full reasoning capability"
    else
      MODEL="$SONNET"
      REASON="Medium complexity — balanced speed and accuracy"
    fi
    ;;
  *)
    if [[ "$TOKEN_COUNT" -gt 5000 ]]; then
      MODEL="$SONNET"
      REASON="Unknown task type, large prompt — defaulting to Sonnet"
    else
      MODEL="$SONNET"
      REASON="Unknown task type — defaulting to Sonnet"
    fi
    ;;
esac

# Derive short label from model string
MODEL_LABEL=$(echo "$MODEL" | sed 's/claude-//' | sed 's/-[0-9].*//')

echo "      Selected model: $MODEL_LABEL ($MODEL)"
echo "      Reason: $REASON"

# ── STEP 4: ESTIMATE COSTS ───────────────────────────────────
# Approximate pricing per million input tokens (as of 2025):
# Haiku:  $0.80  → $0.0000008  per token
# Sonnet: $3.00  → $0.000003   per token
# Opus:   $15.00 → $0.000015   per token

echo ""
echo "  [4] Cost estimate for $TOKEN_COUNT input tokens:"

HAIKU_COST=$(python3 -c "print(f'\${${TOKEN_COUNT} * 0.0000008:.6f}')")
SONNET_COST=$(python3 -c "print(f'\${${TOKEN_COUNT} * 0.000003:.6f}')")
OPUS_COST=$(python3 -c "print(f'\${${TOKEN_COUNT} * 0.000015:.6f}')")

echo "      Haiku  (fast/cheap):  $HAIKU_COST"
echo "      Sonnet (balanced):    $SONNET_COST"
echo "      Opus   (powerful):    $OPUS_COST"

SELECTED_COST=$(python3 -c "
costs = {'$HAIKU': ${TOKEN_COUNT} * 0.0000008, '$SONNET': ${TOKEN_COUNT} * 0.000003, '$OPUS': ${TOKEN_COUNT} * 0.000015}
print(f'\${costs[\"$MODEL\"]:.6f}')
")
OPUS_COST_RAW=$(python3 -c "print(f'{${TOKEN_COUNT} * 0.000015:.6f}')")

echo ""
echo "      ► Running on: $MODEL_LABEL at $SELECTED_COST"

if [[ "$MODEL" != "$OPUS" ]]; then
  SAVINGS=$(python3 -c "
m = '$MODEL'
t = $TOKEN_COUNT
costs = {'$HAIKU': t * 0.0000008, '$SONNET': t * 0.000003, '$OPUS': t * 0.000015}
ratio = costs['$OPUS'] / costs[m]
print(f'{ratio:.1f}x cheaper than Opus')
")
  echo "      ► Savings:   $SAVINGS by routing correctly"
fi

# ── STEP 5: RUN THE PROMPT ──────────────────────────────────
echo ""
echo "  [5] Running prompt on $MODEL_LABEL..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"max_tokens\": 1024,
    \"system\": \"You are a helpful assistant.\",
    \"messages\": [{\"role\": \"user\", \"content\": $(echo "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}]
  }")

OUTPUT_TEXT=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['content'][0]['text'])" 2>/dev/null || echo "Error parsing response")
OUTPUT_TOKENS=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['usage']['output_tokens'])" 2>/dev/null || echo "?")

echo "$OUTPUT_TEXT"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SUMMARY"
echo "  Input tokens:  $TOKEN_COUNT  |  Output tokens: $OUTPUT_TOKENS"
echo "  Model used:    $MODEL_LABEL  |  Estimated cost: $SELECTED_COST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
