import assert from "node:assert/strict";
import test from "node:test";
import { applyLiveRepair } from "../apply-repair.js";

/**
 * Core's promotion gates ask for evidence, and a named reviewer's approval is
 * one of the two things that satisfies them. So the Lab approves and then
 * applies, and what it records is the status Core left behind -- never the
 * sentence Core refuses with, which names the gates in prose.
 */

type Call = { endpoint: string; action?: string; adaptationId?: string };

function core(options: { statuses?: Record<string, string[]>; refuse?: (call: Call) => boolean } = {}) {
  const calls: Call[] = [];
  const cursors = new Map<string, number>();
  return {
    calls,
    control: {
      automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => {
        const adaptationId = String(payload.adaptationId);
        const call: Call = { endpoint, adaptationId, ...(payload.action ? { action: String(payload.action) } : {}) };
        calls.push(call);
        if (options.refuse?.(call)) throw new Error("Adaptation cannot be applied: no succeeded trial and no reviewer approval");
        if (endpoint === "get-flow-adaptation") {
          const line = options.statuses?.[adaptationId] ?? ["proposed", "applied"];
          const at = cursors.get(adaptationId) ?? 0;
          cursors.set(adaptationId, at + 1);
          return { adaptation: { adaptationId, status: line[Math.min(at, line.length - 1)] } };
        }
        return { adaptation: { adaptationId } };
      },
    },
  };
}

test("a saved adaptation is approved, then applied, and the statuses either side are recorded", async () => {
  const fake = core();
  const application = await applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1"] });
  assert.equal(application.outcome, "applied");
  assert.deepEqual(application.adaptations, [{ adaptationId: "adaptation-1", statusBefore: "proposed", approved: true, applyAccepted: true, statusAfter: "applied", alreadyApplied: false, refusedBy: null }]);
  assert.deepEqual(fake.calls.map((call) => `${call.endpoint}${call.action ? `:${call.action}` : ""}`), [
    "get-flow-adaptation", "review-flow-adaptation:approve", "review-flow-adaptation:apply", "get-flow-adaptation",
  ]);
});

test("a run that saved no adaptation applies nothing, and that is not a failure", async () => {
  const fake = core();
  const application = await applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: [] });
  assert.equal(application.outcome, "no_proposal");
  assert.deepEqual(application.adaptations, []);
  assert.deepEqual(fake.calls, [], "a refusal task must not cost a Core call");
});

test("an adaptation Core already applied is left alone and still counts as applied", async () => {
  const fake = core({ statuses: { "adaptation-1": ["applied"] } });
  const application = await applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1"] });
  assert.equal(application.outcome, "applied");
  assert.equal(application.adaptations[0]?.alreadyApplied, true);
  assert.equal(application.adaptations[0]?.approved, false);
  assert.deepEqual(fake.calls.map((call) => call.endpoint), ["get-flow-adaptation"], "an executed patch is not reviewed again");
});

test("a refused review is reported by category, not swallowed, and the rest are still attempted", async () => {
  const fake = core({
    statuses: { "adaptation-1": ["proposed"], "adaptation-2": ["proposed", "applied"] },
    refuse: (call) => call.adaptationId === "adaptation-1" && call.action === "apply",
  });
  const application = await applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1", "adaptation-2"] });
  assert.equal(application.outcome, "not_applied");
  assert.equal(application.adaptations[0]?.approved, true);
  assert.equal(application.adaptations[0]?.applyAccepted, false);
  assert.equal(application.adaptations[0]?.statusAfter, "proposed");
  assert.ok(application.adaptations[0]?.refusedBy, "a refused apply left no record of the failure");
  assert.equal(application.adaptations[1]?.statusAfter, "applied", "the second adaptation was not attempted");
  assert.equal(JSON.stringify(application).includes("no succeeded trial"), false, "the record carries Core's refusal sentence");
});

test("a status read that fails is not caught: a lane that cannot see what it did reports nothing applied", async () => {
  const control = { automationStudioCall: async () => { throw new Error("run detail unavailable"); } };
  await assert.rejects(applyLiveRepair(control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation-1"] }), /run detail unavailable/u);
});

test("an adaptation id that is not an identifier is refused before it is reviewed", async () => {
  const fake = core();
  await assert.rejects(
    applyLiveRepair(fake.control, { projectId: "project-1", flowId: "flow-1", adaptationIds: ["adaptation 1; drop"] }),
    /Core named an adaptation whose id is not an identifier/u,
  );
  assert.deepEqual(fake.calls, []);
});
