// The type verb above humanness 0 (`../../../type.ts`, W2 H3): the keyboard is given
// a gap before each character after the first, fitted within the command's
// time, and the verb waits for the typing before it reads the field back. At 0,
// or with no level, the keyboard is called exactly as before: two arguments, a
// synchronous call, nothing awaited for it.
//
// The page is faked at the few things the verb reads, on the pattern of
// `../../type-unsent-form.test.ts`.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../../../types";
import type { ContentActionDependencies } from "../../../types";

class FakeInputElement {}
class FakeTextAreaElement {}
class FakeHTMLElement {}

async function installPlatform(t: TestContext) {
  const scope = globalThis as unknown as Record<string, unknown>;
  const names = ["HTMLInputElement", "HTMLTextAreaElement", "HTMLElement", "window"] as const;
  const before = Object.fromEntries(names.map((name) => [name, scope[name]]));
  const view: Record<string, unknown> = { innerWidth: 1280, innerHeight: 800, addEventListener: () => undefined };
  view.top = view;
  Object.assign(scope, { HTMLInputElement: FakeInputElement, HTMLTextAreaElement: FakeTextAreaElement, HTMLElement: FakeHTMLElement, window: view });
  t.after(() => Object.assign(scope, before));
  return (await import("../../../type")).typeAction;
}

function field(): Element {
  return Object.assign(Object.create(FakeInputElement.prototype as object) as object, { tagName: "INPUT", type: "text", isConnected: true, value: "", form: null, getAttribute: () => null }) as unknown as Element;
}

type Call = { arity: number; gaps: readonly number[] | undefined };

/**
 * Types `text` with a keyboard that records how it was called. With gaps, it
 * writes the value only after `lateMs`, so a verb that did not wait for it
 * would read the field back empty.
 */
async function typeWith(typeAction: Awaited<ReturnType<typeof installPlatform>>, command: Partial<BrowserActionCommand>, lateMs = 120) {
  const calls: Call[] = [];
  let said = "";
  const deps = {
    resolveTarget: () => ({ element: field(), resolution: {} }),
    checkActionability: () => ({ actionable: true, point: { x: 4, y: 4 }, detail: "the point 4,4 landed on the target" }),
    describeElement: () => ({}),
    captureSnapshot: () => ({}),
    keyboard: {
      typeText(target: { value: string }, text: string, gaps?: readonly number[]) {
        calls.push({ arity: arguments.length, gaps });
        if (!gaps) {
          target.value = text;
          return undefined;
        }
        return new Promise<void>((resolve) => setTimeout(() => {
          target.value = text;
          resolve();
        }, lateMs));
      },
      pressKey: () => ({ dispatched: true, defaultAction: "none", expected: "", detail: "", held: true })
    },
    success: (action: BrowserActionCommand, startedAt: number, message: string, validation: BrowserActionValidation): BrowserActionResult => {
      said = message;
      return { commandId: action.commandId, actionType: action.actionType, status: "succeeded", validation, startedAt, finishedAt: startedAt };
    }
  } as unknown as ContentActionDependencies;
  await typeAction({ commandId: "cmd-type", actionType: "web.dom.type", text: "napkins", ...command } as BrowserActionCommand, deps, Date.now());
  return { calls, said };
}

test("at level 0, or with no level, the keyboard is called as before: the field and the text, nothing more", async (t) => {
  const typeAction = await installPlatform(t);
  for (const command of [{}, { humanness: 0 }]) {
    const { calls, said } = await typeWith(typeAction, command);
    assert.deepEqual(calls, [{ arity: 2, gaps: undefined }]);
    assert.equal(said, "Text entered.");
  }
});

test("at level 80 the keyboard is given a gap before each character after the first, and the verb waits for the typing", async (t) => {
  const typeAction = await installPlatform(t);
  const { calls, said } = await typeWith(typeAction, { humanness: 80, timeoutMs: 5_000 });
  assert.equal(calls.length, 1);
  const gaps = calls[0]?.gaps;
  assert.ok(gaps);
  assert.equal(gaps.length, "napkins".length - 1);
  assert.ok(gaps.every((gap) => Number.isInteger(gap) && gap >= 0));
  // 40% of a 5 s command is the most the pauses may take.
  assert.ok(gaps.reduce((sum, gap) => sum + gap, 0) <= 2_000);
  assert.equal(said, "Text entered.", "the field was read back only after the typing finished");
});

test("the same command id plans the same gaps, and a short command's gaps are scaled to fit it", async (t) => {
  const typeAction = await installPlatform(t);
  const first = await typeWith(typeAction, { humanness: 80, timeoutMs: 60_000 }, 1);
  const again = await typeWith(typeAction, { humanness: 80, timeoutMs: 60_000 }, 1);
  assert.deepEqual(again.calls[0]?.gaps, first.calls[0]?.gaps);
  const short = await typeWith(typeAction, { humanness: 80, timeoutMs: 100 }, 1);
  const total = (short.calls[0]?.gaps ?? []).reduce((sum, gap) => sum + gap, 0);
  assert.ok(total <= 40, `a 100 ms command was planned ${total} ms of pauses`);
  assert.equal(short.calls[0]?.gaps?.length, 6, "scaled, not dropped");
});

test("the typed result records the level with aimed false above level 0, and nothing at 0 or with no level", async (t) => {
  const typeAction = await installPlatform(t);
  const record = async (command: Partial<BrowserActionCommand>): Promise<BrowserActionResult> => {
    const deps = {
      resolveTarget: () => ({ element: field(), resolution: {} }),
      checkActionability: () => ({ actionable: true, point: { x: 4, y: 4 }, detail: "" }),
      describeElement: () => ({}),
      captureSnapshot: () => ({}),
      keyboard: { typeText: (target: { value: string }, text: string) => { target.value = text; }, pressKey: () => ({ held: true }) },
      success: (action: BrowserActionCommand, startedAt: number, _m: string, validation: BrowserActionValidation): BrowserActionResult => ({ commandId: action.commandId, actionType: action.actionType, status: "succeeded", validation, startedAt, finishedAt: startedAt })
    } as unknown as ContentActionDependencies;
    return typeAction({ commandId: "cmd-type", actionType: "web.dom.type", text: "napkins", ...command } as BrowserActionCommand, deps, 5);
  };
  const absent = await record({});
  assert.equal("humanness" in absent, false);
  assert.deepEqual(await record({ humanness: 0 }), absent);
  assert.deepEqual((await record({ humanness: 80, timeoutMs: 100 })).humanness, { level: 80, aimed: false });
});
