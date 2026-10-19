// What is wrong with a scroll request the dispatch would not read, key by key
// (social r4, `run-mvfq957o-40103539`).
//
// The dispatch reader (`client/gateway-action-parameters.ts`
// `scrollRequestValue`) answers with a request or with nothing, and nothing
// is refused at run time by the scroll verb. Its schema
// (`actions/schemas.ts`) checks the mode, the keys and their types at submit,
// but `untilStable` requiring `maxScrolls` is conditional, and Core's schema
// reader does not read a conditional keyword, so `{"mode": "untilStable"}`
// passed submit and was refused by the trial with only the keys it carried.
// This names each key that makes the request unreadable, so the scroll node's
// parameter contract (`output-nodes/scroll/`) refuses it at submit and the
// verb's run-time refusal says which key is missing or wrong.
//
// Every request the reader refuses has at least one issue here, and a request
// with none is one it reads. Each `key` is the key as written, which may not be
// an identifier: a caller that quotes it filters it first.

/** Every key a scroll request has, total over `WebAutomationScrollRequest`, so a key added there does not compile until it is listed here. */
type ScrollRequestKey = "mode" | "x" | "y" | "maxScrolls";
const SCROLL_REQUEST_KEYS: Readonly<Record<ScrollRequestKey, true>> = { mode: true, x: true, y: true, maxScrolls: true };
const SCROLL_MODES: readonly string[] = ["by", "toElement", "untilStable"];

/** One reason the request is unreadable: a required key not written, a key whose value cannot be read, or a key the request does not have. */
export type WebAutomationScrollRequestIssue = { key: string; problem: "missing" | "invalid" | "unknown" };

/**
 * Each key that makes `value` a scroll request the dispatch would not read
 * (header). `scroll` itself is `invalid` when the value is not an object.
 */
export function webAutomationScrollRequestIssues(value: unknown): WebAutomationScrollRequestIssue[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [{ key: "scroll", problem: "invalid" }];
  const request = value as Record<string, unknown>;
  const issues: WebAutomationScrollRequestIssue[] = [];
  if (request.mode === undefined) issues.push({ key: "mode", problem: "missing" });
  else if (typeof request.mode !== "string" || !SCROLL_MODES.includes(request.mode)) issues.push({ key: "mode", problem: "invalid" });
  for (const key of Object.keys(request)) if (!Object.hasOwn(SCROLL_REQUEST_KEYS, key)) issues.push({ key, problem: "unknown" });
  if (request.mode === "untilStable") {
    const maxScrolls = request.maxScrolls;
    if (maxScrolls === undefined) issues.push({ key: "maxScrolls", problem: "missing" });
    else if (typeof maxScrolls !== "number" || !Number.isSafeInteger(maxScrolls) || maxScrolls <= 0) issues.push({ key: "maxScrolls", problem: "invalid" });
  }
  return issues;
}
