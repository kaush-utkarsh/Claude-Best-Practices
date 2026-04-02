// =============================================================
// java-reference/JavaSwapPart1.java
// SIDE-BY-SIDE: JavaScript vs Java — Part 1
// ─────────────────────────────────────────────────────────────
// NOT RUNNABLE. Reference only.
// Open side-by-side with the relevant demo file in VS Code.
//
// Covers:
//   Example 1 — Basic API call
//   Example 2 — Token counting
//   Example 3 — Tool definition
//   Example 4 — Tool loop
//   Example 5 — Streaming
// =============================================================

/*
 * HOW TO USE THIS FILE:
 * Left panel  → your Node.js demo file
 * Right panel → this file
 * Scroll together. Point at each example.
 * Say: "Same pattern. Different syntax."
 */

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;


@Service
public class JavaSwapPart1 {

    @Value("${anthropic.api.key}")   // ← from application.properties, never hardcoded
    private String apiKey;

    private final HttpClient   httpClient = HttpClient.newHttpClient();
    private final ObjectMapper mapper     = new ObjectMapper();


// =============================================================
// EXAMPLE 1 — BASIC API CALL
// JS file: demos/backend/shared/api-client.js → callClaude()
// =============================================================

    /*
     * ─── JavaScript (api-client.js) ─────────────────────────
     *
     * const response = await callClaude({
     *   model:      MODELS.HAIKU,
     *   system:     "You are a helpful assistant.",
     *   messages:   [{ role: "user", content: "What is 2+2?" }],
     *   max_tokens: 100,
     * });
     *
     * console.log(response.content[0].text);
     */

    // ─── Java ─────────────────────────────────────────────────
    public String callClaude(String model, String system, String userMessage)
        throws Exception {

        Map<String, Object> body = new HashMap<>();
        body.put("model",      model);
        body.put("max_tokens", 100);
        body.put("system",     system);
        body.put("messages",   List.of(
            Map.of("role", "user", "content", userMessage)
        ));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.anthropic.com/v1/messages"))
            .header("Content-Type",      "application/json")
            .header("x-api-key",         apiKey)
            .header("anthropic-version", "2023-06-01")
            .POST(HttpRequest.BodyPublishers.ofString(
                mapper.writeValueAsString(body)
            ))
            .build();

        HttpResponse<String> response = httpClient.send(
            request, HttpResponse.BodyHandlers.ofString()
        );

        Map<?, ?> result      = mapper.readValue(response.body(), Map.class);
        List<?>   content     = (List<?>) result.get("content");
        Map<?, ?> firstBlock  = (Map<?, ?>) content.get(0);
        return (String) firstBlock.get("text");
    }

    /*
     * WHAT CHANGES:     fetch → HttpClient
     *                   JSON.stringify → mapper.writeValueAsString
     *                   response.json() → mapper.readValue
     * WHAT STAYS SAME:  URL, headers, request body shape, response shape
     * LINE COUNT:        JS ~8 lines   Java ~25 lines
     */


// =============================================================
// EXAMPLE 2 — TOKEN COUNTING
// JS file: demos/backend/shared/api-client.js → countTokens()
// =============================================================

    /*
     * ─── JavaScript (api-client.js) ─────────────────────────
     *
     * const result = await countTokens({
     *   system:   "You are a helpful assistant.",
     *   messages: [{ role: "user", content: "Hello" }],
     * });
     *
     * console.log(result.input_tokens); // e.g. 14
     *
     * KEY RULE: model is ALWAYS Haiku inside countTokens().
     * Never burn Opus just to count tokens.
     */

    // ─── Java ─────────────────────────────────────────────────
    public int countTokens(String system, String userMessage) throws Exception {

        Map<String, Object> body = new HashMap<>();
        body.put("model",    "claude-haiku-4-5");   // ← ALWAYS Haiku. Non-negotiable.
        body.put("system",   system);
        body.put("messages", List.of(
            Map.of("role", "user", "content", userMessage)
        ));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.anthropic.com/v1/messages/count_tokens"))
            .header("Content-Type",      "application/json")
            .header("x-api-key",         apiKey)
            .header("anthropic-version", "2023-06-01")
            .header("anthropic-beta",    "token-counting-2024-11-01")  // ← required
            .POST(HttpRequest.BodyPublishers.ofString(
                mapper.writeValueAsString(body)
            ))
            .build();

        HttpResponse<String> response = httpClient.send(
            request, HttpResponse.BodyHandlers.ofString()
        );

        Map<?, ?> result = mapper.readValue(response.body(), Map.class);
        return (Integer) result.get("input_tokens");
    }

    /*
     * WHAT CHANGES:     endpoint → /v1/messages/count_tokens
     *                   extra header → anthropic-beta: token-counting-2024-11-01
     * WHAT STAYS SAME:  same body shape, same model field, same Haiku rule
     */


// =============================================================
// EXAMPLE 3 — TOOL DEFINITION
// JS file: demos/backend/shared/mock-executors.js → TOOL_SCHEMAS
// =============================================================

    /*
     * ─── JavaScript (mock-executors.js) ─────────────────────
     *
     * const TOOL_SCHEMAS = [{
     *   name:        "get_jira_issue",
     *   description: "Fetch a Jira ticket by issue ID.",
     *   input_schema: {
     *     type: "object",
     *     properties: {
     *       issue_id: { type: "string", description: "Jira issue ID, e.g. APP-123" }
     *     },
     *     required: ["issue_id"]
     *   }
     * }];
     */

    // ─── Java ─────────────────────────────────────────────────
    public List<Map<String, Object>> buildToolSchemas() {

        // Property: issue_id
        Map<String, Object> issueIdProp = new HashMap<>();
        issueIdProp.put("type",        "string");
        issueIdProp.put("description", "Jira issue ID, e.g. APP-123");

        // input_schema
        Map<String, Object> inputSchema = new HashMap<>();
        inputSchema.put("type",       "object");
        inputSchema.put("properties", Map.of("issue_id", issueIdProp));
        inputSchema.put("required",   List.of("issue_id"));

        // tool
        Map<String, Object> tool = new HashMap<>();
        tool.put("name",         "get_jira_issue");
        tool.put("description",  "Fetch a Jira ticket by issue ID.");
        tool.put("input_schema", inputSchema);

        return List.of(tool);
    }

    /*
     * WHAT CHANGES:     object literal {} → Map.of() / new HashMap()
     * WHAT STAYS SAME:  field names: name, description, input_schema,
     *                   type, properties, required — all identical
     * TIP:              In production create a ToolSchema record to avoid
     *                   Map<String, Object> everywhere.
     */


// =============================================================
// EXAMPLE 4 — TOOL LOOP
// JS file: demos/backend/demo3-agent.js → runAgent()
// =============================================================

    /*
     * ─── JavaScript (demo3-agent.js) ────────────────────────
     *
     * while (step < MAX_STEPS) {
     *   const response = await callClaude({ model, system, messages, tools });
     *   messages.push({ role: "assistant", content: response.content });
     *
     *   if (response.stop_reason === "end_turn") break;
     *
     *   if (response.stop_reason === "tool_use") {
     *     for (const toolUse of toolUseBlocks) {
     *       const result = await executeTool(toolUse.name, toolUse.input);
     *       toolResults.push({
     *         type:        "tool_result",
     *         tool_use_id: toolUse.id,
     *         content:     JSON.stringify(result),
     *       });
     *     }
     *     messages.push({ role: "user", content: toolResults });
     *   }
     * }
     */

    // ─── Java ─────────────────────────────────────────────────
    public String runToolLoop(
        String system,
        List<Map<String, Object>> messages,
        List<Map<String, Object>> tools,
        int maxSteps
    ) throws Exception {

        int step = 0;

        while (step < maxSteps) {
            step++;

            // 1. Call Claude
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model",      "claude-sonnet-4-5");
            requestBody.put("max_tokens", 1000);
            requestBody.put("system",     system);
            requestBody.put("messages",   messages);
            requestBody.put("tools",      tools);

            HttpResponse<String> httpResp = httpClient.send(
                HttpRequest.newBuilder()
                    .uri(URI.create("https://api.anthropic.com/v1/messages"))
                    .header("Content-Type",      "application/json")
                    .header("x-api-key",         apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .POST(HttpRequest.BodyPublishers.ofString(
                        mapper.writeValueAsString(requestBody)
                    ))
                    .build(),
                HttpResponse.BodyHandlers.ofString()
            );

            Map<?, ?> response  = mapper.readValue(httpResp.body(), Map.class);
            List<?>   content   = (List<?>) response.get("content");
            String    stopReason = (String) response.get("stop_reason");

            // 2. Add Claude response to history
            messages.add(Map.of("role", "assistant", "content", content));

            // 3. Done
            if ("end_turn".equals(stopReason)) {
                for (Object block : content) {
                    Map<?,?> b = (Map<?,?>) block;
                    if ("text".equals(b.get("type"))) return (String) b.get("text");
                }
                return "";
            }

            // 4. Tool use
            if ("tool_use".equals(stopReason)) {
                List<Map<String, Object>> toolResults = new ArrayList<>();

                for (Object block : content) {
                    Map<?,?> b = (Map<?,?>) block;
                    if (!"tool_use".equals(b.get("type"))) continue;

                    String toolName   = (String)  b.get("name");
                    Map<?,?> input    = (Map<?,?>) b.get("input");
                    String  toolUseId = (String)   b.get("id");

                    // YOUR CODE executes the tool — never Claude
                    String result = executeToolJava(toolName, input);

                    toolResults.add(Map.of(
                        "type",        "tool_result",
                        "tool_use_id", toolUseId,
                        "content",     result
                    ));
                }

                messages.add(Map.of("role", "user", "content", toolResults));
            }
        }

        return "Step limit reached — graceful degradation";
    }

    private String executeToolJava(String toolName, Map<?,?> input) {
        // Route to your real executors here — Jira client, Kibana client, etc.
        return "{\"result\": \"ok\"}";
    }

    /*
     * WHAT CHANGES:     await → synchronous HttpClient.send()
     *                   JSON.parse → mapper.readValue
     *                   === → .equals()
     * WHAT STAYS SAME:  stop_reason values: "end_turn", "tool_use"
     *                   message structure: role + content
     *                   tool_result structure: type, tool_use_id, content
     *                   the loop logic itself — identical
     */


// =============================================================
// EXAMPLE 5 — STREAMING
// JS file: demos/ui/streaming-server.js + streaming.html
// =============================================================

    /*
     * ─── JavaScript (streaming-server.js) ───────────────────
     *
     * const response = await fetch(url, {
     *   body: JSON.stringify({ ...params, stream: true })
     * });
     *
     * const reader = response.body.getReader();
     * while (true) {
     *   const { done, value } = await reader.read();
     *   if (done) break;
     *   // decode chunk → parse SSE line → extract text_delta → render
     * }
     */

    /*
     * ─── Java (Spring WebFlux) ──────────────────────────────
     *
     * The one flag that matters: "stream": true in the request body.
     * Everything else on the API side is identical.
     * The difference is how you read the SSE response in Java.
     *
     * WebClient client = WebClient.create("https://api.anthropic.com");
     *
     * Flux<String> tokenStream = client.post()
     *     .uri("/v1/messages")
     *     .header("x-api-key",         apiKey)
     *     .header("anthropic-version", "2023-06-01")
     *     .bodyValue(Map.of(
     *         "model",      "claude-haiku-4-5",
     *         "max_tokens", 500,
     *         "stream",     true,           // ← the one flag
     *         "messages",   List.of(Map.of("role", "user", "content", prompt))
     *     ))
     *     .retrieve()
     *     .bodyToFlux(String.class);       // ← reads SSE line by line
     *
     * tokenStream.subscribe(line -> {
     *     if (line.startsWith("data: ")) {
     *         String data = line.substring(6);
     *         // parse JSON → check type === "content_block_delta"
     *         // extract delta.text → push to UI via WebSocket or SseEmitter
     *     }
     * });
     *
     * SPRING MVC (blocking) alternative:
     * Use SseEmitter — emit each token as it arrives.
     * Add spring-boot-starter-webflux to pom.xml for WebClient.
     *
     * WHAT CHANGES:     fetch → WebClient (reactive) or SseEmitter (blocking)
     * WHAT STAYS SAME:  stream: true flag, SSE line format,
     *                   content_block_delta event type, delta.text field
     */


// =============================================================
// SUMMARY
// =============================================================

    /*
     * WHAT STAYS THE SAME (always):
     * ✅ API endpoints         — identical URLs
     * ✅ Request body shape    — same JSON structure
     * ✅ Response body shape   — same JSON structure
     * ✅ Tool loop pattern     — same logic, same field names
     * ✅ stop_reason values    — "end_turn", "tool_use"
     * ✅ Model name strings    — "claude-haiku-4-5" etc.
     * ✅ The architecture      — control plane + Claude runtime
     *
     * WHAT CHANGES (syntax only):
     * ↔ HTTP client           fetch → HttpClient / WebClient
     * ↔ JSON handling         JSON.stringify/parse → ObjectMapper
     * ↔ Object creation       {} literal → Map.of() / new HashMap()
     * ↔ Async                 await → CompletableFuture / Flux
     * ↔ Line count            ~8 lines JS → ~25 lines Java
     *
     * THE BOTTOM LINE:
     * The API doesn't know what language you're using.
     * If you understood the JS demos — you understand Java too.
     * Copy the pattern. Swap the syntax.
     */

}
