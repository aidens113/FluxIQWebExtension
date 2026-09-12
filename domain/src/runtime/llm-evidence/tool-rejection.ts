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
 */
export const WEB_LLM_TOOL_REJECTION_CODES = [
  "invalid_input",
  "cross_origin",
  "no_progress",
  "target_unobserved",
  "target_unsafe",
  "sensitive_value"
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
