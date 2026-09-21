import {
  WEB_AUTOMATION_FAILURE_CODES,
  WEB_AUTOMATION_JAVASCRIPT_INPUT_MAX_BYTES,
  WEB_AUTOMATION_JAVASCRIPT_OUTPUT_MAX_BYTES,
  WEB_AUTOMATION_JAVASCRIPT_SOURCE_MAX_BYTES,
  WEB_AUTOMATION_JAVASCRIPT_TIMEOUT_DEFAULT_MS,
  WEB_AUTOMATION_JAVASCRIPT_TIMEOUT_MAX_MS
} from "@fluxiq-web-extension/domain/client";
import type { JsonValue } from "../shared/protocol";
import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import {
  workerActionFailedFailure,
  workerActionResult,
  workerBlockedFailure,
  workerTimeoutFailure
} from "./action-results";

type UserScriptInjectionResult = { frameId: number; result?: unknown; error?: string };
type UserScriptEnvelope =
  | { tag: typeof USER_SCRIPT_ENVELOPE_TAG; kind: "value"; json: string }
  | { tag: typeof USER_SCRIPT_ENVELOPE_TAG; kind: "timeout" | "invalid" | "too_large" | "failed" };
type UserScriptsApi = {
  getScripts(filter?: { ids?: string[] }): Promise<unknown[]>;
  execute(injection: {
    js: Array<{ code: string }>;
    target: { tabId: number; frameIds: number[] };
    world: "USER_SCRIPT";
    worldId: string;
    injectImmediately: boolean;
  }): Promise<UserScriptInjectionResult[]>;
};

const EXECUTION_MARGIN_MS = 1_000;
const USER_SCRIPT_ENVELOPE_TAG = "fluxiq-user-script-v1";

/** Runs reviewed source in the browser's isolated user-script world. */
export async function runBrowserJavaScriptAction(
  action: BrowserActionCommand,
  tabId: number,
  frameId: number
): Promise<BrowserActionResult> {
  const startedAt = Date.now();
  const api = (chrome as typeof chrome & { userScripts?: UserScriptsApi }).userScripts;
  if (!api || typeof api.execute !== "function") return unavailable(action, startedAt);
  try {
    await api.getScripts();
  } catch {
    return unavailable(action, startedAt);
  }
  if (typeof action.source !== "string"
    || action.source.trim().length === 0
    || utf8Bytes(action.source) > WEB_AUTOMATION_JAVASCRIPT_SOURCE_MAX_BYTES
    || !isJsonObject(action.inputs)
    || jsonBytes(action.inputs) > WEB_AUTOMATION_JAVASCRIPT_INPUT_MAX_BYTES
    || !validTimeout(action.timeoutMs)) {
    return refused(action, startedAt, "JavaScript action parameters are invalid or outside their configured limits.");
  }
  const timeoutMs = action.timeoutMs ?? WEB_AUTOMATION_JAVASCRIPT_TIMEOUT_DEFAULT_MS;
  const code = executableSource(action.source, action.inputs, timeoutMs);
  const worldId = `fluxiq-${globalThis.crypto.randomUUID()}`;
  try {
    const results = await settleWithin(
      api.execute({
        js: [{ code }],
        target: { tabId, frameIds: [frameId] },
        world: "USER_SCRIPT",
        worldId,
        injectImmediately: true
      }),
      timeoutMs + EXECUTION_MARGIN_MS
    );
    if (results === undefined) return timedOut(action, startedAt, timeoutMs);
    const injected = results.find((result) => result.frameId === frameId) ?? results[0];
    if (!injected || injected.error !== undefined) return failed(action, startedAt, "JavaScript execution failed in the browser user-script world.");
    const envelope = userScriptEnvelope(injected.result);
    if (!envelope) return failed(action, startedAt, "JavaScript execution returned an invalid browser envelope.");
    if (envelope.kind === "timeout") return timedOut(action, startedAt, timeoutMs);
    if (envelope.kind === "too_large") return failed(action, startedAt, "JavaScript returned a value larger than the configured output limit.");
    if (envelope.kind === "invalid") return failed(action, startedAt, "JavaScript must return a JSON value.");
    if (envelope.kind === "failed") return failed(action, startedAt, "JavaScript execution failed in the browser user-script world.");
    if (envelope.kind !== "value") return failed(action, startedAt, "JavaScript execution returned an invalid browser envelope.");
    const result = parseEnvelopeValue(envelope.json);
    if (!result.ok) return failed(action, startedAt, result.reason);
    return {
      ...workerActionResult(action, startedAt, {
        status: "succeeded",
        message: "JavaScript execution completed.",
        validation: { status: "none", reason: "not-yet-validated" }
      }),
      extracted: result.value
    };
  } catch {
    return failed(action, startedAt, "JavaScript execution failed in the browser user-script world.");
  }
}

function executableSource(source: string, inputs: Record<string, JsonValue>, timeoutMs: number): string {
  const serializedInputs = JSON.stringify(inputs);
  return `(async()=>{const tag=${JSON.stringify(USER_SCRIPT_ENVELOPE_TAG)};const stringify=JSON.stringify.bind(JSON);const codeUnitAt=Function.call.bind(String.prototype.charCodeAt);const utf8Length=text=>{let bytes=0;for(let index=0;index<text.length;index+=1){const unit=codeUnitAt(text,index);if(unit<128)bytes+=1;else if(unit<2048)bytes+=2;else if(unit>=55296&&unit<=56319&&index+1<text.length){const next=codeUnitAt(text,index+1);if(next>=56320&&next<=57343){bytes+=4;index+=1;}else bytes+=3;}else bytes+=3;if(bytes>${WEB_AUTOMATION_JAVASCRIPT_OUTPUT_MAX_BYTES})return bytes;}return bytes;};const NativePromise=Promise;const resolvePromise=NativePromise.resolve.bind(NativePromise);const race=NativePromise.race.bind(NativePromise);const schedule=globalThis.setTimeout.bind(globalThis);const inputs=JSON.parse(${JSON.stringify(serializedInputs)});const timeout=new NativePromise(resolve=>schedule(()=>resolve({tag,kind:"timeout"}),${timeoutMs}));const execution=resolvePromise().then(async()=>{try{const value=await (async(inputs)=>{${source}\n})(inputs);let json;try{json=stringify(value);}catch{return {tag,kind:"invalid"};}if(json===undefined)return {tag,kind:"invalid"};if(utf8Length(json)>${WEB_AUTOMATION_JAVASCRIPT_OUTPUT_MAX_BYTES})return {tag,kind:"too_large"};return {tag,kind:"value",json};}catch{return {tag,kind:"failed"};}});return await race([execution,timeout]);})()`;
}

async function settleWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  return await Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

function userScriptEnvelope(value: unknown): UserScriptEnvelope | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { tag?: unknown; kind?: unknown; json?: unknown };
  if (candidate.tag !== USER_SCRIPT_ENVELOPE_TAG) return null;
  if (candidate.kind === "value") return typeof candidate.json === "string" ? { tag: USER_SCRIPT_ENVELOPE_TAG, kind: "value", json: candidate.json } : null;
  if (["timeout", "invalid", "too_large", "failed"].includes(candidate.kind as string)) {
    return { tag: USER_SCRIPT_ENVELOPE_TAG, kind: candidate.kind as "timeout" | "invalid" | "too_large" | "failed" };
  }
  return null;
}

function parseEnvelopeValue(serialized: string): { ok: true; value: JsonValue } | { ok: false; reason: string } {
  if (utf8Bytes(serialized) > WEB_AUTOMATION_JAVASCRIPT_OUTPUT_MAX_BYTES) {
    return { ok: false, reason: "JavaScript returned a value larger than the configured output limit." };
  }
  try {
    return { ok: true, value: JSON.parse(serialized) as JsonValue };
  } catch {
    return { ok: false, reason: "JavaScript must return a JSON value." };
  }
}

function validTimeout(value: number | undefined): boolean {
  return value === undefined || (Number.isInteger(value) && value > 0 && value <= WEB_AUTOMATION_JAVASCRIPT_TIMEOUT_MAX_MS);
}

function isJsonObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && isJsonValue(value, new Set(), 0);
}

function isJsonValue(value: unknown, seen: Set<unknown>, depth: number): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || depth > 64 || seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonValue(item, seen, depth + 1))
    : (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
      && Object.values(value as Record<string, unknown>).every((item) => isJsonValue(item, seen, depth + 1));
  seen.delete(value);
  return valid;
}

function jsonBytes(value: Record<string, JsonValue>): number {
  try {
    return utf8Bytes(JSON.stringify(value));
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function unavailable(action: BrowserActionCommand, startedAt: number): BrowserActionResult {
  return refused(action, startedAt, "JavaScript execution is unavailable. Enable Allow User Scripts in the browser extension settings and use a browser that supports one-shot user scripts.");
}

function refused(action: BrowserActionCommand, startedAt: number, message: string): BrowserActionResult {
  const expected = "the browser user-script API and permission to be available";
  return workerActionResult(action, startedAt, {
    status: "failed",
    message,
    validation: { status: "failed", expected, actual: "the JavaScript action was not executed" },
    failure: workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, { expected, actual: "the JavaScript action was not executed" })
  });
}

function timedOut(action: BrowserActionCommand, startedAt: number, timeoutMs: number): BrowserActionResult {
  const expected = `JavaScript to settle within ${timeoutMs} ms`;
  const actual = "the execution did not settle before the action deadline";
  return workerActionResult(action, startedAt, {
    status: "timed_out",
    message: "JavaScript execution reached its configured time limit.",
    validation: { status: "failed", expected, actual },
    failure: workerTimeoutFailure(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, expected, actual)
  });
}

function failed(action: BrowserActionCommand, startedAt: number, message: string): BrowserActionResult {
  const expected = "JavaScript to return a bounded JSON value";
  const actual = "the user-script execution did not produce an accepted result";
  return workerActionResult(action, startedAt, {
    status: "failed",
    message,
    validation: { status: "failed", expected, actual },
    failure: workerActionFailedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, expected, actual)
  });
}
