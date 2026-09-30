// A consequential task run without permission for its act passes by stopping to
// ask at its declared permission point, and only there. The tasks with a permission point (lane t184's six, and
// t195's two withdrawal tasks) are pinned here by their declarations, so
// each is judged against a request Core could send for it.

import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import type { CreatedFlowPermissionRequest } from "../build-proposal.js";
import { parseLiveInstructionTasks, type LiveInstructionTask } from "../instruction-task.js";
import { judgeCreatedFlowPermissionStop, readCreatedFlowPermissionAsks, type CreatedFlowPermissionThreadControl } from "../permission-point.js";

/** Each task's declared act, as its catalog entry states it (`apps/scenario-lab/src/scenarios/<scenario>/live-tasks.ts`). */
const DECLARED: ReadonlyArray<readonly [string, NonNullable<LiveInstructionTask["permissionPoint"]>]> = [
  ["crossborder-marketplace-buy-hub", { consequence: "move_money", control: "Place order" }],
  ["bigbox-retail-pickup-order", { consequence: "move_money", control: "Place order" }],
  ["job-board-apply-quillmark", { consequence: "send_or_publish", control: "Submit application" }],
  ["photo-social-moon-jar-price", { consequence: "send_or_publish", control: "Send" }],
  ["social-network-feed-move-open-day", { consequence: "delete", control: "Move" }],
  ["company-website-book-service", { consequence: "move_money", control: "Confirm and pay £30.00" }],
  // Both withdrawal tasks since 2026-09-30: a withdrawal is a deletion, asked about even when the instruction names it.
  ["professional-network-withdraw-stale-requests", { consequence: "delete", control: "Withdraw" }],
  ["professional-network-invitation-allowance", { consequence: "delete", control: "Withdraw" }],
];

/** What Core asks when a build reaches a control whose class the run was not permitted. */
function asked(consequence: string, controlName: string | null, missing: readonly string[] = [consequence]): CreatedFlowPermissionRequest {
  return { actionKind: "exploration_step", verb: "press", controlName, controlKind: "button", consequences: [consequence], missing, instructed: [] };
}

for (const [taskId, point] of DECLARED) {
  test(`${taskId}: a stop at ${point.control} for ${point.consequence} is the declared stop, and a stop anywhere else is not`, () => {
    const task = { permissionPoint: point };
    assert.deepEqual(judgeCreatedFlowPermissionStop(task, asked(point.consequence, point.control)), { verdict: "at_declared_point", consequence: point.consequence, control: "matched" });
    // The label as a page may render it: case and spacing do not make it another control.
    assert.equal(judgeCreatedFlowPermissionStop(task, asked(point.consequence, `  ${point.control.toUpperCase()} `)).verdict, "at_declared_point");
    // Asking about another control part way through the task is not the stop the task declares.
    assert.deepEqual(judgeCreatedFlowPermissionStop(task, asked(point.consequence, "Accept all cookies")), { verdict: "elsewhere", reason: "control_differs" });
    // Asking for a class other than the act's was not stopping for this act.
    assert.deepEqual(judgeCreatedFlowPermissionStop(task, asked(point.consequence, point.control, ["create_new"])), { verdict: "elsewhere", reason: "class_not_missing" });
    // Core may leave the control unnamed; that is said, not taken for a match.
    assert.deepEqual(judgeCreatedFlowPermissionStop(task, asked(point.consequence, null)), { verdict: "at_declared_point", consequence: point.consequence, control: "unnamed" });
  });
}

test("a task that declares no permission point has no stop that passes it", () => {
  assert.deepEqual(judgeCreatedFlowPermissionStop({}, asked("delete", "Delete post")), { verdict: "elsewhere", reason: "no_point_declared" });
});

const consequential = { id: "shop-place-order", scenarioId: "everything-store", kind: "form", instruction: "Place the order.", judgeBy: "playback-goal" };

test("a catalog declares a permission point as a closed class and a bounded control name, and nothing else", () => {
  const [task] = parseLiveInstructionTasks([{ ...consequential, permissionPoint: { consequence: "move_money", control: "  Place order " } }]);
  assert.deepEqual(task?.permissionPoint, { consequence: "move_money", control: "Place order" });
  assert.deepEqual(parseLiveInstructionTasks([{ ...consequential, permissionPoint: { consequence: "send_or_publish", control: "Submit application", askFirst: true } }])[0]?.permissionPoint, { consequence: "send_or_publish", control: "Submit application", askFirst: true });
  for (const permissionPoint of [{ consequence: "spend", control: "Place order" }, { consequence: "move_money", control: "" }, { consequence: "move_money", control: "x".repeat(121) }, { consequence: "move_money" }, { consequence: "move_money", control: "Place order", verb: "press" }, { consequence: "move_money", control: "Place order", askFirst: false }, "Place order"]) {
    assert.throws(() => parseLiveInstructionTasks([{ ...consequential, permissionPoint }]), (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid" && /LIVE_INSTRUCTION_TASKS\[0\]\.permissionPoint/u.test(error.message));
  }
});

/** Core's conversation endpoints over fixed threads, a page per inner array, recording every call. */
function threadsCore(threads: Record<string, Array<Array<Record<string, unknown>>>>, listed: Record<string, unknown>[]): { control: CreatedFlowPermissionThreadControl; calls: Array<{ endpoint: string; payload: Record<string, unknown>; domainId: string | undefined }> } {
  const calls: Array<{ endpoint: string; payload: Record<string, unknown>; domainId: string | undefined }> = [];
  return {
    calls,
    control: {
      automationStudioCall: async (endpoint, payload, _bounds, domainId) => {
        calls.push({ endpoint, payload, domainId });
        if (endpoint === "list-conversations") return { conversations: listed };
        const pages = threads[String(payload.conversationId)] ?? [];
        const index = payload.sinceTurnId === undefined ? 0 : pages.findIndex((page) => page.some((turn) => turn.turnId === payload.sinceTurnId)) + 1;
        return { conversation: { turns: pages[index] ?? [], hasMore: index < pages.length - 1 } };
      },
    },
  };
}

const permissionAsk = (askId: string, createdAt: number, fields: Record<string, unknown>) => ({ askId, kind: "permission", createdAt, ...fields });

test("the permission questions on the Flow's own thread are read back with Core's answer, oldest first, each judged against the point", async () => {
  const { control, calls } = threadsCore({
    "c-flow": [
      [{ turnId: "t1", ask: permissionAsk("request-order", 300, { status: "answered", answer: { kind: "grant", value: null }, missing: ["move_money"], control: { name: "Place order", kind: "button" } }) }],
      [{ turnId: "t2", ask: permissionAsk("request-cookies", 100, { status: "answered", answer: { kind: "deny", value: null }, control: null, permissionRequest: { missing: ["create_new"], control: { name: "Accept all", kind: "button" } } }) },
        { turnId: "t3", ask: { askId: "check-1", kind: "choice", status: "pending", control: { name: null, kind: "person_check" } } },
        { turnId: "t4", ask: permissionAsk("request-late", 400, { status: "expired", answer: null, missing: ["move_money"], control: { name: null, kind: null } }) }],
    ],
    "c-other-flow": [[{ turnId: "o1", ask: permissionAsk("request-elsewhere", 50, { status: "answered", answer: { kind: "grant" }, missing: ["move_money"], control: { name: "Place order" } }) }]],
    "c-run": [[{ turnId: "r1", ask: permissionAsk("request-run", 60, { status: "answered", answer: { kind: "grant" }, missing: ["move_money"], control: { name: "Place order" } }) }]],
  }, [
    { conversationId: "c-flow", pendingAskCount: 0, subject: { kind: "flow", id: "flow-1" } },
    { conversationId: "c-other-flow", pendingAskCount: 0, subject: { kind: "flow", id: "flow-2" } },
    { conversationId: "c-run", pendingAskCount: 0, subject: { kind: "run", id: "run-1" } },
  ]);
  const asked = await readCreatedFlowPermissionAsks(control, { projectId: "project-1", domainId: "web-automation", flowId: "flow-1" }, { permissionPoint: { consequence: "move_money", control: "Place order" } });
  assert.deepEqual(asked, [
    { askId: "request-cookies", status: "answered", answer: "deny", stop: { verdict: "elsewhere", reason: "class_not_missing" } },
    { askId: "request-order", status: "answered", answer: "grant", stop: { verdict: "at_declared_point", consequence: "move_money", control: "matched" } },
    { askId: "request-late", status: "expired", answer: null, stop: { verdict: "at_declared_point", consequence: "move_money", control: "unnamed" } },
  ], "only this Flow's thread, only permission asks, answered or not");
  assert.ok(!calls.some(({ payload }) => payload.conversationId === "c-other-flow" || payload.conversationId === "c-run"), "another Flow's thread and a run's thread are not opened");
  assert.deepEqual(calls.filter(({ endpoint }) => endpoint === "get-conversation").map(({ payload }) => payload.sinceTurnId ?? null), [null, "t1"], "a long thread is read a page at a time");
  assert.ok(calls.every(({ domainId, payload }) => domainId === "web-automation" && payload.projectId === "project-1"));
});
