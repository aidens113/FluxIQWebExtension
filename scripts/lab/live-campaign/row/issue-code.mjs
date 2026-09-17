const ISSUE_CODE = /^[a-z][a-z0-9_]*(?:[.:][a-z0-9_+-]+)+$/iu;

/**
 * Whether a value is a code a summary may keep: a short dotted identifier such
 * as `runtime_patch.target_override_rejected`, never free text, which could
 * carry page data.
 */
export function isIssueCode(code) {
  return typeof code === "string" && code.length <= 120 && ISSUE_CODE.test(code);
}
