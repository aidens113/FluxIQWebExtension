import assert from "node:assert/strict";
import test from "node:test";
import type { ActionabilityReport, ActionResultEvidence } from "../../../../action-runtime";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../types";
import { checkAction } from "../../../check";
import type { ContentActionDependencies } from "../../../types";

const ACTION = { commandId: "check", actionType: "web.dom.check", checked: true } as BrowserActionCommand;
const READY: ActionabilityReport = { actionable: true, point: { x: 10, y: 20 }, detail: "local point" };

function setup(reports: ActionabilityReport[], outcome: Awaited<ReturnType<ContentActionDependencies["setCheckedState"]>>, label?: Element) {
  const element = {
    getAttribute: () => "input",
    getRootNode: () => ({ querySelector: () => label ?? null }),
    closest: () => null
  } as unknown as Element;
  const measured: Element[] = [];
  let set = 0;
  let evidence: ActionResultEvidence | undefined;
  const result = (status: "succeeded" | "failed", observed: ActionResultEvidence | undefined): BrowserActionResult => {
    evidence = observed;
    return { commandId: ACTION.commandId, actionType: ACTION.actionType, status, startedAt: 0, finishedAt: 1, ...(observed?.actionability ? { actionability: observed.actionability } : {}) } as BrowserActionResult;
  };
  const deps = {
    resolveTarget: () => ({ element, resolution: {} }),
    checkActionability: (target: Element) => {
      measured.push(target);
      return reports[measured.length - 1]!;
    },
    setCheckedState: async () => {
      set += 1;
      return outcome;
    },
    describeElement: () => ({}),
    captureSnapshot: () => ({}),
    rejected: (_action: unknown, _time: unknown, _code: unknown, _expected: unknown, _actual: unknown, observed: ActionResultEvidence) => result("failed", observed),
    success: (_action: unknown, _time: unknown, _message: unknown, _validation: unknown, observed: ActionResultEvidence) => result("succeeded", observed)
  } as unknown as ContentActionDependencies;
  return { deps, element, measured, set: () => set, evidence: () => evidence };
}

test("check reports each real gate refusal before setting state", async () => {
  for (const code of ["hidden", "disabled", "covered"] as const) {
    const page = setup([{ actionable: false, code, detail: "local" }], { ok: true, kind: "checkbox", checked: true, changed: true });
    const result = await checkAction(ACTION, page.deps, 0);
    assert.deepEqual(result.actionability, { actionable: false, cause: code });
    assert.equal(page.evidence()?.refusedBeforeDispatch, true);
    assert.equal(page.set(), 0);
  }
});

test("a hidden input uses its associated label's actual measurement", async () => {
  const label = {} as Element;
  for (const report of [READY, { actionable: false, code: "covered", detail: "label covered" } as const]) {
    const page = setup([{ actionable: false, code: "hidden", detail: "input hidden" }, report], { ok: true, kind: "checkbox", checked: true, changed: true }, label);
    const result = await checkAction(ACTION, page.deps, 0);
    assert.deepEqual(page.measured, [page.element, label]);
    assert.deepEqual(result.actionability, report.actionable ? { actionable: true } : { actionable: false, cause: "covered" });
    assert.equal(page.set(), report.actionable ? 1 : 0);
  }
});

test("the setter's actual disabled measurement replaces the positive gate without changing effect flags", async () => {
  const page = setup([READY], { ok: false, code: "disabled", reason: "actual control disabled" });
  const result = await checkAction(ACTION, page.deps, 0);
  assert.deepEqual(result.actionability, { actionable: false, cause: "disabled" });
  assert.equal(page.evidence()?.refusedBeforeDispatch, undefined);
  assert.equal(result.failure?.effect, undefined);
  assert.equal(page.set(), 1);
});

test("an already checked control retains the gate it actually measured", async () => {
  const page = setup([READY], { ok: true, kind: "checkbox", checked: true, changed: false });
  assert.deepEqual((await checkAction(ACTION, page.deps, 0)).actionability, { actionable: true });
});
