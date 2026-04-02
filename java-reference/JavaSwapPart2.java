// =============================================================
// java-reference/JavaSwapPart2.java
// SIDE-BY-SIDE: JavaScript vs Java — Part 2
// ─────────────────────────────────────────────────────────────
// NOT RUNNABLE. Reference only.
// Open side-by-side with the relevant demo file in VS Code.
//
// Covers:
//   Example 6 — Prompt caching
//   Example 7 — ACL pattern
//   Example 8 — Credential handling
// =============================================================

/*
 * HOW TO USE THIS FILE:
 * Left panel  → your Node.js demo file (demo1b, demo2a, demo2b)
 * Right panel → this file
 * These are the three questions Java devs ask most.
 */

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.time.Instant;


@Service
public class JavaSwapPart2 {

    @Value("${anthropic.api.key}")
    private String apiKey;

    private final HttpClient   httpClient = HttpClient.newHttpClient();
    private final ObjectMapper mapper     = new ObjectMapper();


// =============================================================
// EXAMPLE 6 — PROMPT CACHING
// JS file: demos/backend/demo1b-caching.js → demoCaching()
// =============================================================

    /*
     * ─── JavaScript (demo1b-caching.js) ─────────────────────
     *
     * // WRONG — top level (silently fails, ChatGPT's version)
     * {
     *   cache_control: { type: "ephemeral" },   // ← TOP LEVEL — WRONG
     *   system: "Your skill instructions...",
     *   messages: [...]
     * }
     *
     * // RIGHT — block level on the system content
     * const cachedSystem = [{
     *   type: "text",
     *   text: "Your skill instructions...",
     *   cache_control: { type: "ephemeral" }    // ← BLOCK LEVEL — CORRECT
     * }];
     *
     * const response = await callClaude({
     *   model:   MODELS.HAIKU,
     *   system:  cachedSystem,    // ← array, not string
     *   messages: [...]
     * });
     */

    // ─── Java ─────────────────────────────────────────────────
    public String callClaudeWithCaching(String systemPrompt, String userMessage)
        throws Exception {

        // WRONG — don't do this (silently ignored):
        // body.put("cache_control", Map.of("type", "ephemeral"));  ← TOP LEVEL

        // RIGHT — cache_control goes on the content block:
        Map<String, Object> cacheControl = new HashMap<>();
        cacheControl.put("type", "ephemeral");

        Map<String, Object> systemBlock = new HashMap<>();
        systemBlock.put("type",          "text");
        systemBlock.put("text",          systemPrompt);
        systemBlock.put("cache_control", cacheControl);  // ← BLOCK LEVEL

        // system is now a List, not a String
        Map<String, Object> body = new HashMap<>();
        body.put("model",      "claude-haiku-4-5");
        body.put("max_tokens", 500);
        body.put("system",     List.of(systemBlock));   // ← List, not String
        body.put("messages",   List.of(
            Map.of("role", "user", "content", userMessage)
        ));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.anthropic.com/v1/messages"))
            .header("Content-Type",      "application/json")
            .header("x-api-key",         apiKey)
            .header("anthropic-version", "2023-06-01")
            .header("anthropic-beta",    "prompt-caching-2024-11-01")  // ← required
            .POST(HttpRequest.BodyPublishers.ofString(
                mapper.writeValueAsString(body)
            ))
            .build();

        HttpResponse<String> response = httpClient.send(
            request, HttpResponse.BodyHandlers.ofString()
        );

        // Check cache status in usage object
        Map<?, ?> result  = mapper.readValue(response.body(), Map.class);
        Map<?, ?> usage   = (Map<?, ?>) result.get("usage");

        Integer cacheWrite = (Integer) usage.get("cache_creation_input_tokens");
        Integer cacheRead  = (Integer) usage.get("cache_read_input_tokens");

        if (cacheRead != null && cacheRead > 0) {
            System.out.println("Cache HIT — " + cacheRead + " tokens read from cache (90% cheaper)");
        } else if (cacheWrite != null && cacheWrite > 0) {
            System.out.println("Cache MISS — " + cacheWrite + " tokens written to cache");
        }

        List<?>   content    = (List<?>) result.get("content");
        Map<?, ?> firstBlock = (Map<?, ?>) content.get(0);
        return (String) firstBlock.get("text");
    }

    /*
     * THE ONE RULE:
     * cache_control goes on the content BLOCK — not on the request body.
     *
     * WRONG:  body.put("cache_control", ...)   ← top level, silently ignored
     * RIGHT:  systemBlock.put("cache_control", ...)  ← block level, works
     *
     * WHAT CHANGES:     system changes from String → List<Map>
     *                   add anthropic-beta: prompt-caching-2024-11-01 header
     * WHAT STAYS SAME:  everything else — same endpoint, same model, same loop
     *
     * COST IMPACT:
     * Cache miss  → full token cost
     * Cache hit   → 90% cheaper on cached tokens
     * At 1,000 calls/day on a 500-token system prompt:
     *   Without cache: $0.40/day
     *   With cache:    $0.04/day
     */


// =============================================================
// EXAMPLE 7 — ACL PATTERN
// JS file: demos/backend/demo2a-security.js
// =============================================================

    /*
     * ─── JavaScript (demo2a-security.js) ────────────────────
     *
     * const TOOL_ACL = {
     *   "bug-triage": {
     *     allowed: ["get_jira_issue", "search_kibana_logs", "get_repo_context"],
     *   },
     *   "incident-responder": {
     *     allowed: ["get_jira_issue", "search_kibana_logs", "create_jira_comment"],
     *   },
     * };
     *
     * function checkACL(skill, toolName) {
     *   const skillACL = TOOL_ACL[skill];
     *   if (!skillACL) throw new Error(`Unknown skill: ${skill}`);
     *   if (!skillACL.allowed.includes(toolName)) {
     *     throw new Error(`ACL DENIED — ${skill} cannot call ${toolName}`);
     *   }
     *   return true;
     * }
     *
     * // Called before EVERY tool execution:
     * checkACL(skill, toolName);
     * const result = await executeTool(toolName, toolInput);
     */

    // ─── Java ─────────────────────────────────────────────────

    // ACL table — define once, check everywhere
    private static final Map<String, List<String>> TOOL_ACL = Map.of(
        "bug-triage", List.of(
            "get_jira_issue",
            "search_kibana_logs",
            "get_repo_context"
        ),
        "incident-responder", List.of(
            "get_jira_issue",
            "search_kibana_logs",
            "get_repo_context",
            "create_jira_comment",
            "create_github_pr"
        ),
        "journey-tracer", List.of(
            "get_journey_events",
            "search_kibana_logs"
        )
    );

    // Write tools always need an extra approval gate
    private static final List<String> WRITE_TOOLS = List.of(
        "create_jira_comment",
        "create_github_pr"
    );

    // checkACL — call this before EVERY tool execution
    public void checkACL(String skill, String toolName) {
        List<String> allowedTools = TOOL_ACL.get(skill);

        // 1. Does the skill exist?
        if (allowedTools == null) {
            throw new SecurityException(
                "ACL DENIED — Unknown skill: \"" + skill + "\""
            );
        }

        // 2. Is the tool in the allowed list?
        if (!allowedTools.contains(toolName)) {
            throw new SecurityException(
                "ACL DENIED — Skill \"" + skill + "\" cannot call \"" + toolName + "\".\n" +
                "Allowed: " + allowedTools
            );
        }

        // 3. Write tool? Log for audit.
        if (WRITE_TOOLS.contains(toolName)) {
            System.out.println("WRITE TOOL: " + toolName + " — logging for audit");
            // In production: trigger approval workflow, Slack alert, audit log entry
        }
    }

    // Secure executor — wraps your tool execution with ACL check
    public String secureExecute(String skill, String toolName, Map<?,?> toolInput)
        throws Exception {

        // ACL check BEFORE execution — never after
        checkACL(skill, toolName);

        // Your real tool execution goes here
        return executeToolJava(toolName, toolInput);
    }

    private String executeToolJava(String toolName, Map<?,?> input) {
        // Route to Jira client, Kibana client, GitHub client etc.
        return "{\"result\": \"ok\"}";
    }

    /*
     * KEY RULE:
     * Claude never touches your APIs. You execute. You gate.
     * The ACL check fires in YOUR code — not in Claude's reasoning.
     *
     * WHAT CHANGES:     Map/object literal → Map.of() / static final Map
     *                   includes() → List.contains()
     *                   throw new Error → throw new SecurityException
     * WHAT STAYS SAME:  the pattern — check before execute, always
     *
     * IN PRODUCTION:
     * Extract ACL to a database or config file.
     * Add @PreAuthorize annotations for Spring Security integration.
     * Log every tool call to your audit table.
     */


// =============================================================
// EXAMPLE 8 — CREDENTIAL HANDLING
// JS file: demos/backend/demo2b-security.js → demoCredentials()
// =============================================================

    /*
     * ─── JavaScript (demo2b-security.js) ────────────────────
     *
     * // WRONG — credentials in the prompt (never do this)
     * {
     *   system: "Use Jira API key: sk-jira-abc123 to fetch tickets",
     *   messages: [...]
     * }
     *
     * // RIGHT — credentials in your executor, from environment
     * async function get_jira_issue({ issue_id }) {
     *   const key = process.env.JIRA_API_KEY   // ← from .env file
     *   const res = await fetch(jiraUrl, {
     *     headers: { Authorization: `Bearer ${key}` }
     *   });
     *   return res.json();
     * }
     *
     * // Claude sees: { tool: "get_jira_issue", input: { issue_id: "APP-123" } }
     * // Claude never sees: the API key, the auth header, the raw response
     */

    // ─── Java ─────────────────────────────────────────────────

    // Credentials injected from application.properties / environment
    // Never hardcoded. Never passed to Claude.
    @Value("${jira.api.key}")     private String jiraApiKey;
    @Value("${kibana.api.key}")   private String kibanaApiKey;
    @Value("${github.token}")     private String githubToken;

    // What Claude sees — tool name + structured input. No credentials.
    // Claude: { "name": "get_jira_issue", "input": { "issue_id": "APP-123" } }

    // What YOUR executor does — credentials injected, invisible to Claude
    public String getJiraIssue(String issueId) throws Exception {

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://your-org.atlassian.net/rest/api/3/issue/" + issueId))
            .header("Authorization", "Bearer " + jiraApiKey)   // ← never seen by Claude
            .header("Content-Type",  "application/json")
            .GET()
            .build();

        HttpResponse<String> response = httpClient.send(
            request, HttpResponse.BodyHandlers.ofString()
        );

        return response.body();
    }

    // Claude requests: "call get_jira_issue with issue_id APP-123"
    // Your Spring service: routes to getJiraIssue("APP-123")
    // Claude receives: the ticket data — never the credentials used to fetch it

    /*
     * THE RULE:
     * Claude is the reasoning layer.
     * Your Spring service is the execution layer.
     * Credentials live in the execution layer — always.
     *
     * IN SPRING BOOT:
     * Store secrets in: application.properties (local) or
     *                   AWS Secrets Manager / Vault (production)
     * Inject with:      @Value("${secret.name}")
     * Never:            hardcode in any file
     * Never:            pass in system prompt or messages
     * Never:            log API keys in your trace output
     *
     * WHAT CHANGES:     process.env.KEY → @Value("${key}")
     * WHAT STAYS SAME:  the principle — credentials in executor, never in Claude
     */


// =============================================================
// SUMMARY — Part 2
// =============================================================

    /*
     * THREE QUESTIONS JAVA DEVS ALWAYS ASK:
     *
     * Q: Where does cache_control go?
     * A: On the system content BLOCK. Not top-level. Not on the request body.
     *    system becomes a List<Map> instead of a String.
     *    Add the anthropic-beta: prompt-caching-2024-11-01 header.
     *
     * Q: How do I implement ACL in Java?
     * A: Static Map<String, List<String>> for the permission table.
     *    checkACL() method called before every tool execution.
     *    Throw SecurityException on denial — let Spring handle the response.
     *
     * Q: Where do credentials go?
     * A: @Value("${secret}") injected into your executor service.
     *    Claude receives tool names and inputs — never keys.
     *    AWS Secrets Manager or Vault in production.
     *
     * The patterns are identical to JS.
     * The syntax is different.
     * The API doesn't know what language you're using.
     */

}
