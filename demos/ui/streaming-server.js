// =============================================================
// demos/ui/streaming-server.js
// Tiny Express proxy server for UI demos
// ─────────────────────────────────────────────────────────────
// Why this exists:
//   Browsers block direct calls to api.anthropic.com (CORS).
//   This server sits in the middle:
//   Browser → localhost:3000 → Anthropic API
//
// Serves:
//   GET  /           → streaming.html
//   GET  /generation → ai-generation.html
//   POST /stream     → proxies to Anthropic with streaming
//   POST /generate   → proxies to Anthropic without streaming
//
// Run: node demos/ui/streaming-server.js
// Then open: http://localhost:3000
// =============================================================

import express    from "express";
import fetch      from "node-fetch";
import path       from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();
const PORT      = 3000;

app.use(express.json());


// -----------------------------------------------------------
// SERVE HTML FILES
// -----------------------------------------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "streaming.html"));
});

app.get("/generation", (req, res) => {
  res.sendFile(path.join(__dirname, "ai-generation.html"));
});


// -----------------------------------------------------------
// STREAMING PROXY
// Browser sends prompt → server streams Claude response back
// Uses Server-Sent Events (SSE) so browser reads token by token
// -----------------------------------------------------------
app.post("/stream", async (req, res) => {
  const { prompt, system } = req.body;

  // SSE headers — keep connection open, push tokens as they arrive
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5",
        max_tokens: 500,
        stream:     true,
        system:     system || "You are a helpful assistant.",
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    // Pipe SSE stream from Anthropic → browser
    const decoder = new TextDecoder();

    for await (const chunk of response.body) {
      const text  = decoder.decode(chunk, { stream: true });
      const lines = text.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            // Send each token to the browser
            res.write(`data: ${JSON.stringify({ token: event.delta.text })}\n\n`);
          }
          if (event.type === "message_stop") {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    res.end();

  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});


// -----------------------------------------------------------
// STANDARD (NON-STREAMING) PROXY
// Used by ai-generation.html
// -----------------------------------------------------------
app.post("/generate", async (req, res) => {
  const { prompt, system } = req.body;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-5",
        max_tokens: 1000,
        system:     system || "You are a helpful assistant.",
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    res.json({ text: data.content[0].text });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// -----------------------------------------------------------
// START
// -----------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  UI DEMO SERVER RUNNING`);
  console.log(`${"═".repeat(50)}`);
  console.log(`\n  Streaming demo:   http://localhost:${PORT}/`);
  console.log(`  Generation demo:  http://localhost:${PORT}/generation`);
  console.log(`\n  Press Ctrl+C to stop.\n`);
});
