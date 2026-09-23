// The keys this domain never lets out, declared once.
//
// Core enforces the declaration on everything a decision is shown
// (`AS/runtime/llm/harness/evidence-screen.ts`), and refuses the whole request
// rather than trimming it: one denied key anywhere in the gathered evidence and
// no provider is called at all. So anything this domain builds out of a page's
// own payload has to be held to the same list *before* it is returned, and to
// the same spelling rule -- Core compares keys with `_` and `-` removed and
// lowercased, so `page_source` and `Page-Source` are the same key as
// `pageSource`.
//
// It lives in its own module because two places need it and a second copy is
// how they would come to disagree: `tools.ts` declares it to Core, and
// `node-run/read-result.ts` applies it to what a reading node read.

/**
 * The keys Core refuses in evidence from this domain.
 *
 * `snapshot` is deliberately absent: that is Core's own word and its own
 * state-snapshot option produces one -- the nested `html` is what is refused.
 * `selector` is present because it is this domain's word for a target, and
 * after the repair target became opaque it is ours to deny.
 */
export const WEB_LLM_DENIED_EVIDENCE_KEYS: readonly string[] = Object.freeze([
  "html",
  "innerHtml",
  "outerHtml",
  "pageSource",
  "cookies",
  "headers",
  "selector"
]);

/** Core's own spelling rule for comparing a key against the declaration. */
export function webLlmEvidenceKey(key: string): string {
  return key.replace(/[_-]/gu, "").toLowerCase();
}

const DENIED = new Set(WEB_LLM_DENIED_EVIDENCE_KEYS.map(webLlmEvidenceKey));

/** Whether a key is one Core would refuse the whole request for. */
export function webLlmEvidenceKeyIsDenied(key: string): boolean {
  return DENIED.has(webLlmEvidenceKey(key));
}

/**
 * A value with every key the declaration denies removed, at any depth.
 *
 * What the model is shown of its own call goes through this. A call may name a
 * locator the model wrote itself, and the record of that call is shown back to
 * it in the draft -- so without this, one refused call puts a denied key in the
 * evidence and Core refuses the whole next decision request rather than sending
 * it, which is what happened live (`run-mud9yc6f-0bd9fc87`).
 */
export function withoutWebLlmDeniedKeys<T>(value: T, depth = 0): T {
  if (depth > 8 || !value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => withoutWebLlmDeniedKeys(item, depth + 1)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (webLlmEvidenceKeyIsDenied(key)) continue;
    out[key] = withoutWebLlmDeniedKeys(item, depth + 1);
  }
  return out as unknown as T;
}
