// =============================================================
// shared/mock-executors.js
// Fake tool executors — Jira, Kibana, GitHub, order-service
// These are what YOUR CODE runs when Claude says "use this tool"
// Claude never calls these directly. Your control plane does.
// =============================================================

import { JIRA_TICKETS, KIBANA_LOGS, REPO_CONTEXT, JOURNEY_EVENTS } from "./mock-data.js";


// -----------------------------------------------------------
// EXECUTOR REGISTRY
// One function per tool. Add new tools here.
// Called by the tool loop in demo3, demo4, demo5, sidekick
// -----------------------------------------------------------

// -----------------------------------------------------------
// get_jira_issue
// Input:  { issue_id: "APP-123" }
// Output: Jira ticket object or not-found message
// Used:   Demo 4, Orchestrator
// -----------------------------------------------------------
export async function get_jira_issue({ issue_id }) {
  await simulateLatency(120, 280);

  const ticket = JIRA_TICKETS[issue_id];
  if (!ticket) {
    return {
      found:   false,
      issue_id,
      message: `No ticket found for ${issue_id}`,
    };
  }

  console.log(`  [Jira] Fetched ${issue_id}: "${ticket.summary}"`);
  return { found: true, ...ticket };
}


// -----------------------------------------------------------
// search_kibana_logs
// Input:  { service: "order-service", level: "ERROR", limit: 20 }
// Output: Array of matching log entries
// Used:   Demo 4, Demo 5, Orchestrator
// -----------------------------------------------------------
export async function search_kibana_logs({ service, level, limit = 20, keyword }) {
  await simulateLatency(200, 450);

  let logs = KIBANA_LOGS[service] || [];

  if (level) {
    logs = logs.filter(l => l.level === level.toUpperCase());
  }

  if (keyword) {
    logs = logs.filter(l => l.message.toLowerCase().includes(keyword.toLowerCase()));
  }

  logs = logs.slice(0, limit);

  console.log(`  [Kibana] Searched ${service} logs — ${logs.length} result(s)` +
    (level ? ` [${level}]` : "") +
    (keyword ? ` [keyword: "${keyword}"]` : ""));

  return {
    service,
    count: logs.length,
    logs,
  };
}


// -----------------------------------------------------------
// get_repo_context
// Input:  { file_path: "src/.../OrderProcessor.java", issue_id: "APP-123" }
// Output: Relevant code lines + last commit + suggested fix
// Used:   Demo 4, Orchestrator
// -----------------------------------------------------------
export async function get_repo_context({ file_path, issue_id }) {
  await simulateLatency(150, 300);

  console.log(`  [GitHub] Fetching repo context for ${file_path || issue_id}`);

  return {
    found:  true,
    ...REPO_CONTEXT,
  };
}


// -----------------------------------------------------------
// get_journey_events
// Input:  { session_id: "sess-7f3a9b" }
// Output: Full journey event array for that session
// Used:   Demo 5
// -----------------------------------------------------------
export async function get_journey_events({ session_id }) {
  await simulateLatency(80, 180);

  const events = JOURNEY_EVENTS.filter(e => e.sessionId === session_id);

  console.log(`  [OrderService] Fetched ${events.length} journey events for session ${session_id}`);

  return {
    session_id,
    eventCount: events.length,
    events,
  };
}


// -----------------------------------------------------------
// create_jira_comment
// Input:  { issue_id, comment }
// Output: Confirmation object
// Used:   Demo 2 (write tool — needs ACL), Orchestrator
// -----------------------------------------------------------
export async function create_jira_comment({ issue_id, comment }) {
  await simulateLatency(100, 200);

  console.log(`  [Jira] Adding comment to ${issue_id}:`);
  console.log(`         "${comment.slice(0, 80)}${comment.length > 80 ? "..." : ""}"`);

  return {
    success:   true,
    issue_id,
    commentId: `CMT-${Date.now()}`,
    message:   `Comment added to ${issue_id}`,
  };
}


// -----------------------------------------------------------
// create_github_pr
// Input:  { title, body, branch, base }
// Output: PR object with URL
// Used:   Orchestrator (reveal)
// -----------------------------------------------------------
export async function create_github_pr({ title, body, branch = "fix/order-processor-null-check", base = "main" }) {
  await simulateLatency(200, 400);

  const prNumber = Math.floor(Math.random() * 900) + 100;
  console.log(`  [GitHub] Creating PR #${prNumber}: "${title}"`);

  return {
    success:   true,
    prNumber,
    title,
    branch,
    base,
    url:       `https://github.com/example/ecommerce-platform/pull/${prNumber}`,
    status:    "open",
    createdAt: new Date().toISOString(),
  };
}


// -----------------------------------------------------------
// count_affected_orders
// Input:  { since: "2026-03-27", status: "failed" }
// Output: Count + sample order IDs
// Used:   Orchestrator (reveal)
// -----------------------------------------------------------
export async function count_affected_orders({ since, status = "failed" }) {
  await simulateLatency(100, 250);

  console.log(`  [OrderService] Counting ${status} orders since ${since}`);

  return {
    count:     47,
    status,
    since,
    sampleIds: ["ORD-789", "ORD-793", "ORD-801", "ORD-815", "ORD-822"],
    note:      "All failures share traceId pattern — same root cause suspected",
  };
}


// -----------------------------------------------------------
// MASTER EXECUTOR
// The single function your tool loop calls.
// Maps tool name → executor function.
// Claude says "call get_jira_issue" — your code calls this.
// -----------------------------------------------------------
export async function executeTool(toolName, toolInput) {
  const executors = {
    get_jira_issue:       get_jira_issue,
    search_kibana_logs:   search_kibana_logs,
    get_repo_context:     get_repo_context,
    get_journey_events:   get_journey_events,
    create_jira_comment:  create_jira_comment,
    create_github_pr:     create_github_pr,
    count_affected_orders: count_affected_orders,
  };

  const fn = executors[toolName];

  if (!fn) {
    throw new Error(`Unknown tool: "${toolName}". Available: ${Object.keys(executors).join(", ")}`);
  }

  return fn(toolInput);
}


// -----------------------------------------------------------
// TOOL SCHEMAS
// Exported so demos can pass these to Claude in API calls.
// Claude reads these to know what tools exist and what to pass.
// -----------------------------------------------------------
export const TOOL_SCHEMAS = [
  {
    name:        "get_jira_issue",
    description: "Fetch a Jira ticket by issue ID. Returns summary, description, status, priority, and comments.",
    input_schema: {
      type: "object",
      properties: {
        issue_id: { type: "string", description: "Jira issue ID, e.g. APP-123" },
      },
      required: ["issue_id"],
    },
  },
  {
    name:        "search_kibana_logs",
    description: "Search Kibana logs for a given service. Filter by log level or keyword.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service name, e.g. order-service" },
        level:   { type: "string", enum: ["ERROR", "WARN", "INFO", "DEBUG"], description: "Log level filter" },
        keyword: { type: "string", description: "Keyword to search in log messages" },
        limit:   { type: "number", description: "Max results to return (default 20)" },
      },
      required: ["service"],
    },
  },
  {
    name:        "get_repo_context",
    description: "Fetch relevant source code context and recent commits for a file or issue.",
    input_schema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Path to the source file" },
        issue_id:  { type: "string", description: "Jira issue ID to find related code" },
      },
    },
  },
  {
    name:        "get_journey_events",
    description: "Fetch all recorded user journey events for a session ID.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "User session ID, e.g. sess-7f3a9b" },
      },
      required: ["session_id"],
    },
  },
  {
    name:        "create_jira_comment",
    description: "Add a comment to a Jira issue. WRITE operation — requires ACL approval.",
    input_schema: {
      type: "object",
      properties: {
        issue_id: { type: "string", description: "Jira issue ID" },
        comment:  { type: "string", description: "Comment text to add" },
      },
      required: ["issue_id", "comment"],
    },
  },
  {
    name:        "create_github_pr",
    description: "Create a GitHub pull request. WRITE operation — requires ACL approval.",
    input_schema: {
      type: "object",
      properties: {
        title:  { type: "string", description: "PR title" },
        body:   { type: "string", description: "PR description" },
        branch: { type: "string", description: "Source branch name" },
        base:   { type: "string", description: "Target branch (default: main)" },
      },
      required: ["title", "body"],
    },
  },
  {
    name:        "count_affected_orders",
    description: "Count orders that failed due to a known issue since a given date.",
    input_schema: {
      type: "object",
      properties: {
        since:  { type: "string", description: "ISO date string, e.g. 2026-03-27" },
        status: { type: "string", description: "Order status to filter by (default: failed)" },
      },
      required: ["since"],
    },
  },
];


// -----------------------------------------------------------
// HELPER — simulate realistic network latency
// -----------------------------------------------------------
function simulateLatency(minMs, maxMs) {
  const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}
