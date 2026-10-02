// What the type verb says about a form it typed into and did not send.
//
// Live runs 36 and 37 (t193, bigbox) typed a shorter product name into the
// results page's search field, were told only "Text entered.", and then
// searched the unchanged page for results eleven and twelve times. Typing
// sends the characters and nothing else, so the result now says the form was
// not sent and names the control that sends it.
//
// The page is faked at the few things the verb reads, on the pattern of
// `gate-refusal.test.ts`.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";
import type { ContentActionDependencies } from "../types";

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
  return (await import("../type")).typeAction;
}

/** A text field, in `form` when one is given. */
function field(form: unknown): Element {
  return Object.assign(Object.create(FakeInputElement.prototype as object) as object, { tagName: "INPUT", type: "search", value: "", form, getAttribute: () => null }) as unknown as Element;
}

/** A form whose submit control is `submit`, or that has none. */
function form(submit?: Record<string, unknown>): unknown {
  return { querySelector: () => (submit ? { getAttribute: (name: string) => (submit[name] as string | undefined) ?? null, textContent: submit.textContent ?? "" } : null) };
}

function run(typeAction: Awaited<ReturnType<typeof installPlatform>>, element: Element, keeps = true, submit?: { sends: boolean; pressed: string[]; status?: string | undefined }): string {
  let said = "";
  const deps = {
    resolveTarget: () => ({ element, resolution: {} }),
    checkActionability: () => ({ actionable: true, point: { x: 4, y: 4 }, detail: "the point 4,4 landed on the target" }),
    describeElement: () => ({}),
    captureSnapshot: () => ({}),
    keyboard: {
      typeText: (target: { value: string }, text: string) => { target.value = keeps ? text : ""; },
      pressKey: (_target: Element, key: string) => {
        submit?.pressed.push(key);
        return { dispatched: true, defaultAction: submit?.sends ? "submitted" : "none", expected: "Enter submits the form", detail: submit?.sends ? "the form was submitted" : "the form refused to submit", held: submit?.sends === true };
      }
    },
    success: (action: BrowserActionCommand, startedAt: number, message: string, validation: BrowserActionValidation): BrowserActionResult => {
      said = message;
      if (submit) submit.status = validation.status;
      return { commandId: action.commandId, actionType: action.actionType, status: "succeeded", validation, startedAt, finishedAt: startedAt };
    }
  } as unknown as ContentActionDependencies;
  typeAction({ commandId: "c", actionType: "web.dom.type", text: "napkins 250 count", ...(submit ? { submit: true } : {}) }, deps, 0);
  return said;
}

test("typing into a search form says the form was not sent, and names the button that sends it", async (t) => {
  const typeAction = await installPlatform(t);
  const said = run(typeAction, field(form({ textContent: "\n  Search \n" })));
  assert.match(said, /^Text entered\. Typing pressed no other key, so the field's form was not sent/u);
  assert.match(said, /press its "Search" button \(or Enter in the field\) to send it, or type with submit set to true\.$/u);
});

test("a submit control named only by its label is named by it; a form with none is sent with Enter", async (t) => {
  const typeAction = await installPlatform(t);
  assert.match(run(typeAction, field(form({ "aria-label": "Find a product", textContent: "" }))), /press its "Find a product" button/u);
  assert.match(run(typeAction, field(form())), /if the page has not answered the text, press Enter in the field to send it, or type with submit set to true\.$/u);
});

test("a field outside any form, or one that did not keep the text, says nothing about sending", async (t) => {
  const typeAction = await installPlatform(t);
  assert.equal(run(typeAction, field(null)), "Text entered.");
  assert.equal(run(typeAction, field(form({ textContent: "Search" })), false), "The field did not keep the text.");
});

test("a command with submit types, then presses Enter in the field, and fails when Enter sent nothing", async (t) => {
  const typeAction = await installPlatform(t);
  const sent = { sends: true, pressed: [] as string[], status: undefined as string | undefined };
  assert.equal(run(typeAction, field(form({ textContent: "Search" })), true, sent), "Text entered, then Enter pressed in the field.");
  assert.deepEqual(sent.pressed, ["Enter"]);
  assert.equal(sent.status, "passed");
  const refused = { sends: false, pressed: [] as string[], status: undefined as string | undefined };
  assert.equal(run(typeAction, field(form({ textContent: "Search" })), true, refused), "Text entered, but Enter did not send the field's form.");
  assert.equal(refused.status, "failed");
  // Text the field did not keep is never sent.
  const kept = { sends: true, pressed: [] as string[], status: undefined as string | undefined };
  assert.equal(run(typeAction, field(form({ textContent: "Search" })), false, kept), "The field did not keep the text.");
  assert.deepEqual(kept.pressed, []);
});
