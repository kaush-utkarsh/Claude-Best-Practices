// =============================================================
// shared/api-client.js
// Anthropic API fetch wrapper — no SDK, plain JS
// Used by all demos. Do not modify during session.
// =============================================================

import "dotenv/config";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1";
const API_KEY           = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_VERSION = "2023-06-01";

// -----------------------------------------------------------
// MODEL CONSTANTS
// Reference these everywhere — never hardcode model strings
// -----------------------------------------------------------
export const MODELS = {
  HAIKU:  "claude-haiku-4-5",           // Fast, cheap — token counting, journey tracing
  SONNET: "claude-sonnet-4-5",          // Balanced — most demos
  OPUS:   "claude-opus-4-5",            // Powerful, expensive — show cost delta in Demo 1
};

function getHeaders(extras = {}) {
  return {
    "Content-Type":      "application/json",
    "x-api-key":         API_KEY,
    "anthropic-version": ANTHROPIC_VERSION,
    ...extras,
  };
}

// -----------------------------------------------------------
// callClaude(params)
// Standard non-streaming message call.
// Pass system as a structured array with cache_control to
// enable prompt caching — header included automatically.
//
// params = {
//   model:      string          (use MODELS.HAIKU etc)
//   system:     string | array  (array = with cache_control for caching)
//   messages:   array
//   tools:      array           (optional)
//   max_tokens: number          (default 1024)
// }
// -----------------------------------------------------------
export async function callClaude(params) {
  const {
    model = MODELS.SONNET,
    system,
    messages,
    tools,
    max_tokens = 1024,
  } = params;

  const systemBlock = typeof system === "string"
    ? [{ type: "text", text: system }]
    : system;

  const body = {
    model,
    max_tokens,
    messages,
    ...(systemBlock && { system: systemBlock }),
    ...(tools       && { tools }),
  };

  const response = await fetch(`${ANTHROPIC_API_URL}/messages`, {
    method:  "POST",
    headers: getHeaders({ "anthropic-beta": "prompt-caching-2024-07-31" }),
    body:    JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Anthropic API error ${response.status}: ${error?.error?.message || response.statusText}`
    );
  }

  return response.json();
}

// -----------------------------------------------------------
// countTokens(params)
// ALWAYS runs on Haiku — never burn Opus to count.
//
// params = {
//   system:   string | array
//   messages: array
//   tools:    array (optional)
// }
//
// Returns: { input_tokens: number }
// -----------------------------------------------------------
export async function countTokens(params) {
  const { system, messages, tools } = params;

  const systemBlock = typeof system === "string"
    ? [{ type: "text", text: system }]
    : system;

  const body = {
    model: MODELS.HAIKU,   // ← ALWAYS Haiku. Counting on Opus = waste.
    messages,
    ...(systemBlock && { system: systemBlock }),
    ...(tools       && { tools }),
  };

  const response = await fetch(`${ANTHROPIC_API_URL}/messages/count_tokens`, {
    method:  "POST",
    headers: getHeaders({ "anthropic-beta": "token-counting-2024-11-01" }),
    body:    JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Token count error ${response.status}: ${error?.error?.message || response.statusText}`
    );
  }

  return response.json();
}

// -----------------------------------------------------------
// streamClaude(params, onChunk)
// Streaming call — used by UI demos.
//
// params    = same shape as callClaude
// onChunk   = callback fired for each text delta: (text) => void
//
// Returns full assembled text when stream ends
// -----------------------------------------------------------
export async function streamClaude(params, onChunk) {
  const {
    model = MODELS.SONNET,
    system,
    messages,
    max_tokens = 1024,
  } = params;

  const systemBlock = typeof system === "string"
    ? [{ type: "text", text: system }]
    : system;

  const body = {
    model,
    max_tokens,
    stream: true,
    messages,
    ...(systemBlock && { system: systemBlock }),
  };

  const response = await fetch(`${ANTHROPIC_API_URL}/messages`, {
    method:  "POST",
    headers: getHeaders(),
    body:    JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Stream error ${response.status}: ${error?.error?.message || response.statusText}`
    );
  }

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let   fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value, { stream: true }).split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const event = JSON.parse(data);
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          fullText += event.delta.text;
          onChunk(event.delta.text);
        }
      } catch { /* skip malformed lines */ }
    }
  }

  return fullText;
}

// -----------------------------------------------------------
// Self-test — run with: node shared/api-client.js
// -----------------------------------------------------------
async function selfTest() {
  console.log("🔍 Testing API connection...\n");

  // 1. Token count
  const countResult = await countTokens({
    system:   "You are a helpful assistant.",
    messages: [{ role: "user", content: "Hello" }],
  });
  console.log("✅ Token count:", countResult.input_tokens, "tokens\n");

  // 2. Basic call
  const response = await callClaude({
    model:      MODELS.HAIKU,
    system:     "You are a helpful assistant. Reply in one sentence.",
    messages:   [{ role: "user", content: "What is 2 + 2?" }],
    max_tokens: 50,
  });
  console.log("✅ Response:", response.content[0].text);
  console.log("   Model used:", response.model);
  console.log("   Tokens in/out:", response.usage.input_tokens, "/", response.usage.output_tokens);
  console.log("\n✅ API connection working. Ready for session.\n");
}

const isMain = process.argv[1]?.endsWith("api-client.js");
if (isMain) selfTest().catch(console.error);