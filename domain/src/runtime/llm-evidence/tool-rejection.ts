// A tool call the runtime refuses on purpose, and the content-free result it
// returns instead. A rejection is not an error: the model asked for something
// policy does not allow, or asked badly, and telling it so lets it try
// something else. The reply carries a code and nothing else, so a refusal can
// never become a side channel for the page content the refusal was protecting.

export const WEB_LLM_TOOL_RESULT_SCHEMA_VERSION = "web-llm-tool-result.v1" as const;

/**
 * Every reason a tool call is refused. A runtime value rather than a bare
 * union, because the set has to be enumerable outside this package; the type
 * is derived from it, so the two cannot disagree.
 *
 * `cross_origin` and `out_of_scope` are two claims, not one. The first is this
 * domain's own fixed rule for the authoring tools -- never leave the page's
 * origin. The second is a refusal under the scope policy Core gave the
 * exploration, which may be an allowlist of several places and so cannot be
 * described as crossing an origin at all.
 *
 * `no_repeating_structure` is the structure-detection tool's answer when the
 * page has nothing there that repeats readably. It is a fact about the page
 * rather than a policy, but it is reported the same way, as a bare code, so the
 * answer can carry nothing from the page either.
 */
export const WEB_LLM_TOOL_REJECTION_CODES = [
  "invalid_input",
  "cross_origin",
  "out_of_scope",
  "no_progress",
  "target_unobserved",
  "sensitive_value",
  "no_repeating_structure"
] as const;

export type WebLlmToolRejectionCode = (typeof WEB_LLM_TOOL_REJECTION_CODES)[number];

export type WebLlmToolRejection = {
  schemaVersion: typeof WEB_LLM_TOOL_RESULT_SCHEMA_VERSION;
  ok: false;
  code: WebLlmToolRejectionCode;
};

export class RecoverableToolRejection extends Error {
  constructor(readonly code: WebLlmToolRejectionCode) {
    super(code);
  }
}

/** Refuse the call. Throws, so a caller cannot forget to stop. */
export function recoverable(code: WebLlmToolRejectionCode): never {
  throw new RecoverableToolRejection(code);
}

export function toolRejection(code: WebLlmToolRejectionCode): WebLlmToolRejection {
  return { schemaVersion: WEB_LLM_TOOL_RESULT_SCHEMA_VERSION, ok: false, code };
}
