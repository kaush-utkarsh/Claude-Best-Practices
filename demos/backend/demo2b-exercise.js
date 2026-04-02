// =============================================================
// demo2b-exercise.js
// EXERCISE: Pipeline Hardening
// ─────────────────────────────────────────────────────────────
// Time:     10 minutes
// Goal:     Tighten the rate limit. Add a new validation rule.
// Run:      node demos/backend/demo2b-exercise.js
// =============================================================

import { executeTool } from "./shared/mock-executors.js";


// -----------------------------------------------------------
// YOUR TASKS
//
// EXERCISE 1 — Tighten the rate limit:
//   Change PER_MINUTE from 3 → 2
//   Run the file. How many calls get through before blocking?
//
// EXERCISE 2 — Add a service whitelist:
//   In validateToolInput(), find the search_kibana_logs rule.
//   The current allowed services are: order-service, user-service,
//   product-service, cart-service, payment-service.
//   Add a new rule: ONLY allow "order-service" and "user-service".
//   Then try calling search_kibana_logs with service: "product-service".
//   Watch it get blocked.
//
// EXERCISE 3 — Break the validator:
//   Comment out the validateToolInput() call entirely.
//   What can an attacker now pass as a service name?
//   What could they try to access?
// -----------------------------------------------------------


// ── RATE LIMITER ──────────────────────────────────────────────
const rateLimitStore = new Map();

const RATE_LIMITS = {
  PER_MINUTE: 3,    // ← EXERCISE 1: change this to 2
  PER_DAY:    100,
};

function checkRateLimit(userId, skill) {
  const key   = `${userId}:${skill}`;
  const now   = Date.now();
  const entry = rateLimitStore.get(key) || {
    minuteCount: 0, dayCount: 0,
    minuteStart: now, dayStart: now,
  };

  if (now - entry.minuteStart > 60_000) { entry.minuteCount = 0; entry.minuteStart = now; }
  if (now - entry.dayStart > 86_400_000) { entry.dayCount = 0; entry.dayStart = now; }

  entry.minuteCount++;
  entry.dayCount++;
  rateLimitStore.set(key, entry);

  if (entry.minuteCount > RATE_LIMITS.PER_MINUTE) {
    return { allowed: false, reason: `Rate limit: ${RATE_LIMITS.PER_MINUTE} calls/minute for "${skill}"` };
  }
  return { allowed: true, remaining: RATE_LIMITS.PER_MINUTE - entry.minuteCount };
}


// ── INPUT VALIDATOR ───────────────────────────────────────────
function validateToolInput(toolName, toolInput) {
  const rules = {
    get_jira_issue: {
      issue_id: (v) => typeof v === "string" && /^[A-Z]+-\d+$/.test(v),
    },
    search_kibana_logs: {
      // ← EXERCISE 2: tighten this list to only ["order-service", "user-service"]
      service: (v) => ["order-service", "user-service", "product-service",
                       "cart-service", "payment-service"].includes(v),
      level:   (v) => !v || ["ERROR", "WARN", "INFO", "DEBUG"].includes(v),
    },
    create_jira_comment: {
      issue_id: (v) => typeof v === "string" && /^[A-Z]+-\d+$/.test(v),
      comment:  (v) => typeof v === "string" && v.length > 0 && v.length <= 2000,
    },
  };

  const toolRules = rules[toolName];
  if (!toolRules) return { valid: true };

  for (const [field, validator] of Object.entries(toolRules)) {
    if (!validator(toolInput[field])) {
      return { valid: false, reason: `Invalid "${field}": ${JSON.stringify(toolInput[field])}` };
    }
  }
  return { valid: true };
}


// ── SECURE EXECUTOR ───────────────────────────────────────────
async function secureExecute(userId, skill, toolName, toolInput) {
  console.log(`\n  → ${userId} [${skill}] calling "${toolName}"`);

  // Rate limit check
  const rateCheck = checkRateLimit(userId, skill);
  if (!rateCheck.allowed) {
    console.log(`  ❌ RATE LIMITED: ${rateCheck.reason}`);
    return null;
  }
  console.log(`  ✅ Rate limit OK (${rateCheck.remaining} remaining this minute)`);

  // Input validation — EXERCISE 3: comment out these 5 lines to break it
  const validation = validateToolInput(toolName, toolInput);
  if (!validation.valid) {
    console.log(`  ❌ VALIDATION FAILED: ${validation.reason}`);
    return null;
  }
  console.log(`  ✅ Input valid`);

  const result = await executeTool(toolName, toolInput);
  console.log(`  ✅ Executed successfully`);
  return result;
}


// ── EXERCISE RUNNER ───────────────────────────────────────────
async function runExercise() {
  console.log("\n" + "═".repeat(60));
  console.log("  EXERCISE — Demo 2b: Pipeline Hardening");
  console.log("═".repeat(60));


  // ── PART 1: Rate limiting ─────────────────────────────────
  console.log("\n\n📋 PART 1 — Rate limiting");
  console.log(`  Current limit: ${RATE_LIMITS.PER_MINUTE} calls/minute`);
  console.log(`  Simulating 5 rapid calls from USR-442...\n`);

  for (let i = 1; i <= 5; i++) {
    await secureExecute("USR-442", "bug-triage", "get_jira_issue", { issue_id: "APP-123" });
  }


  // ── PART 2: Input validation ──────────────────────────────
  console.log("\n\n📋 PART 2 — Input validation");
  console.log("  Testing valid and invalid inputs...\n");

  // Valid call
  console.log("  Test 1: Valid service name");
  await secureExecute("USR-101", "bug-triage", "search_kibana_logs", {
    service: "order-service",
    level:   "ERROR",
  });

  // Invalid service name
  console.log("\n  Test 2: Invalid service name (try 'product-service' after tightening)");
  await secureExecute("USR-101", "bug-triage", "search_kibana_logs", {
    service: "product-service",
    level:   "ERROR",
  });

  // Path traversal attempt
  console.log("\n  Test 3: Injection attempt");
  await secureExecute("USR-101", "bug-triage", "search_kibana_logs", {
    service: "../../../etc/passwd",
    level:   "ERROR",
  });

  // Invalid Jira format
  console.log("\n  Test 4: Malformed Jira ID");
  await secureExecute("USR-101", "bug-triage", "get_jira_issue", {
    issue_id: "drop table issues;",
  });


  // ── REFLECTION ───────────────────────────────────────────
  console.log("\n\n" + "═".repeat(60));
  console.log("  REFLECTION QUESTIONS");
  console.log("═".repeat(60));
  console.log(`
  1. After lowering PER_MINUTE to 2 — how many calls get blocked?
     Is that the right limit for a production bug-triage skill?

  2. After tightening the service whitelist to only order-service
     and user-service — what breaks? What's safer?

  3. If you comment out validateToolInput() entirely — what's the
     worst thing someone could pass as a service name?

  4. Where in your current Sidekick implementation is the equivalent
     of validateToolInput()? Does it exist?
  `);
  console.log("═".repeat(60) + "\n");
}

runExercise().catch(err => {
  console.error("\n❌ Exercise failed:", err.message);
  process.exit(1);
});
