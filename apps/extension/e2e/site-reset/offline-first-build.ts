import type { JsonObject } from "fluxiq/core";
import { expect } from "../fixtures/extension-context";
import type { ScriptedVerification } from "./scripted-provider";
import type { LoggedStep } from "./step-log";

// What the offline-first acceptance specs share (trace plan P6, t769 B14):
// a two-subflow plan, a scripted judge that answers by what is under test, and
// the proof read from Core's step log. Why two subflows: on a plan of one, the
// builder's test is the plan's judged whole run, which a project build never
// checks offline (P6 D40), so the repaired subflow must be the second of two.

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/** One judge call: what was under test then, and what it answered. */
export type OfflineFirstJudged = { label: string; answersRequest: "yes" | "no" };

/** One subflow of the two-part plan: its key and name, the instruction's words it quotes, and its goal fact. */
export type OfflineFirstSubflow = { key: string; name: string; quote: string; goal: string };

/**
 * The supervisor's `project.write_plan` input for two subflows, the second
 * running after the first: parts `p1` and `p2`, each quoting its own words of
 * the instruction, with no lasting act. `plan` is the scripted provider's
 * default one-part plan, whose quote names the instruction's source.
 */
export function twoPartPlan(plan: JsonObject, subflows: readonly [OfflineFirstSubflow, OfflineFirstSubflow]): JsonObject {
  const spec = record(plan.taskSpec);
  const base = record((spec.parts as unknown[] | undefined)?.[0]);
  const sourceId = String(record(base.quote).sourceId ?? "");
  const parts: JsonObject[] = subflows.map((subflow, index) => ({ id: `p${index + 1}`, quote: { sourceId, text: subflow.quote }, goalFacts: [subflow.goal], lastingActs: [] }));
  return {
    taskSpec: { ...spec, parts },
    subflows: [
      { key: subflows[0].key, name: subflows[0].name, parts: ["p1"] },
      { key: subflows[1].key, name: subflows[1].name, parts: ["p2"], after: [subflows[0].key] }
    ]
  };
}

/** A scripted no: its words, and the defects it rests on (`diagnosis.defects`), each of which Core looks for in its own record. */
export type OfflineFirstNo = { expected: string; observed: string; changed: string; defects: JsonObject[] };

/**
 * The scripted judge: `no(label, shown)` for what is under test now
 * (`testing()`), or a yes when it answers nothing, every call kept in
 * `judged` and the first text each label was shown in `shownBy` (for the
 * spec's diagnostic file only). A no lists its defects as Core requires of a
 * current no (Core `llm/harness/provider-result.ts`), and a no none of whose
 * defects Core finds in its record settles unsure, never no
 * (`result-verification/agreement/unsupported-no.ts`). A yes's words may be
 * read from what the judge was shown, for a yes Core holds to name what a
 * condition left out.
 */
export function offlineFirstVerify(testing: () => string, judged: OfflineFirstJudged[], words: { yes: string | ((shown: string) => string); no: (label: string, shown: string) => OfflineFirstNo | undefined }, shownBy: Record<string, string> = {}): (shown: string) => ScriptedVerification {
  return shown => {
    const label = testing();
    shownBy[label] ??= shown;
    const no = words.no(label, shown);
    if (no) {
      judged.push({ label, answersRequest: "no" });
      return { summary: no.observed, diagnosis: { answersRequest: "no", expected: no.expected, observed: no.observed, changed: no.changed, defects: no.defects } };
    }
    judged.push({ label, answersRequest: "yes" });
    const said = typeof words.yes === "string" ? words.yes : words.yes(shown);
    return { summary: said, diagnosis: { answersRequest: "yes", observed: said } };
  };
}

/** A command that only captures the page as it stands (the view a test answer carries), never one of a Flow's steps. */
const PAGE_CAPTURE = /capture_snapshot$/u;

const DECIDED: ReadonlySet<unknown> = new Set(["kept_no", "kept_failed", "passed", "gap", "inconclusive"]);

/** The step log read as test windows: each test call's tool folder and the non-tool folders up to the next test call. */
export function offlineFirstProof(steps: LoggedStep[]) {
  const isTest = (step: LoggedStep) => step.kind === "tool-core.test_subflow" || step.kind === "tool-core.test_candidate";
  const testSteps = steps.filter(isTest);
  const windows = testSteps.map((start, index) => {
    const end = testSteps[index + 1]?.number ?? Number.POSITIVE_INFINITY;
    const inside = steps.filter(step => step.number > start.number && step.number < end && (step.kind === "offline" || step.kind === "reset"));
    return { test: start, kinds: inside.map(step => step.kind === "offline" ? `offline:${String(step.meta.outcome)}` : "reset") };
  });
  /** Each folder's name, with an offline check's outcome and a reset's stage and outcome. */
  const listing = steps.map(step => `${step.name}${step.kind === "offline" ? ` outcome=${String(step.meta.outcome)}` : step.kind === "reset" ? ` ${String(step.meta.stage)}:${String(step.meta.outcome)}` : ""}`);
  const offline = steps.filter(step => step.kind === "offline");
  /** A test answer by its verdict, code and offline fields only. */
  const testShape = (answer: JsonObject | undefined) => ({
    verdict: answer?.verdict ?? null, code: answer?.code ?? null, checkedAgainst: answer?.checkedAgainst ?? null,
    offlineCheck: answer?.offlineCheck === undefined ? null : record(answer.offlineCheck).outcome ?? Object.keys(record(answer.offlineCheck)),
    trialRunId: typeof answer?.trialRunId === "string"
  });
  /** The judge calls, consecutive calls about the same thing with the same answer counted together. */
  const judgedRuns = (judged: readonly OfflineFirstJudged[]) => judged.reduce<Array<OfflineFirstJudged & { calls: number }>>((runs, call) => {
    const last = runs.at(-1);
    if (last && last.label === call.label && last.answersRequest === call.answersRequest) last.calls++;
    else runs.push({ ...call, calls: 1 });
    return runs;
  }, []);

  /**
   * The acceptance (see the specs' headers): the first subflow tested live
   * once; the repaired subflow's three tests -- live no, kept no on the
   * recording, offline pass then live yes; the whole test live after a reset;
   * resets only before live trials; the build completed after the live yeses.
   */
  const assertAcceptance = (input: { ending: string; failure: JsonObject; resolved: JsonObject | undefined; open: JsonObject | undefined; tests: Array<JsonObject | undefined>; judged: readonly OfflineFirstJudged[]; completions: Array<{ brief: string; after: string }>; subflow: string; siteActs: Array<string[] | undefined> }) => {
    const { tests, judged } = input;
    // Five test calls: the first subflow's, the repaired subflow's three, and the whole test.
    expect(windows.map(window => window.test.kind)).toEqual(["tool-core.test_subflow", "tool-core.test_subflow", "tool-core.test_subflow", "tool-core.test_subflow", "tool-core.test_candidate"]);
    const [open, first, second, third, whole] = windows;
    const decidedIn = (window: (typeof windows)[number]) => window.kinds.filter(kind => DECIDED.has(kind.slice("offline:".length)) && kind.startsWith("offline:"));
    // The offline checks the build decided on, in order: revision 2's no kept, then revision 3's pass.
    expect(offline.map(step => step.meta.outcome).filter(outcome => DECIDED.has(outcome))).toEqual(["kept_no", "passed"]);
    // The first subflow: live (no recording of it yet), a yes.
    expect(decidedIn(open!)).toEqual([]);
    expect(input.open?.verdict).toBe("yes");
    // Revision 1: live, after a reset, a no; nothing checked offline (no recording of this subflow yet).
    expect(first!.kinds).toContain("reset");
    expect(decidedIn(first!)).toEqual([]);
    expect(tests[0]?.verdict).toBe("no");
    expect(tests[0]?.checkedAgainst).toBeUndefined();
    // Revision 2: checked against revision 1's recording, its no kept; no reset, nothing done on the site.
    expect(second!.kinds).toEqual(["offline:kept_no"]);
    expect(tests[1]?.verdict).toBe("no");
    expect(tests[1]?.checkedAgainst).toBe("recorded_run");
    expect(record(second!.test.result).checkedAgainst).toBe("recorded_run");
    // Commands that reached the site during each of the three tests: the live ones ran their steps there; the kept one sent
    // nothing but a capture of the page as it stands (`pageAfterTrial`), no act and no read of its steps.
    const acting = (sent: string[] | undefined) => (sent ?? []).filter(type => !PAGE_CAPTURE.test(type));
    expect(acting(input.siteActs[0]).length).toBeGreaterThan(0);
    expect(input.siteActs[1]).toBeDefined();
    expect(acting(input.siteActs[1])).toEqual([]);
    expect(acting(input.siteActs[2]).length).toBeGreaterThan(0);
    // Revision 3: an offline pass, then the reset, then the live trial, a yes, carrying the offline check.
    expect(third!.kinds.indexOf("offline:passed")).toBeGreaterThanOrEqual(0);
    expect(third!.kinds.indexOf("offline:passed")).toBeLessThan(third!.kinds.indexOf("reset"));
    expect(tests[2]?.verdict).toBe("yes");
    expect(typeof tests[2]?.trialRunId).toBe("string");
    expect(tests[2]?.checkedAgainst).toBeUndefined();
    expect(record(tests[2]?.offlineCheck)).not.toEqual({});
    expect(record(third!.test.result).offlineCheck).toBeTruthy();
    // The final judged run: the whole test, live after a reset. It is offline-first too (D48), but this build has no
    // earlier live whole test to check it against, so nothing ran offline and the live run is the judged one.
    expect(whole!.kinds).toContain("reset");
    expect(whole!.kinds.filter(kind => kind.startsWith("offline:"))).toEqual(["offline:refused:no_live_source"]);
    // The judge: each thing under test in order; revision 3 judged on the recording and again on the site.
    const runs = judgedRuns(judged);
    expect(runs.map(run => `${run.label}:${run.answersRequest}`)).toEqual(["open:yes", `${input.subflow}-1:no`, `${input.subflow}-2:no`, `${input.subflow}-3:yes`, "whole:yes"]);
    const calls = (label: string) => judged.filter(call => call.label === label).length;
    expect(calls(`${input.subflow}-3`)).toBeGreaterThan(calls(`${input.subflow}-2`));
    // The build completed only after the live yeses: the subflow's builder after revision 3's test, the supervisor after the whole test's yes.
    expect(input.completions).toEqual([{ brief: "open", after: "open.test" }, { brief: input.subflow, after: "test-3" }, { brief: "supervisor", after: "yes" }]);
    expect(input.ending).toBe("proposed");
    expect(input.failure).toEqual({});
  };
  return { steps, windows, listing, testShape, judgedRuns, assertAcceptance };
}
