// The issues a refusal carries beside its codes, held to Core's bounds.
//
// Core reads `issues: [{code, field?, valid?}]` on a refused answer
// (`runtime/llm/harness-options/plan-parameter-resolution.ts`) and tells the
// model each in its own sentence, naming the field and the names it can use
// (t489). It drops an answer that breaks its bounds, so every producer here --
// the record output's columns (`./stored-columns.ts`) and a condition's column
// (`./conditions.ts`, t497) -- passes its issues through this one function.

import type { WebAutomationRecordOutputIssue } from "../../../../output-nodes";

/** One issue a refusal carries beside its codes, in the shape Core reads on a refused answer (header). */
export type WebPlanRefusalIssue = { code: string; field?: string; valid?: string[] };

/** Core's bounds on a refusal's codes and issues (`plan-parameter-resolution.ts`). */
export const WEB_PLAN_ISSUE_CODE = /^[a-z0-9_.:-]{1,100}$/iu;
const ISSUE_NAME = /^[A-Za-z0-9_.:-]{1,200}$/u;
const MAX_ISSUES = 16;
const MAX_ISSUE_NAMES = 64;

/** The issues as Core keeps them (header): at most sixteen, each code in its alphabet, each name an identifier, at most 64 names. */
export function webPlanBoundedIssues(issues: readonly WebAutomationRecordOutputIssue[]): WebPlanRefusalIssue[] {
  return issues.filter((issue) => WEB_PLAN_ISSUE_CODE.test(issue.code)).slice(0, MAX_ISSUES).map((issue) => {
    const kept: WebPlanRefusalIssue = { code: issue.code };
    if (issue.field !== undefined && ISSUE_NAME.test(issue.field)) kept.field = issue.field;
    const valid = [...new Set(issue.valid ?? [])].filter((name) => ISSUE_NAME.test(name)).slice(0, MAX_ISSUE_NAMES);
    if (valid.length > 0) kept.valid = valid;
    return kept;
  });
}
