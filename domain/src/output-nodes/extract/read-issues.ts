// Why an `extract` value on the single-value read would be refused, said before
// the Flow runs (t675).
//
// The dispatch reader (`webAutomationExtractReadValue`) answers with a read or
// with nothing, and nothing means the page falls back to the legacy
// `options.mode` and reads the element's text (a field's value). So `{"mode": "href"}`, an
// attribute read naming no attribute, or `{"mode": "text", "attribute": "href"}`
// ran, read something other than what was asked, and a builder learned it only
// from a run whose value was wrong (open since Core t646). This names the part
// that is wrong while the plan is validated, and Core's refusal carries the
// parameter's grammar and example beside the code (`plan/issue-feedback.ts`,
// `accepted`), which is the text that says what is allowed.
//
// **The reader stays the judge.** Every rule it applies has a code here, and a
// value it refuses that no code explains is `web.extract.unreadable`, so a value
// accepted here is one the dispatch reads as written.
//
// **Stricter than the reader in two ways, on purpose:** a key other than `mode`
// and `attribute` is refused, where the reader ignores it, since a misspelt
// `attr` would otherwise read the text and report success; and an attribute
// name of only spaces is refused, where the reader passes it on to read nothing.
// The keys are a total record over `WebAutomationExtractRead`, so a key added
// there does not compile until it is allowed here.
//
// **A state binding:** `mode` chooses what the read does, so a bound one is
// refused; `attribute` may be bound when the mode is `attribute`, since Core
// resolves it before the dispatch reads it.

import { isAutomationNodeParameterStateBinding as isBinding } from "fluxiq/automation-studio/nodes";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_EXTRACT_READ_MODES, webAutomationExtractReadValue, type WebAutomationExtractRead } from "../../actions/extraction";

export type WebAutomationExtractReadIssueCode =
  | "web.extract.not_object"
  | "web.extract.unknown_key"
  | "web.extract.missing_mode"
  | "web.extract.unknown_mode"
  | "web.extract.missing_attribute"
  | "web.extract.attribute_without_attribute_mode"
  | "web.extract.unreadable";

const READ_KEYS: Readonly<Record<keyof WebAutomationExtractRead, true>> = { mode: true, attribute: true };

export function webAutomationExtractReadIssues(value: JsonValue): WebAutomationExtractReadIssueCode[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return ["web.extract.not_object"];
  const read = value as JsonObject;
  const issues = new Set<WebAutomationExtractReadIssueCode>();
  if (Object.keys(read).some((key) => !Object.hasOwn(READ_KEYS, key))) issues.add("web.extract.unknown_key");
  const mode = read.mode;
  if (mode === undefined) issues.add("web.extract.missing_mode");
  else if (typeof mode !== "string" || !(WEB_AUTOMATION_EXTRACT_READ_MODES as readonly string[]).includes(mode)) issues.add("web.extract.unknown_mode");
  if (mode === "attribute" && !isBinding(read.attribute) && !(typeof read.attribute === "string" && read.attribute.trim() !== "")) issues.add("web.extract.missing_attribute");
  if (typeof mode === "string" && mode !== "attribute" && read.attribute !== undefined) issues.add("web.extract.attribute_without_attribute_mode");
  if (issues.size === 0 && !isBinding(read.attribute) && webAutomationExtractReadValue(read) === undefined) issues.add("web.extract.unreadable");
  return [...issues];
}
