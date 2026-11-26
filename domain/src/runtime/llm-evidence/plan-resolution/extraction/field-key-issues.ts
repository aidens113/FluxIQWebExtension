// The issues a read's column key that is not a legal record field key is refused with.
//
// A key names a column everywhere a record goes (`actions/extraction/field-key.ts`): one to
// 100 of `A-Z a-z 0-9 _ -`. Until t1058 a key with a space in it was refused `web.handle.malformed` at its
// position and nothing else, so a model could not tell a spelling from a shape fault. The issue is
// `{code: "web.handle.field_key_invalid", field, valid}`: the key as written, where Core's bounds let it be
// said (`./refusal-issues.ts`: a name with a space is dropped there), and the legal spelling of it to write
// instead. The refusal's shape hint (`WEB_EXTRACTION_FIELD_KEY_HINT`) says the key is one word of those
// characters.

import { webAutomationExtractFieldKeySpelling } from "../../../../actions/extraction";
import type { WebAutomationRecordOutputIssue } from "../../../../output-nodes";
import { present } from "../../present";
import { webPlanBoundedIssues, type WebPlanRefusalIssue } from "./refusal-issues";

/** The issue code for a column key that is not legal. */
export const WEB_EXTRACTION_FIELD_KEY_INVALID = "web.handle.field_key_invalid";

/** The issues for `written`, a column key that is not legal: the key and its legal spelling, each where it can be said. */
export function webPlanFieldKeyIssues(written: string): WebPlanRefusalIssue[] {
  const spelling = webAutomationExtractFieldKeySpelling(written);
  return webPlanBoundedIssues([present<WebAutomationRecordOutputIssue>({ code: WEB_EXTRACTION_FIELD_KEY_INVALID, field: written, valid: spelling === undefined ? undefined : [spelling] })]);
}
