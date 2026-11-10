// What a document says of its own navigation while one action runs (task speed
// S10): whether the Navigation API reported a navigation leaving it, or it
// began to unload, from the start of the action to its reply. The worker ends
// its wait for a navigation to start on that answer, so the watch must say
// nothing where it cannot vouch: no Navigation API, or a control that opens its
// page in another browsing context. The runner is Node: the window and its
// Navigation API are plain event targets, and the controls hand-built.

import assert from "node:assert/strict";
import test from "node:test";
import { opensElsewhere, watchActionNavigation } from "..";
import { WINDOW_OPEN_EVENT } from "../../../../shared/request-start-event";

type Attributes = Record<string, string>;

/** A window with a Navigation API, or without one, and a document whose `<base>` may name a target. */
function page(options: { navigationApi?: boolean; baseTarget?: string } = {}) {
  const view = new EventTarget() as EventTarget & { navigation?: EventTarget; document: Pick<Document, "querySelector"> };
  if (options.navigationApi !== false) view.navigation = new EventTarget();
  view.document = { querySelector: (selector: string) => (selector === "base[target]" && options.baseTarget !== undefined ? control({ target: options.baseTarget }) : null) } as Pick<Document, "querySelector">;
  const navigate = (sameDocument: boolean) => view.navigation!.dispatchEvent(Object.assign(new Event("navigate"), { destination: { sameDocument } }));
  return { view: view as unknown as Window, navigate, leave: (type: "pagehide" | "beforeunload") => view.dispatchEvent(new Event(type)) };
}

/** A control with its own attributes, inside a link or a form when given. */
function control(own: Attributes = {}, around: { link?: Attributes; form?: Attributes } = {}): Element {
  const element = (attributes: Attributes) => ({ getAttribute: (name: string) => attributes[name] ?? null });
  const link = around.link ? element(around.link) : null;
  const form = around.form ? element(around.form) : null;
  return {
    ...element(own),
    closest: (selector: string) => (selector.startsWith("a[href]") ? link : selector === "form" ? form : null)
  } as unknown as Element;
}

test("a press that leaves nothing says no navigation began", () => {
  const { view } = page();
  const watch = watchActionNavigation(view);
  assert.deepEqual(watch.seen(control()), { began: false, opened: false });
});

test("a navigation leaving the document, or the document unloading, says one began", () => {
  for (const begin of [(p: ReturnType<typeof page>) => p.navigate(false), (p: ReturnType<typeof page>) => p.leave("pagehide"), (p: ReturnType<typeof page>) => p.leave("beforeunload")]) {
    const current = page();
    const watch = watchActionNavigation(current.view);
    begin(current);
    assert.deepEqual(watch.seen(control()), { began: true, opened: false });
  }
});

test("a fragment or history move stays in the document and is no navigation", () => {
  const current = page();
  const watch = watchActionNavigation(current.view);
  current.navigate(true);
  assert.deepEqual(watch.seen(control()), { began: false, opened: false });
});

test("what happens after the reply is not the action's", () => {
  const current = page();
  const watch = watchActionNavigation(current.view);
  assert.deepEqual(watch.seen(control()), { began: false, opened: false });
  current.navigate(false);
  assert.deepEqual(watch.seen(control()), { began: false, opened: false });
});

test("a page with no Navigation API says nothing, so the worker keeps its wait", () => {
  const watch = watchActionNavigation(page({ navigationApi: false }).view);
  assert.equal(watch.seen(control()), undefined);
});

test("a control whose page opens in another browsing context says nothing", () => {
  const { view } = page();
  for (const opens of [control({}, { link: { target: "_blank" } }), control({}, { form: { target: "results" } }), control({ formtarget: "_blank" })]) {
    assert.equal(watchActionNavigation(view).seen(opens), undefined);
  }
  assert.equal(watchActionNavigation(page({ baseTarget: "_blank" }).view).seen(control()), undefined, "the document's <base target>");
  assert.deepEqual(watchActionNavigation(view).seen(control({}, { link: { target: "_self" } })), { began: false, opened: false }, "its own context");
});

test("an action with no control of its own is answered for the document", () => {
  const { view } = page();
  assert.deepEqual(watchActionNavigation(view).seen(undefined), { began: false, opened: false });
  assert.equal(opensElsewhere(control({}, { link: { target: " _SELF " } }), undefined), false);
});

test("a window.open the page world announces is reported, so the worker waits for its tab", () => {
  const current = page();
  const watch = watchActionNavigation(current.view);
  (current.view as unknown as EventTarget).dispatchEvent(new Event(WINDOW_OPEN_EVENT));
  assert.deepEqual(watch.seen(control()), { began: false, opened: true });
});
