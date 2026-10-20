// The packet store (`../target-packets.ts`), held on its own.
//
// The authoring tools number handles for the whole Flow
// (`../../stable-handles.ts`), so two pages they show never give one handle to
// different controls and a bare handle resolves (`resolve-plan-node.test.ts`).
// The store still decides what such a handle means -- a Flow whose numbers had
// to start again can produce one -- so the rule is held here against the store
// itself, with packets numbered positionally as the sanitizer numbers them.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebLlmExtractionHandles } from "../../structure";
import { webLlmHandleRejectionReason } from "../../tool-rejection";
import { createWebLlmStableTargetHandles } from "../../stable-handles";
import { createWebLlmTargetPackets, resolveWebPlanNodeParameters, type WebPlanNodeResolutionInput } from "..";

test("pages that disagree make a bare handle ambiguous, and each page still answers for itself", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  const show = (url: string, element: JsonObject): void => targets.remember(scope, sanitizeWebLlmSnapshotWithBindings({ url, interactiveElements: [element] }));
  show("https://example.test/a", { tagName: "button", selector: "#renamed", visibleText: "Renamed" });
  show("https://example.test/b", { tagName: "button", selector: "#renamed", visibleText: "Renamed" });
  assert.equal(targets.resolve(scope, "t1", undefined).ok, true, "pages that agree leave it resolvable bare");
  show("https://example.test/c", { tagName: "a", selector: "#other", visibleText: "Other" });
  assert.deepEqual(targets.resolve(scope, "t1", undefined), { ok: false, code: "ambiguous" });
  const at = (location: string): string => {
    const resolution = targets.resolve(scope, "t1", location);
    return resolution.ok ? resolution.selector : resolution.code;
  };
  assert.equal(at("https://example.test/c"), "#other");
  assert.equal(at("https://example.test/a"), "#renamed");
});

// A rerun puts its page back by reloading it, and a reload can renumber the
// page's handles (`run-musq0b1m-0472cfa0`, Cause 4: 7-in-1 was `t985` on one
// load and `t1194` on the next, and the rerun's handle from before the reload
// was refused `handle_not_in_packet` with nothing saying why). The store knows
// both halves from what it was given: the newer view of the same page arrived
// by reload (`navigation.type`), and the control the handle named is in it
// under another handle. Such a handle is still unknown, and says so.

const ITEM = "https://shop.example/item/1";

function view(navigationType: string | undefined, elements: JsonObject[]) {
  const snapshot: JsonObject = { url: ITEM, interactiveElements: elements };
  if (navigationType !== undefined) snapshot.evidence = { navigation: { url: ITEM, origin: "https://shop.example", path: "/item/1", type: navigationType, historyLength: 2, visibility: "visible" } };
  return sanitizeWebLlmSnapshotWithBindings(snapshot);
}

const SPEC = (name: string, selector: string): JsonObject => ({ tagName: "div", selector, visibleText: name, hasClickHandler: true });

test("a handle shown before a reload, whose control the reloaded page shows under another handle, is unknown because the page was reloaded", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  targets.remember(scope, view(undefined, [SPEC("4-in-1", "#a > div:nth-of-type(1)"), SPEC("10-in-1", "#a > div:nth-of-type(3)"), SPEC("7-in-1", "#a > div:nth-of-type(2)")]));
  assert.equal(targets.resolve(scope, "t3", ITEM).ok, true, "7-in-1 is t3 before the reload");
  // The reload addresses the group differently and lists 7-in-1 second: t3 is gone, and 7-in-1 is t2.
  targets.rememberLook(scope, view("reload", [SPEC("4-in-1", "#fb1 > div:nth-of-type(1)"), SPEC("7-in-1", "#fb1 > div:nth-of-type(2)")]));
  assert.deepEqual(targets.resolve(scope, "t3", ITEM), { ok: false, code: "unknown", renumberedByReload: true });
  assert.deepEqual(targets.resolve(scope, "t3", undefined), { ok: false, code: "unknown", renumberedByReload: true }, "and bare");
  // A handle no view ever carried keeps today's answer.
  assert.deepEqual(targets.resolve(scope, "t9", ITEM), { ok: false, code: "unknown" });
  // Shown again, the handle resolves and the mark goes with it.
  targets.remember(scope, view("reload", [SPEC("4-in-1", "#a > div:nth-of-type(1)"), SPEC("10-in-1", "#a > div:nth-of-type(3)"), SPEC("7-in-1", "#a > div:nth-of-type(2)")]));
  assert.equal(targets.resolve(scope, "t3", ITEM).ok, true);
  targets.remember(scope, view(undefined, [SPEC("4-in-1", "#a > div:nth-of-type(1)")]));
  assert.deepEqual(targets.resolve(scope, "t3", ITEM), { ok: false, code: "unknown" }, "a later drop that was no reload says nothing of one");
});

test("a reload says nothing of a handle whose control is not on the reloaded page, and a re-render without a reload says nothing at all", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  targets.remember(scope, view(undefined, [SPEC("4-in-1", "#a > div:nth-of-type(1)"), SPEC("7-in-1", "#a > div:nth-of-type(2)")]));
  targets.remember(scope, view("reload", [SPEC("4-in-1", "#a > div:nth-of-type(1)")]));
  assert.deepEqual(targets.resolve(scope, "t2", ITEM), { ok: false, code: "unknown" }, "7-in-1 left the page: the reload did not renumber it");

  const other = { projectId: "project.one", flowId: "flow.two" };
  targets.remember(other, view(undefined, [SPEC("4-in-1", "#a > div:nth-of-type(1)"), SPEC("10-in-1", "#a > div:nth-of-type(3)"), SPEC("7-in-1", "#a > div:nth-of-type(2)")]));
  targets.remember(other, view(undefined, [SPEC("4-in-1", "#a > div:nth-of-type(1)"), SPEC("7-in-1", "#a > div:nth-of-type(2)")]));
  assert.deepEqual(targets.resolve(other, "t3", ITEM), { ok: false, code: "unknown" }, "the same renumbering with no reload is not called one");
});

test("a plan step naming a handle the reload renumbered is refused web.handle.renumbered_by_reload, read as handle_not_in_packet", async () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  targets.remember(scope, view(undefined, [SPEC("4-in-1", "#a > div:nth-of-type(1)"), SPEC("10-in-1", "#a > div:nth-of-type(3)"), SPEC("7-in-1", "#a > div:nth-of-type(2)")]));
  targets.rememberLook(scope, view("reload", [SPEC("4-in-1", "#fb1 > div:nth-of-type(1)"), SPEC("7-in-1", "#fb1 > div:nth-of-type(2)")]));
  const resolve = (handle: string) => resolveWebPlanNodeParameters(
    { ...scope, nodeDefinitionId: webAutomationOutputNodeId("web.dom.click"), parameters: { target: { handle, location: ITEM } }, gatedByCaller: true },
    { targets, extractions: createWebLlmExtractionHandles() }
  );
  const renumbered = await resolve("t3");
  assert.equal(renumbered.status, "refused");
  if (renumbered.status !== "refused") return;
  assert.equal(renumbered.issueCodes.includes("web.handle.renumbered_by_reload"), true, JSON.stringify(renumbered.issueCodes));
  assert.equal(renumbered.issueCodes.includes("web.handle.unknown"), false);
  assert.equal(webLlmHandleRejectionReason(renumbered.issueCodes), "handle_not_in_packet");
  // A handle no view ever carried keeps today's code.
  const never = await resolve("t9");
  assert.equal(never.status === "refused" && never.issueCodes.includes("web.handle.unknown"), true, JSON.stringify(never));
});

// U-B3-3 (lane B round 3, `run-mux6pndp-16feb842`): a size chip lays its name
// and its price out as two lines, and its captured text runs them together.
// The identity keeps that text whole, since the page compares it; the
// resolution carries the words a person reads beside it, never in it.
test("a resolution names a control by its readable words beside an identity that keeps the captured text, and a secret control by nothing", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  targets.remember(scope, sanitizeWebLlmSnapshotWithBindings({
    url: ITEM,
    interactiveElements: [
      { tagName: "button", selector: "#size-12", visibleText: "12 Double Rolls$16.47", readableText: "12 Double Rolls $16.47" },
      { tagName: "button", selector: "#add", visibleText: "Add to cart" },
      { tagName: "input", selector: "#pw", inputType: "password", accessibleName: "Pass word", readableText: "Pass  word" }
    ]
  }));
  const chip = targets.resolve(scope, "t1", undefined);
  assert.equal(chip.ok, true);
  if (!chip.ok) return;
  assert.equal(chip.words, "12 Double Rolls $16.47");
  assert.equal(chip.element.visibleText, "12 Double Rolls$16.47", "the identity the page compares is the captured text");
  const add = targets.resolve(scope, "t2", undefined);
  assert.equal(add.ok && add.words, undefined, "a control whose words read as captured carries no second spelling");
  const secret = targets.resolve(scope, "t3", undefined);
  if (secret.ok) {
    assert.equal(secret.words, undefined);
    assert.equal(secret.element.accessibleName, undefined);
  }
});

// Lane A round 4 (`run-muyrpbnk-fef374e7`, t356 C1): exploration pressed the store coupon's "Get coupons", the page
// relabelled it "Collected", and the newer view replaced the handle's identity, so the candidate script's `t925` was
// bound to "Collected" and the trial's freshly reset page, which says "Get coupons", had no such control (0032,
// `web.target.not_found`). A re-viewed handle keeps only what its views agree on -- while that still names it as
// many ways as the thinner view did (t596). A label alone is the button's second signal, so the newest view's label
// is kept, and exploration's own press saves the label the act found (`acted`, below), never the one it put there.

const COUPON = (label: string): JsonObject => ({ tagName: "button", selector: "#coupon", visibleText: label });

test("a handle whose control a newer view relabelled keeps the newest label rather than its tag alone, on this page or a reloaded one", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.coupon" };
  targets.remember(scope, view(undefined, [COUPON("Get coupons")]));
  const before = targets.resolve(scope, "t1", undefined);
  assert.equal(before.ok && before.element.visibleText, "Get coupons", "first shown with its own label");
  targets.remember(scope, view(undefined, [COUPON("Collected")]));
  const after = targets.resolve(scope, "t1", undefined);
  assert.equal(after.ok, true);
  if (!after.ok) return;
  assert.equal(after.selector, "#coupon");
  assert.equal(after.element.tagName, "button");
  assert.equal(after.element.visibleText, "Collected", "a button named no way but by its tag is no identity (t596)");
  // The trial's reset page shows "Get coupons" again: still the same control, as that view names it.
  targets.rememberLook(scope, view("reload", [COUPON("Get coupons")]));
  const reset = targets.resolve(scope, "t1", ITEM);
  assert.equal(reset.ok && reset.selector, "#coupon");
  assert.equal(reset.ok ? reset.element.visibleText : "refused", "Get coupons");
});

test("a re-viewed handle keeps every field its views agree on, and a handle that now names another element takes the newer view whole", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.same" };
  targets.remember(scope, view(undefined, [COUPON("Get coupons")]));
  targets.remember(scope, view(undefined, [COUPON("Get coupons")]));
  const same = targets.resolve(scope, "t1", ITEM);
  assert.equal(same.ok && same.element.visibleText, "Get coupons", "a label both views showed stays");
  targets.remember(scope, view(undefined, [{ tagName: "a", selector: "#coupon", visibleText: "Coupon centre" }]));
  const other = targets.resolve(scope, "t1", ITEM);
  assert.equal(other.ok && other.element.tagName, "a");
  assert.equal(other.ok && other.element.visibleText, "Coupon centre", "another element under the handle is not merged with the old one");
});

test("a look the capture cut short merges its re-viewed handles the same way, and keeps the page's other handles", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.truncated" };
  targets.remember(scope, view(undefined, [COUPON("Get coupons"), SPEC("Space Grey", "#grey")]));
  const cut = view(undefined, [COUPON("Collected")]);
  cut.evidence.truncated = true;
  targets.rememberLook(scope, cut);
  const coupon = targets.resolve(scope, "t1", ITEM);
  assert.equal(coupon.ok && coupon.selector, "#coupon");
  assert.equal(coupon.ok ? coupon.element.visibleText : "refused", "Collected", "merged as a whole view is (t596)");
  assert.equal(targets.resolve(scope, "t2", ITEM).ok, true, "a cut-short look forgets nothing");
});

// R4a and R4b (t442, F1): the same coupon, saved by a candidate as `{div, class b}` -- the agreement above kept no
// words -- and a wordless identity matches the collected coupon as well as the uncollected one. A handle exploration
// acted on is now saved, for a candidate submission (`view_history`), as the view the act was made from showed it;
// what the act changed is its effect. Exploration keeps the agreed identity, and where that names the control fewer
// ways than either view did, the newest view's words (t596): the page as it now is.

const STORE_COUPON = (label: string, classes: string): JsonObject => ({ tagName: "div", selector: "#coupons > div:nth-of-type(2)", visibleText: label, hasClickHandler: true, classNames: classes.split(" "), attributes: { class: classes } });

test("a handle exploration acted on is saved as the act found it, and exploration names it as the page now shows it", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.acted" };
  const before = view(undefined, [STORE_COUPON("Get coupons", "b")]);
  targets.remember(scope, before);
  targets.acted(scope, "t1", before);
  const after = view(undefined, [STORE_COUPON("Collected", "b x")]);
  targets.remember(scope, after);
  // A later act on the done control does not replace the first act's view: the Flow meets the control as exploration first did.
  targets.acted(scope, "t1", after);
  const saved = targets.resolve(scope, "t1", undefined, "view_history");
  assert.equal(saved.ok, true, JSON.stringify(saved));
  if (!saved.ok) return;
  assert.equal(saved.element.visibleText, "Get coupons");
  assert.deepEqual(saved.element.classNames, ["b"]);
  assert.ok(!JSON.stringify(saved).includes("Collected"), "the words the act put there are its effect, never the identity");
  const exploring = targets.resolve(scope, "t1", undefined);
  assert.equal(exploring.ok && exploring.element.visibleText, "Collected", "exploration on the page as it now is asks for no words the act took away");
  assert.deepEqual(exploring.ok && exploring.element.classNames, ["b"], "and not for the class the act toggled");
});

test("an acted-on identity is not lent to another element under the handle, and a handle nothing acted on is named as its newest view names it", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.acted-moved" };
  const before = view(undefined, [STORE_COUPON("Get coupons", "b"), SPEC("Space Grey", "#grey")]);
  targets.remember(scope, before);
  targets.acted(scope, "t1", before);
  targets.remember(scope, view(undefined, [{ tagName: "a", selector: "#coupon-centre", visibleText: "Coupon centre" }, SPEC("Space Blue", "#grey")]));
  const moved = targets.resolve(scope, "t1", ITEM, "view_history");
  assert.equal(moved.ok && moved.element.visibleText, "Coupon centre", "another address is another control");
  const untouched = targets.resolve(scope, "t2", ITEM, "view_history");
  // Its words are all that names it beside its tag, so the agreement alone would leave it found by its tag (t596).
  assert.equal(untouched.ok && untouched.element.visibleText, "Space Blue", "a label two views disagree on is the newest view's where nothing acted");
});

// A handle from another page, named for an act on the page the caller is on (t486).
//
// Round 12 build 1 (`run-mv62icw0-2be384b4`, 0035/0036): `t667` was shown on
// the towels page and named by a call made on the napkins page, where no `t667`
// exists. Written bare, it resolved against every page the Flow had seen, found
// the towels page's control, and the extension hunted for it on the napkins
// page through four attempts (25.5 s) before answering a bare
// `target_not_found`.
//
// Held here: a caller that says which page it acts on (`onPage`) resolves a
// bare handle against that page alone, and a handle only another page showed
// is refused `web.handle.stale` before anything is sent -- the code the node
// run answers with the page it captured (t477). A handle no page showed stays
// `web.handle.unknown`; a page the store does not hold, or holds only through a
// look the browser cut short, is resolved as before, since neither can say what
// the page lacks. Without `onPage` -- a replay, a check, a candidate -- nothing
// changes.

const SCOPE = { projectId: "project.onpage", flowId: "flow.onpage" };
const TOWELS = "https://valueridge.test/p/paper-towels";
const NAPKINS = "https://valueridge.test/p/dinner-napkins";
const CLICK = webAutomationOutputNodeId("web.dom.click");

const TOWELS_PAGE: JsonObject[] = [
  { tagName: "button", selector: "#towels-plus", accessibleName: "Increase quantity", id: "towels-plus" },
  { tagName: "button", selector: "#towels-add", accessibleName: "Add to cart: paper towels", id: "towels-add" }
];
const NAPKINS_PAGE: JsonObject[] = [
  { tagName: "button", selector: "#napkins-add", accessibleName: "Add to cart: dinner napkins", id: "napkins-add" }
];

function flow() {
  const handles = createWebLlmStableTargetHandles();
  const targets = createWebLlmTargetPackets();
  const capture = (url: string, elements: JsonObject[], cut = false) => handles.restamp(SCOPE, sanitizeWebLlmSnapshotWithBindings({ url, interactiveElements: elements, truncated: cut }));
  const handleOf = (binding: ReturnType<typeof capture>, selector: string): string => {
    const found = binding.evidence.elements.find((element) => binding.selectors.get(element.target) === selector);
    if (found === undefined) throw new Error(`no handle for ${selector}`);
    return found.target;
  };
  return { targets, capture, handleOf, stores: { targets, extractions: createWebLlmExtractionHandles() } };
}

function press(handle: string, extra: Partial<WebPlanNodeResolutionInput> = {}): WebPlanNodeResolutionInput {
  return { ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle } }, gatedByCaller: true, ...extra };
}

test("a handle only another page showed is refused web.handle.stale for an act on this page", async () => {
  const { targets, capture, handleOf, stores } = flow();
  const towels = capture(TOWELS, TOWELS_PAGE);
  targets.remember(SCOPE, towels);
  // The model moves on; the node run looks at the napkins page before it acts.
  targets.rememberLook(SCOPE, capture(NAPKINS, NAPKINS_PAGE));
  const stale = handleOf(towels, "#towels-add");

  const answer = await resolveWebPlanNodeParameters(press(stale, { onPage: NAPKINS }), stores);
  assert.equal(answer.status, "refused", JSON.stringify(answer));
  if (answer.status === "refused") {
    assert.equal(answer.issueCodes[0], "web.handle.stale");
    assert.ok(answer.issueCodes.includes("web.handle.stale:target"), JSON.stringify(answer.issueCodes));
  }
  // The store says the same on its own.
  assert.deepEqual(targets.resolveOn(SCOPE, stale, NAPKINS), { ok: false, code: "stale" });
});

test("a handle on the page acted on resolves there; one no page showed stays unknown", async () => {
  const { targets, capture, handleOf, stores } = flow();
  targets.remember(SCOPE, capture(TOWELS, TOWELS_PAGE));
  const napkins = capture(NAPKINS, NAPKINS_PAGE);
  targets.rememberLook(SCOPE, napkins);

  const here = await resolveWebPlanNodeParameters(press(handleOf(napkins, "#napkins-add"), { onPage: NAPKINS }), stores);
  assert.equal(here.status, "resolved", JSON.stringify(here));
  if (here.status === "resolved") assert.equal(here.parameters.selector, "#napkins-add");

  const nowhere = await resolveWebPlanNodeParameters(press("t999", { onPage: NAPKINS }), stores);
  assert.equal(nowhere.status, "refused", JSON.stringify(nowhere));
  if (nowhere.status === "refused") assert.equal(nowhere.issueCodes[0], "web.handle.unknown");
});

test("without onPage a bare handle still resolves from any remembered page (a replay, a check)", async () => {
  const { targets, capture, handleOf, stores } = flow();
  const towels = capture(TOWELS, TOWELS_PAGE);
  targets.remember(SCOPE, towels);
  targets.rememberLook(SCOPE, capture(NAPKINS, NAPKINS_PAGE));
  const answer = await resolveWebPlanNodeParameters(press(handleOf(towels, "#towels-add")), stores);
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
});

test("a location written beside the handle still decides over onPage", async () => {
  const { targets, capture, handleOf, stores } = flow();
  const towels = capture(TOWELS, TOWELS_PAGE);
  targets.remember(SCOPE, towels);
  targets.rememberLook(SCOPE, capture(NAPKINS, NAPKINS_PAGE));
  const input = press(handleOf(towels, "#towels-add"), { onPage: NAPKINS });
  input.parameters = { target: { handle: handleOf(towels, "#towels-add"), location: TOWELS } };
  const answer = await resolveWebPlanNodeParameters(input, stores);
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
});

test("a page the store does not hold, or holds only through a look cut short, resolves as before", async () => {
  const { targets, capture, handleOf, stores } = flow();
  const towels = capture(TOWELS, TOWELS_PAGE);
  targets.remember(SCOPE, towels);
  const towelsAdd = handleOf(towels, "#towels-add");

  const unheld = await resolveWebPlanNodeParameters(press(towelsAdd, { onPage: "https://valueridge.test/cart" }), stores);
  assert.equal(unheld.status, "resolved", JSON.stringify(unheld));

  // The browser cut the napkins look short: the towels button may be past where it stopped.
  targets.rememberLook(SCOPE, capture(NAPKINS, NAPKINS_PAGE, true));
  const cut = await resolveWebPlanNodeParameters(press(towelsAdd, { onPage: NAPKINS }), stores);
  assert.equal(cut.status, "resolved", JSON.stringify(cut));

  // A whole view of the napkins page settles it.
  targets.rememberLook(SCOPE, capture(NAPKINS, NAPKINS_PAGE));
  const whole = await resolveWebPlanNodeParameters(press(towelsAdd, { onPage: NAPKINS }), stores);
  assert.equal(whole.status, "refused", JSON.stringify(whole));
});

test("a handle a page at the same path showed under another query resolves: the same document in another state", async () => {
  const { targets, capture, handleOf, stores } = flow();
  const variant = capture(`${TOWELS}?variant=12`, TOWELS_PAGE);
  targets.remember(SCOPE, variant);
  // The rerun put the page back without the variant, and its look did not describe the button.
  targets.rememberLook(SCOPE, capture(TOWELS, [TOWELS_PAGE[0]!]));
  const answer = await resolveWebPlanNodeParameters(press(handleOf(variant, "#towels-add"), { onPage: TOWELS }), stores);
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
});

test("a candidate submission is not held to it: its steps act on many pages", async () => {
  const { targets, capture, handleOf, stores } = flow();
  const towels = capture(TOWELS, TOWELS_PAGE);
  targets.remember(SCOPE, towels);
  targets.rememberLook(SCOPE, capture(NAPKINS, NAPKINS_PAGE));
  const candidate = (extra: Partial<WebPlanNodeResolutionInput>): WebPlanNodeResolutionInput => ({
    ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle: handleOf(towels, "#towels-add") } }, declaredConsequences: [],
    permission: async () => ({ permitted: true as const }), handleReach: "view_history", ...extra
  });
  const answer = await resolveWebPlanNodeParameters(candidate({ onPage: NAPKINS }), stores);
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
  assert.deepEqual(answer, await resolveWebPlanNodeParameters(candidate({}), stores));
});

// A reload marks only the first view of a new document (`../target-packets.ts`,
// `markRenumbered`, t741 C2).
//
// `navigation.type` is how the document was reached, and it stays `reload` for
// the document's whole life. A review list on a page that was once reloaded
// shows two "Read more" buttons; exploration presses the first, it expands its
// review and leaves the page, and the next view of the same document -- still
// `reload` -- shows the other "Read more". Marking the pressed handle as
// renumbered by a reload then refused it before the view history and the
// acted identity could name it (social round 3, 0137-0165,
// `web.handle.renumbered_by_reload` with no reload made). The browser's own
// identity of a document, `navigation.timeOrigin`, says whether a view is the
// first of a new document; where either view lacks it, the old rule holds.

const REVIEWS_SCOPE = { projectId: "project.reviews", flowId: "flow.reviews" };
const REVIEWS_PAGE = "https://library.test/book/42/reviews";

const MORE = (review: number): JsonObject => ({ tagName: "button", selector: `#review-${review} > button.more`, visibleText: "Read more" });
const TEXT = (review: number, words: string): JsonObject => ({ tagName: "p", selector: `#review-${review} > p`, visibleText: words });

/** One store and stable handles, as exploration numbers its views. */
function reviews() {
  const targets = createWebLlmTargetPackets();
  const handles = createWebLlmStableTargetHandles();
  const capture = (elements: JsonObject[], timeOrigin: number | undefined) => {
    const navigation: JsonObject = { url: REVIEWS_PAGE, type: "reload" };
    if (timeOrigin !== undefined) navigation.timeOrigin = timeOrigin;
    return handles.restamp(REVIEWS_SCOPE, sanitizeWebLlmSnapshotWithBindings({ url: REVIEWS_PAGE, interactiveElements: elements, evidence: { navigation } }));
  };
  const handleOf = (binding: ReturnType<typeof capture>, selector: string): string => {
    const found = binding.evidence.elements.find((element) => binding.selectors.get(element.target) === selector);
    if (found === undefined) throw new Error(`no handle for ${selector}`);
    return found.target;
  };
  return { targets, capture, handleOf };
}

/** The first view, the press on the first "Read more", and the view it left: the second "Read more" still shows. */
function pressedFirst(firstOrigin: number | undefined, secondOrigin: number | undefined) {
  const { targets, capture, handleOf } = reviews();
  const first = capture([TEXT(1, "A fine read."), MORE(1), TEXT(2, "Slow start."), MORE(2)], firstOrigin);
  const pressed = handleOf(first, "#review-1 > button.more");
  const other = handleOf(first, "#review-2 > button.more");
  targets.remember(REVIEWS_SCOPE, first);
  const second = capture([TEXT(1, "A fine read. The ending surprised me."), TEXT(2, "Slow start."), MORE(2)], secondOrigin);
  assert.equal(handleOf(second, "#review-2 > button.more"), other, "the other Read more keeps its handle");
  targets.acted(REVIEWS_SCOPE, pressed, first, second);
  targets.remember(REVIEWS_SCOPE, second);
  return { targets, pressed, location: first.evidence.location };
}

test("a control a press took off the page, in a later view of the same reloaded document, is not marked renumbered and resolves from the view history as the act found it", () => {
  const { targets, pressed, location } = pressedFirst(1_000, 1_000);
  assert.deepEqual(targets.resolve(REVIEWS_SCOPE, pressed, location), { ok: false, code: "unknown" }, "it left the page, and no reload renumbered it");
  const reached = targets.resolve(REVIEWS_SCOPE, pressed, location, "view_history");
  assert.equal(reached.ok, true, JSON.stringify(reached));
  if (!reached.ok) return;
  assert.equal(reached.selector, "#review-1 > button.more");
  assert.equal(reached.element.visibleText, "Read more", "the acted identity");
  assert.equal(reached.element.tagName, "button");
});

test("the first view of a new document still marks a dropped handle whose control it shows under another", () => {
  const { targets, pressed, location } = pressedFirst(1_000, 2_000);
  assert.deepEqual(targets.resolve(REVIEWS_SCOPE, pressed, location), { ok: false, code: "unknown", renumberedByReload: true });
  assert.deepEqual(targets.resolve(REVIEWS_SCOPE, pressed, location, "view_history"), { ok: false, code: "unknown", renumberedByReload: true });
});

test("where either view lacks timeOrigin, a reload marks as it always has", () => {
  for (const [first, second] of [[undefined, 1_000], [1_000, undefined], [undefined, undefined]] as const) {
    const { targets, pressed, location } = pressedFirst(first, second);
    assert.deepEqual(targets.resolve(REVIEWS_SCOPE, pressed, location), { ok: false, code: "unknown", renumberedByReload: true }, `${first} then ${second}`);
  }
});

test("a look the capture cut short does not stand in for the page's document: the next whole view of a new document still marks", () => {
  const { targets, capture, handleOf } = reviews();
  const first = capture([MORE(1), MORE(2)], 1_000);
  const gone = handleOf(first, "#review-1 > button.more");
  targets.remember(REVIEWS_SCOPE, first);
  const cut = capture([MORE(2)], 2_000);
  cut.evidence.truncated = true;
  targets.rememberLook(REVIEWS_SCOPE, cut);
  targets.remember(REVIEWS_SCOPE, capture([MORE(2)], 2_000));
  assert.deepEqual(targets.resolve(REVIEWS_SCOPE, gone, first.evidence.location), { ok: false, code: "unknown", renumberedByReload: true });
});
