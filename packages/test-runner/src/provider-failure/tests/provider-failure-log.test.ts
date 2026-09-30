import assert from "node:assert/strict";
import test from "node:test";
import { PROVIDER_FAILURE_BODY_MAX_CHARS, PROVIDER_FAILURE_LOG_MAX_RECORDS, ProviderFailureLog, type ProviderFailureRecord } from "../index.js";

const AT = "2026-09-26T02:44:13.117Z";
const now = () => new Date(AT);

/** The shape Core answered the two failed runs with: a refusal whose `payload.diagnostic` is what the Lab parses. */
function coreRefusal(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    ok: false,
    error: "Flow bootstrap generation failed.",
    payload: {
      diagnostic: {
        code: "flow_bootstrap.provider_transport_unknown",
        stage: "provider_request",
        retryable: false,
        providerInvocation: "attempted",
        providerResponse: "unknown",
        accounting: { requestId: "req-1", estimatedInputTokens: 51_200, provider: "deepseek", model: "deepseek-flash" },
        ...overrides,
      },
    },
  });
}

function record(log: ProviderFailureLog, body: string, httpStatus = 400): void {
  log.record({ route: "generate-flow-bootstrap-adaptation", httpStatus, body, controlRequestBytes: 214 });
}

function only(log: ProviderFailureLog): ProviderFailureRecord {
  const [entry] = log.entries();
  assert.ok(entry && !("withheld" in entry), "the entry was withheld");
  return entry;
}

test("a failed call keeps the status, the body verbatim, and the diagnostic the published record collapses", () => {
  const log = new ProviderFailureLog({ secrets: [], now });
  record(log, coreRefusal());
  const entry = only(log);

  assert.equal(entry.at, AT);
  assert.equal(entry.route, "generate-flow-bootstrap-adaptation");
  assert.equal(entry.core.httpStatus, 400);
  assert.equal(entry.core.bodyTruncated, false);
  // The body is kept as it arrived: the refusal sentence the published bundle may not carry.
  assert.match(entry.core.body, /Flow bootstrap generation failed\./u);
  // The three questions the brief asks this file to tell apart.
  assert.equal(entry.provider.code, "flow_bootstrap.provider_transport_unknown");
  assert.equal(entry.provider.stage, "provider_request");
  assert.equal(entry.provider.estimatedInputTokens, 51_200);
  assert.equal(entry.provider.model, "deepseek-flash");
  assert.equal(entry.provider.invocation, "attempted");
  assert.equal(entry.provider.response, "unknown");
  assert.equal(entry.request.controlRequestBytes, 214);
});

test("the run's declared bounds ride beside the failure, so a size refusal reads against its limit", () => {
  const bounds = { provider: "deepseek", model: "deepseek-flash", maxInputTokens: 48_000, maxOutputTokens: 8_000, maxTotalTokensPerRequest: 56_000, maxCallsPerRun: 48, maxTotalTokensPerRun: 600_000, timeoutMs: 25_000 };
  const log = new ProviderFailureLog({ secrets: [], bounds, now });
  record(log, coreRefusal());
  const entry = only(log);

  assert.deepEqual(entry.request.bounds, bounds);
  // 51,200 estimated input tokens against a 48,000 limit: the request was too large, and the file says so without a second document.
  assert.ok((entry.provider.estimatedInputTokens ?? 0) > (entry.request.bounds?.maxInputTokens ?? 0));
});

test("the tools the loop had called are named, and a first-call failure names none", () => {
  const withTools = new ProviderFailureLog({ secrets: [], now });
  record(withTools, coreRefusal({ evidenceLoop: { decisionCount: 3, toolCallCount: 2, evidenceBytes: 900, steps: [{ toolId: "web.read_page" }, { toolId: "web.click" }] } }));
  assert.deepEqual(only(withTools).provider.toolIds, ["web.read_page", "web.click"]);
  assert.equal(only(withTools).provider.toolCallCount, 2);

  const firstCall = new ProviderFailureLog({ secrets: [], now });
  record(firstCall, coreRefusal());
  assert.equal(only(firstCall).provider.toolIds, null);
});

test("a body that is not JSON is still kept whole, with every read field null", () => {
  const log = new ProviderFailureLog({ secrets: [], now });
  record(log, "<html><body>502 Bad Gateway</body></html>", 502);
  const entry = only(log);

  assert.equal(entry.core.httpStatus, 502);
  assert.equal(entry.core.body, "<html><body>502 Bad Gateway</body></html>");
  assert.equal(entry.provider.code, null);
  assert.equal(entry.provider.httpStatus, null);
});

test("DeepSeek's own status and body travel when Core reports them, and are null when it does not", () => {
  const carried = new ProviderFailureLog({ secrets: [], now });
  record(carried, coreRefusal({
    code: "flow_bootstrap.provider_http_error",
    accounting: { requestId: "req-1", provider: "deepseek", model: "deepseek-flash", providerStatus: 400, providerBody: "{\"error\":{\"message\":\"tool schema invalid\"}}" },
  }));
  assert.equal(only(carried).provider.httpStatus, 400);
  assert.match(only(carried).provider.body ?? "", /tool schema invalid/u);

  // Today's Core discards the provider's reply before it throws, so this is the observed case.
  const absent = new ProviderFailureLog({ secrets: [], now });
  record(absent, coreRefusal());
  assert.equal(only(absent).provider.httpStatus, null);
  assert.equal(only(absent).provider.body, null);
});

test("a configured secret in the body is redacted, not written", () => {
  const key = "sk-livekeyvalue0123456789";
  const log = new ProviderFailureLog({ secrets: [key], now });
  record(log, JSON.stringify({ ok: false, error: `upstream rejected ${key}` }));
  const entry = only(log);

  assert.ok(!entry.core.body.includes(key), "the credential reached the record");
  assert.match(entry.core.body, /\[REDACTED\]/u);
  assert.ok(!JSON.stringify(log.entries()).includes(key));
});

test("an authorization header echoed in a body is redacted by pattern, with no secret configured", () => {
  const log = new ProviderFailureLog({ secrets: [], now });
  record(log, JSON.stringify({ ok: false, error: "rejected request with Authorization: Bearer abc123.def456" }));
  assert.ok(!only(log).core.body.includes("abc123.def456"));
});

test("a body that cannot be made safe is withheld rather than written", () => {
  // A redactor that removes nothing stands in for any failure of the redaction pass. The
  // assertion on the finished record still runs with the run's real secrets, so the entry
  // becomes a stub carrying only the route and the status.
  const log = new ProviderFailureLog({ secrets: ["never-removed"], redact: value => value, now });
  record(log, "leak never-removed leak");
  const [entry] = log.entries();

  assert.ok(entry && "withheld" in entry, "the unsafe body was kept");
  assert.deepEqual(entry, { at: AT, route: "generate-flow-bootstrap-adaptation", httpStatus: 400, withheld: "redaction_failed" });
  assert.ok(!JSON.stringify(log.entries()).includes("never-removed"));
});

test("an oversize body is bounded and says it was cut", () => {
  const log = new ProviderFailureLog({ secrets: [], now });
  const body = "x".repeat(PROVIDER_FAILURE_BODY_MAX_CHARS + 500);
  record(log, body);
  const entry = only(log);

  assert.equal(entry.core.body.length, PROVIDER_FAILURE_BODY_MAX_CHARS);
  assert.equal(entry.core.bodyTruncated, true);
  assert.equal(entry.core.bodyBytes, body.length);
});

test("a run that failed more often than the cap keeps the cap and counts the rest", () => {
  const log = new ProviderFailureLog({ secrets: [], now });
  for (let index = 0; index < PROVIDER_FAILURE_LOG_MAX_RECORDS + 3; index += 1) record(log, coreRefusal());

  assert.equal(log.size, PROVIDER_FAILURE_LOG_MAX_RECORDS);
  assert.equal(log.dropped, 3);
});

test("a log nothing failed on holds nothing", () => {
  const log = new ProviderFailureLog({ secrets: [], now });
  assert.equal(log.size, 0);
  assert.deepEqual(log.entries(), []);
});

test("an unnamed throw carries its class, code, cause and screened message, redacted again, and is null when Core sent none", () => {
  const key = "sk-livekeyvalue0123456789";
  const log = new ProviderFailureLog({ secrets: [key], now });
  record(log, coreRefusal({ providerThrow: { errorClass: "TypeError", causeClass: "Error", causeCode: "ECONNRESET", message: `fetch failed: socket hang up near ${key}`, withheld: ["cause_message_unscreened"] } }));
  record(log, coreRefusal());
  const [thrown, plain] = log.entries() as ProviderFailureRecord[];

  assert.deepEqual({ ...thrown?.provider.thrown, message: undefined }, { errorClass: "TypeError", errorCode: null, causeClass: "Error", causeCode: "ECONNRESET", message: undefined, withheld: ["cause_message_unscreened"] });
  assert.match(thrown?.provider.thrown?.message ?? "", /^fetch failed: socket hang up near \[REDACTED\]$/u);
  assert.ok(!JSON.stringify(log.entries()).includes(key));
  assert.equal(plain?.provider.thrown, null);
});
