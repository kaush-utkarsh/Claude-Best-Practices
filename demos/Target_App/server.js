// =============================================================
// demos/Target_App/server.js
// Express server for the Sahara Desert survival adventure game
// ─────────────────────────────────────────────────────────────
// Pattern: same as demos/ui/streaming-server.js
//   - Express serves the HTML frontend
//   - REST endpoints handle game logic
//   - Frontend is vanilla HTML + JS (no frameworks)
//
// Serves:
//   GET  /            → game.html (the game UI)
//   GET  /api/start   → returns the first question (Q1)
//   POST /api/answer  → receives player choice, returns result + next question
//
// Run:  node demos/Target_App/server.js
// Open: http://localhost:3001
// =============================================================

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import questions from "./game-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();
const PORT      = 3001;

app.use(express.json());


// -----------------------------------------------------------
// SERVE HTML
// -----------------------------------------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "game.html"));
});


// -----------------------------------------------------------
// GET /api/start
// Returns the first question so the game can begin.
// This mimics file2.py line: jump = 'Q1'
// -----------------------------------------------------------
app.get("/api/start", (req, res) => {
  const firstKey = "Q1";
  const question = questions[firstKey];

  res.json({
    questionKey: firstKey,
    text: question.text,
    options: formatOptions(question.options),
  });
});


// -----------------------------------------------------------
// POST /api/answer
// Receives: { questionKey: "Q1", option: "a" }
// Returns:  { response, gameOver, nextQuestion? }
//
// This mimics the while loop in file2.py:
//   - Validate input (file2.py lines 18-26: "enter valid option")
//   - Print response (file2.py line 20)
//   - Jump to next question or end game (file2.py line 22)
// -----------------------------------------------------------
app.post("/api/answer", (req, res) => {
  const { questionKey, option } = req.body;

  // Validate — question must exist
  if (!questions[questionKey]) {
    return res.status(400).json({ error: "Invalid question key" });
  }

  const question = questions[questionKey];
  const chosen   = question.options[option];

  // Validate — option must be a, b, or c (same as file2.py "enter valid option")
  if (!chosen) {
    return res.status(400).json({ error: "Enter valid option" });
  }

  const nextKey = chosen.jump;

  // jump === "-1" means game over (same as file2.py: while jump != '-1')
  if (nextKey === "-1") {
    // Determine win or loss based on the response text
    const survived = chosen.response.toLowerCase().includes("survived");

    return res.json({
      response: chosen.response,
      gameOver: true,
      survived,
    });
  }

  // Game continues — return the response and the next question
  const nextQuestion = questions[nextKey];

  res.json({
    response: chosen.response,
    gameOver: false,
    nextQuestion: {
      questionKey: nextKey,
      text: nextQuestion.text,
      options: formatOptions(nextQuestion.options),
    },
  });
});


// -----------------------------------------------------------
// HELPER — format options for the frontend
// Strips "jump" so the client never sees internal routing
// -----------------------------------------------------------
function formatOptions(options) {
  const formatted = {};
  for (const [key, value] of Object.entries(options)) {
    formatted[key] = { text: value.text };
  }
  return formatted;
}


// -----------------------------------------------------------
// START
// -----------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  SAHARA SURVIVAL — ADVENTURE GAME SERVER`);
  console.log(`${"=".repeat(50)}`);
  console.log(`\n  Game:  http://localhost:${PORT}/`);
  console.log(`\n  Press Ctrl+C to stop.\n`);
});
