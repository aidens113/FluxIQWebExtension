// Escape ends the pick in the page, and the worker is told.
//
// It has to be told, and it cannot find out any other way: the key is swallowed
// in this frame so the recording does not show a keystroke the page never got,
// which means it never reaches the panel. Before this message existed the frame
// took its overlay down and forgot the pick while the worker's session stayed
// `picking`, so the panel went on saying "click an example item" over a page
// where no click could produce one. The page and the panel disagreed about what
// the user had just done, and only the user could see both.
//
// The runner is Node, so the page is a stub: `session.ts` claims `window` and
// builds the overlay through `document`, which is why the stubs go in before the
// module is imported and every global is put back afterwards -- every test
// bundle runs in one process. What a real overlay looks like is the content
// harness's (`e2e/content/tests/extraction/tests/extraction-picker.spec.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { EXTRACTION_PICKED_MESSAGE, EXTRACTION_PICK_CANCELLED_MESSAGE } from "../../../shared/extraction-messages";

type Session = typeof import("../session");
type Listener = (event: unknown) => void;

const STUB_GLOBALS = ["window", "document", "chrome", "Element"] as const;

const listeners = new Map<string, Listener[]>();
const sent: Array<Record<string, unknown>> = [];
let session: Session | undefined;

/** Only the members the overlay touches: it sets styles through the CSSOM and puts its host in a shadow root. */
function stubElement(): Record<string, unknown> {
  return {
    style: { setProperty: () => undefined },
    setAttribute: () => undefined,
    attachShadow: () => ({ append: () => undefined }),
    append: () => undefined,
    remove: () => undefined,
    textContent: ""
  };
}

/** Delivers one event to every capture listener registered for it. `type` is on the event too, which is what `swallowEvent` branches on. */
function fire(type: string, event: Record<string, unknown> = {}): void {
  const delivered = { type, preventDefault: () => undefined, stopImmediatePropagation: () => undefined, ...event };
  for (const listener of [...listeners.get(type) ?? []]) listener(delivered);
}

/** Runs `body` against a freshly loaded picker session on a stub page, and restores every global. */
async function onStubPage(body: (loaded: Session) => void): Promise<void> {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = new Map(STUB_GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)]));
  listeners.clear();
  sent.length = 0;
  globals["window"] = {
    addEventListener: (type: string, listener: Listener) => { listeners.set(type, [...listeners.get(type) ?? [], listener]); },
    removeEventListener: (type: string, listener: Listener) => { listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry !== listener)); }
  };
  globals["document"] = {
    createElement: () => stubElement(),
    documentElement: { append: () => undefined },
    // Nothing is under the pointer, so a press picks no target. That keeps
    // inference out of these rows: what a press infers is proved on a real page.
    elementFromPoint: () => null
  };
  globals["chrome"] = { runtime: { sendMessage: (message: Record<string, unknown>) => { sent.push(message); return Promise.resolve(); } } };
  // `pickTarget` asks `target instanceof Element`, which throws outright when
  // there is no such global rather than answering false.
  globals["Element"] = class StubElementClass {};
  try {
    session ??= await import("../session");
    body(session);
  } finally {
    session?.stopPick();
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
}

test("Escape ends a pick that was waiting, and tells the worker so the panel does not wait on it", async () => {
  await onStubPage(({ startPick }) => {
    startPick("s1", "list");
    assert.ok((listeners.get("keydown") ?? []).length > 0, "the picker is listening for the key");

    fire("keydown", { key: "Escape" });

    assert.deepEqual(sent, [{ type: EXTRACTION_PICK_CANCELLED_MESSAGE, sessionId: "s1" }]);
    assert.deepEqual(listeners.get("keydown"), [], "and the picker has let the page go");
    assert.deepEqual(listeners.get("pointerdown"), [], "every swallowing listener is off, not just the key one");
  });
});

test("a key that is not Escape neither ends the pick nor says anything", async () => {
  await onStubPage(({ startPick }) => {
    startPick("s1", "list");
    fire("keydown", { key: "a" });
    assert.deepEqual(sent, []);
    assert.equal((listeners.get("keydown") ?? []).length, 1, "the picker is still up");
  });
});

test("Escape after the press has taken a pick cancels nothing: that pick is already on its way", async () => {
  await onStubPage(({ startPick }) => {
    startPick("s1", "list");
    // Nothing is under the pointer, so the pick is a refusal -- but it is still a
    // pick: the session is draining the rest of the press, and the worker has
    // been told. Cancelling here would discard what the user chose.
    fire("pointerdown", { target: {}, clientX: 5, clientY: 5 });
    assert.deepEqual(sent.map((message) => message.type), [EXTRACTION_PICKED_MESSAGE]);

    fire("keydown", { key: "Escape" });
    assert.deepEqual(sent.map((message) => message.type), [EXTRACTION_PICKED_MESSAGE], "no cancel follows the pick");
  });
});

test("Escape with no pick open says nothing at all", async () => {
  await onStubPage(() => {
    fire("keydown", { key: "Escape" });
    assert.deepEqual(sent, []);
  });
});
