// =============================================================
// shared/mock-data.js
// All mock data used across demos 1-5 and the orchestrator.
// Shaped like real Java Spring Boot / Jira / Kibana output.
// No real APIs. No real credentials. Runs offline.
// =============================================================


// -----------------------------------------------------------
// THE FICTIONAL APP
// E-commerce platform — Spring Boot 3, Java 17
// Services: user, product, cart, order (has the bug), payment
// -----------------------------------------------------------


// -----------------------------------------------------------
// JIRA TICKETS
// Used by: Demo 4 (Issue Debugger), Orchestrator (Reveal)
// -----------------------------------------------------------
export const JIRA_TICKETS = {
  "APP-123": {
    id:          "APP-123",
    summary:     "Order sync failure — checkout silently returns 500",
    description: `Users report completing checkout but receiving no confirmation.
Order appears to process on frontend but fails silently on backend.
No error message shown to user. Affects ~12% of orders since vendor contract update.
First reported: 2026-03-28. Frequency: increasing.`,
    status:      "OPEN",
    priority:    "P1",
    assignee:    "unassigned",
    reporter:    "monitoring-alert",
    created:     "2026-03-28T09:14:00Z",
    updated:     "2026-04-01T08:45:00Z",
    labels:      ["order-service", "checkout", "vendor-integration"],
    comments: [
      {
        author: "sarah.chen",
        body:   "Seeing this in Kibana. Stack trace points to OrderProcessor.java:142",
        time:   "2026-03-28T10:30:00Z",
      },
      {
        author: "dev-ops",
        body:   "Rolled back vendor payload schema change — did not resolve.",
        time:   "2026-03-29T14:15:00Z",
      },
    ],
  },

  "APP-456": {
    id:          "APP-456",
    summary:     "Product search returns empty results for hyphenated SKUs",
    description: "Search query with hyphen in SKU (e.g. PROD-001) returns 0 results. URL encoding issue suspected.",
    status:      "IN_PROGRESS",
    priority:    "P2",
    assignee:    "james.okafor",
    reporter:    "qa-team",
    created:     "2026-03-30T11:00:00Z",
    updated:     "2026-03-31T16:20:00Z",
    labels:      ["product-service", "search"],
    comments: [],
  },
};


// -----------------------------------------------------------
// KIBANA LOGS
// Used by: Demo 4 (Issue Debugger), Demo 5 (Journey Tracer)
// Shaped like real Spring Boot Sleuth/MDC log format
// Format: TIMESTAMP LEVEL [service,traceId,spanId] logger : message
// -----------------------------------------------------------
export const KIBANA_LOGS = {
  "order-service": [
    {
      timestamp: "2026-04-01T10:28:11.042Z",
      level:     "INFO",
      service:   "order-service",
      traceId:   "abc123",
      spanId:    "def456",
      logger:    "c.example.orders.OrderController",
      message:   "Received order request ORD-789 for user USR-442",
    },
    {
      timestamp: "2026-04-01T10:28:11.187Z",
      level:     "INFO",
      service:   "order-service",
      traceId:   "abc123",
      spanId:    "def456",
      logger:    "c.example.orders.VendorPayloadMapper",
      message:   "Mapping vendor payload for ORD-789 — deliveryWindow field: null",
    },
    {
      timestamp: "2026-04-01T10:28:11.203Z",
      level:     "ERROR",
      service:   "order-service",
      traceId:   "abc123",
      spanId:    "def456",
      logger:    "c.example.orders.OrderProcessor",
      message:   "Failed to process order ORD-789 — NullPointerException at OrderProcessor.java:142",
      stackTrace: [
        "java.lang.NullPointerException: Cannot invoke \"String.toString()\" because the return value of \"VendorPayload.getDeliveryWindow()\" is null",
        "  at c.example.orders.OrderProcessor.processVendorPayload(OrderProcessor.java:142)",
        "  at c.example.orders.OrderProcessor.process(OrderProcessor.java:89)",
        "  at c.example.orders.OrderController.createOrder(OrderController.java:54)",
      ],
    },
    {
      timestamp: "2026-04-01T10:28:11.210Z",
      level:     "ERROR",
      service:   "order-service",
      traceId:   "abc123",
      spanId:    "def456",
      logger:    "c.example.orders.OrderController",
      message:   "Returning HTTP 500 for order ORD-789 — no user-facing error message generated",
    },
  ],

  "payment-service": [
    {
      timestamp: "2026-04-01T10:28:09.001Z",
      level:     "INFO",
      service:   "payment-service",
      traceId:   "abc122",
      spanId:    "pay001",
      logger:    "c.example.payments.PaymentGateway",
      message:   "Payment authorised for ORD-789 — amount: £129.99",
    },
  ],

  "user-service": [
    {
      timestamp: "2026-04-01T10:27:58.001Z",
      level:     "INFO",
      service:   "user-service",
      traceId:   "abc120",
      spanId:    "usr001",
      logger:    "c.example.users.AuthController",
      message:   "User USR-442 authenticated successfully",
    },
  ],
};


// -----------------------------------------------------------
// GITHUB / REPO CONTEXT
// Used by: Demo 4 (Issue Debugger)
// Simulates a code search result on the relevant file
// -----------------------------------------------------------
export const REPO_CONTEXT = {
  file:       "src/main/java/com/example/orders/OrderProcessor.java",
  repository: "ecommerce-platform",
  branch:     "main",
  lastCommit: {
    hash:    "f3a8c12",
    message: "Update vendor payload mapping for new contract schema",
    author:  "james.okafor",
    date:    "2026-03-27T17:42:00Z",
  },
  relevantLines: {
    138: "  private void processVendorPayload(VendorPayload vendorPayload) {",
    139: "    String orderId = vendorPayload.getOrderId();",
    140: "    String vendorRef = vendorPayload.getVendorReference();",
    141: "    // deliveryWindow was required — now optional since v2.4 contract",
    142: "    String window = vendorPayload.getDeliveryWindow().toString(); // ← NULL HERE",
    143: "    this.orderRecord.setDeliveryWindow(window);",
    144: "  }",
  },
  suggestedFix: {
    line:   142,
    before: '    String window = vendorPayload.getDeliveryWindow().toString();',
    after:  '    String window = vendorPayload.getDeliveryWindow() != null\n        ? vendorPayload.getDeliveryWindow().toString()\n        : "STANDARD";',
  },
};


// -----------------------------------------------------------
// JOURNEY EVENTS
// Used by: Demo 5 (Journey Tracer)
// A complete user session — login to confirm
// Anomaly injected at step 4 (checkout)
// -----------------------------------------------------------
export const JOURNEY_EVENTS = [
  {
    sessionId:  "sess-7f3a9b",
    userId:     "USR-442",
    step:       "login",
    stepNumber: 1,
    timestamp:  "2026-04-01T10:27:58.001Z",
    durationMs: 312,
    status:     "success",
    metadata: {
      method:    "email_password",
      userAgent: "Mozilla/5.0 (Windows NT 10.0)",
      ipCountry: "GB",
    },
  },
  {
    sessionId:  "sess-7f3a9b",
    userId:     "USR-442",
    step:       "search",
    stepNumber: 2,
    timestamp:  "2026-04-01T10:28:04.210Z",
    durationMs: 890,
    status:     "success",
    metadata: {
      query:        "wireless headphones",
      resultsCount: 24,
      clickedSKU:   "PROD-881",
    },
  },
  {
    sessionId:  "sess-7f3a9b",
    userId:     "USR-442",
    step:       "add_to_cart",
    stepNumber: 3,
    timestamp:  "2026-04-01T10:28:07.540Z",
    durationMs: 204,
    status:     "success",
    metadata: {
      sku:      "PROD-881",
      quantity: 1,
      price:    129.99,
    },
  },
  {
    sessionId:  "sess-7f3a9b",
    userId:     "USR-442",
    step:       "checkout",
    stepNumber: 4,
    timestamp:  "2026-04-01T10:28:11.203Z",
    durationMs: 8743,   // ← abnormally long — spinner visible to user
    status:     "failure",
    anomaly:    true,   // ← flag Claude will detect
    metadata: {
      orderId:    "ORD-789",
      httpStatus: 500,
      errorShown: false,  // silent failure — user sees no error message
      paymentCharged: true, // payment went through but order failed
    },
  },
  {
    sessionId:  "sess-7f3a9b",
    userId:     "USR-442",
    step:       "confirm",
    stepNumber: 5,
    timestamp:  null,   // never reached
    durationMs: null,
    status:     "not_reached",
    metadata:   {},
  },
];


// -----------------------------------------------------------
// COST TABLE
// Used by: Demo 1 (Token Optimization)
// Approximate costs per million tokens (as of early 2026)
// Used to show cost delta between model choices
// -----------------------------------------------------------
export const MODEL_COSTS = {
  "claude-haiku-4-5": {
    inputPerMillion:  0.80,
    outputPerMillion: 4.00,
    label: "Haiku — fast, cheap",
  },
  "claude-sonnet-4-5": {
    inputPerMillion:  3.00,
    outputPerMillion: 15.00,
    label: "Sonnet — balanced",
  },
  "claude-opus-4-5": {
    inputPerMillion:  15.00,
    outputPerMillion: 75.00,
    label: "Opus — powerful, expensive",
  },
};

export function estimateCostUSD(model, inputTokens, outputTokens = 200) {
  const costs = MODEL_COSTS[model];
  if (!costs) return null;
  const input  = (inputTokens  / 1_000_000) * costs.inputPerMillion;
  const output = (outputTokens / 1_000_000) * costs.outputPerMillion;
  return {
    inputCost:  input.toFixed(6),
    outputCost: output.toFixed(6),
    totalCost:  (input + output).toFixed(6),
    label:      costs.label,
  };
}
