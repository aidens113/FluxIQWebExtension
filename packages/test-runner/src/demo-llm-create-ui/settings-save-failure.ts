// What a rejected Flow Settings save is allowed to keep. A save is refused for
// a handful of stable reasons and the response text is untrusted, so the
// reason is classified into a fixed code and the only number carried out of an
// optimistic-revision conflict is the bounded distance between the two.

import type { Response } from "@playwright/test";

export type SanitizedSettingsSaveFailure = Readonly<{
  status: number;
  code: string;
  responseBytes: number;
  parsed: boolean;
  revisionBothParsed: boolean;
  revisionRelation: "expected_lt" | "expected_eq" | "expected_gt" | "unknown";
  revisionAbsoluteDelta: number | null;
}>;

const MAX_REPORTED_REVISION_DELTA = 1_000_000;

export async function readSanitizedSettingsSaveFailure(response: Pick<Response, "status" | "headers" | "text">): Promise<SanitizedSettingsSaveFailure> {
  const status = response.status();
  let body = "";
  try { body = await response.text(); } catch { /* response remains classified by status */ }
  const responseBytes = Math.min(Buffer.byteLength(body, "utf8"), 1_000_000);
  if (!body || responseBytes > 4096) return sanitizedSettingsFailure(status, settingsFailureCode(status), responseBytes, false);
  let error = "";
  try {
    const parsed = JSON.parse(body) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof (parsed as Record<string, unknown>).error === "string") {
      error = ((parsed as Record<string, unknown>).error as string).slice(0, 512).toLowerCase();
    }
  } catch { return sanitizedSettingsFailure(status, settingsFailureCode(status), responseBytes, false); }
  return sanitizedSettingsFailure(status, settingsFailureCode(status, error), responseBytes, true, error);
}

function sanitizedSettingsFailure(status: number, code: string, responseBytes: number, parsed: boolean, error = ""): SanitizedSettingsSaveFailure {
  const revisions = parseOptimisticRevisionConflict(error);
  return Object.freeze({ status, code, responseBytes, parsed, ...revisions });
}

function parseOptimisticRevisionConflict(error: string): Pick<SanitizedSettingsSaveFailure, "revisionBothParsed" | "revisionRelation" | "revisionAbsoluteDelta"> {
  const match = /\bflow_save_conflict\b[^\r\n]{0,256}?\bexpected\s+(\d{1,40})\s*,\s*current\s+(\d{1,40})\b/iu.exec(error);
  if (!match?.[1] || !match[2]) return { revisionBothParsed: false, revisionRelation: "unknown", revisionAbsoluteDelta: null };
  try {
    const expected = BigInt(match[1]);
    const current = BigInt(match[2]);
    const relation = expected < current ? "expected_lt" : expected > current ? "expected_gt" : "expected_eq";
    const delta = expected > current ? expected - current : current - expected;
    return {
      revisionBothParsed: true,
      revisionRelation: relation,
      revisionAbsoluteDelta: delta > BigInt(MAX_REPORTED_REVISION_DELTA) ? MAX_REPORTED_REVISION_DELTA : Number(delta),
    };
  } catch {
    return { revisionBothParsed: false, revisionRelation: "unknown", revisionAbsoluteDelta: null };
  }
}

function settingsFailureCode(status: number, error = ""): string {
  if (/pin|authoriz|forbidden|permission/iu.test(error)) return "settings-save.authorization";
  if (/flow_save_conflict|conflict|changed elsewhere/iu.test(error)) return "settings-save.conflict";
  if (/input and output limits|total-token/iu.test(error)) return "settings-save.token-total";
  if (/llm|deepseek|provider retr|estimated-cost|exactly one llm call/iu.test(error)) return "settings-save.llm-policy";
  if (/flow settings are required|flow.+not found/iu.test(error)) return "settings-save.flow";
  return Number.isInteger(status) && status >= 100 && status <= 599 ? `settings-save.http-${status}` : "settings-save.http-unknown";
}
