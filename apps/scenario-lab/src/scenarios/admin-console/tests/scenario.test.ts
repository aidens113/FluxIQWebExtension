import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, scenarioPageFactSchedule, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { formatMoney } from "../format.js";
import { ADMIN_CONSOLE_TARGET } from "../manifest.js";
import { adminRecords, findRecord, FULL_BOOK_SIZE, recordsFor, SHORT_BOOK_SIZE } from "../records.js";
import { adminConsoleScenario as scenario } from "../scenario.js";
import { LIST_OVERSCAN_ROWS, LIST_ROW_HEIGHT_PX, LIST_VIEWPORT_HEIGHT_PX } from "../styles.js";
import type { AdminConsoleState } from "../types.js";
import { virtualListScript } from "../virtual-list.js";

type Selection = { workflowId?: string; variantId?: string };

const manifest = scenario.manifest;
const context = { runToken: "admin-console-unit-token", seed: 112 };
const apply = (state: AdminConsoleState, operation: string, payload: unknown) => scenario.mutate(state, operation, payload);
const label = ({ workflowId, variantId }: Selection) => `${workflowId ?? "primary"}/${variantId ?? "baseline"}`;
const count = (html: string, needle: string) => html.split(needle).length - 1;
const initial = () => scenario.createState(scenario.seed);

function route(state: AdminConsoleState, subpath: string, query = "", method: "GET" | "HEAD" = "GET") {
  const handler = scenario.route;
  assert.ok(handler);
  return handler(state, { subpath, query: new URLSearchParams(query), method }, context);
}

/** The primary workflow and every `workflows[]` entry, each bare and under each of its variants. */
function selections(): Selection[] {
  return [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)]
      .map((variantId): Selection => ({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
}

test("the manifest is valid and declares four workflows, each variant arming one property", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["extract-customer-list", "browse-to-customer", "switch-settings-tab"]);
  assert.deepEqual([manifest, ...(manifest.workflows ?? [])].map((workflow) => (workflow.variants ?? []).map(({ id, arm }) => ({ id, arm }))), [
    [{ id: "read-only", arm: { operation: "set-variant", payload: { variant: "read-only" } } }],
    [{ id: "short-book", arm: { operation: "set-variant", payload: { variant: "short-book" } } }],
    [],
    [{ id: "light-dom-toggle", arm: { operation: "set-variant", payload: { variant: "light-dom-toggle" } } }],
  ]);
  assert.equal(selections().length, 7);
  for (const selection of selections()) {
    const { expected, recordingScript } = resolveScenarioWorkflow(manifest, selection);
    assert.ok(recordingScript.length > 0, label(selection));
    assert.ok((expected.finalState ?? []).length > 0, label(selection));
  }
  assert.equal(resolveScenarioWorkflow(manifest, { variantId: "read-only" }).expected.failure?.category, "target_not_found");
});

/**
 * Page facts describe a rendering, not a run, so every rendering a lane
 * presents states its own. The three variants that change the first rendering
 * declare their own set; none of them inherits the workflow's.
 */
test("every rendering declares its own page facts and no variant inherits another's", () => {
  const armedAfter = (selection: Selection) => scenarioPageFactSchedule(manifest, selection, "arms-after-loading");
  const unarmed = armedAfter({}).atLoad.map(({ id }) => id);
  assert.deepEqual(unarmed, ["whole-book-counted", "nothing-selected", "settings-hidden", "workspace-named"]);
  assert.deepEqual(armedAfter({ variantId: "read-only" }).afterArm.map(({ id }) => id), ["read-only-declared", "whole-book-still-counted", "nothing-selected-yet"]);
  assert.deepEqual(armedAfter({ workflowId: "extract-customer-list", variantId: "short-book" }).afterArm.map(({ id }) => id), ["short-book-counted", "short-book-nothing-selected"]);
  assert.deepEqual(
    armedAfter({ workflowId: "switch-settings-tab", variantId: "light-dom-toggle" }).afterArm.map(({ id }) => id),
    [...unarmed, "digest-off-at-load", "switch-in-light-dom"],
  );
  // A lane that arms before loading presents the armed rendering only, and never the workflow's.
  assert.deepEqual(scenarioPageFactSchedule(manifest, { variantId: "read-only" }, "arms-before-loading").afterArm, []);
  assert.equal(scenarioPageFactSchedule(manifest, { variantId: "read-only" }, "arms-before-loading").atLoad[0]?.id, "read-only-declared");
  // browse-to-customer has no variant, so nothing is armed and nothing is claimed about a second rendering.
  assert.deepEqual(armedAfter({ workflowId: "browse-to-customer" }).afterArm, []);
});

test("the account book is the same for every seed and shaped for the workflows", () => {
  assert.equal(adminRecords.length, FULL_BOOK_SIZE);
  assert.equal(new Set(adminRecords.map(({ id }) => id)).size, FULL_BOOK_SIZE);
  assert.equal(new Set(adminRecords.map(({ company }) => company)).size, FULL_BOOK_SIZE);
  const target = findRecord(FULL_BOOK_SIZE, ADMIN_CONSOLE_TARGET);
  assert.ok(target);
  assert.equal(target.company, "Quarrow Robotics");
  assert.equal(adminRecords.indexOf(target), 127, "the target must sit far outside the render window");
  assert.equal(adminRecords.filter(({ company }) => company.includes(target.company)).length, 1, "searching the target company must leave exactly one row");
  assert.deepEqual(recordsFor(SHORT_BOOK_SIZE), adminRecords.slice(0, SHORT_BOOK_SIZE));
  assert.equal(findRecord(SHORT_BOOK_SIZE, ADMIN_CONSOLE_TARGET), undefined);
  const seeded = scenario.createState(scenario.seed);
  assert.deepEqual(scenario.createState(1), seeded);
  assert.deepEqual(scenario.createState(999), seeded);
  assert.deepEqual(seeded.oracle, { recordCount: FULL_BOOK_SIZE, savedCount: 0, weeklyDigest: false, routePath: "/scenarios/admin-console/" });
});

/**
 * Row 128 is outside the band the list mounts at rest. That is the fixture's
 * whole point, so it is asserted from the geometry rather than assumed.
 */
test("the render window is a small fraction of the book, and the target row is outside it", () => {
  const mountedAtRest = Math.ceil(LIST_VIEWPORT_HEIGHT_PX / LIST_ROW_HEIGHT_PX) + LIST_OVERSCAN_ROWS;
  assert.equal(mountedAtRest, 15);
  assert.ok(mountedAtRest < FULL_BOOK_SIZE / 10);
  assert.ok(SHORT_BOOK_SIZE < mountedAtRest, "short-book must fit entirely inside the window, or it is not a control");
  assert.ok(127 >= mountedAtRest);
});

/** The client formats money in its own copy of the rule. A drift between the two would move every row's text. */
test("the client's money formatter agrees with the server's on every record", () => {
  const start = virtualListScript.indexOf("function money");
  const end = virtualListScript.indexOf("function matchingRecords");
  assert.ok(start >= 0 && end > start);
  const clientMoney = new Function(`${virtualListScript.slice(start, end)}\nreturn money;`)() as (cents: number) => string;
  for (const record of adminRecords) assert.equal(clientMoney(record.mrrCents), formatMoney(record.mrrCents), record.id);
  for (const cents of [0, 5, 99, 100, 999_99, 1_000_00, 540_000, -1_250]) assert.equal(clientMoney(cents), formatMoney(cents), String(cents));
  assert.equal(formatMoney(540_000), "$5,400.00");
});

test("set-variant arms each mode from a clean console and baseline restores", () => {
  const browsing = apply(apply(initial(), "open-record", { recordId: ADMIN_CONSOLE_TARGET }), "set-preference", { preference: "weeklyDigest", value: true });
  const readOnly = apply(browsing, "set-variant", { variant: "read-only" });
  assert.equal(readOnly.variant, "read-only");
  assert.deepEqual(readOnly.openedRecordIds, []);
  assert.deepEqual(readOnly.route, { view: "records", recordId: null, tab: "profile" });
  assert.equal(readOnly.oracle.weeklyDigest, false);
  assert.equal(apply(browsing, "set-variant", { variant: "short-book" }).oracle.recordCount, SHORT_BOOK_SIZE);
  assert.equal(apply(browsing, "set-variant", { variant: "light-dom-toggle" }).oracle.recordCount, FULL_BOOK_SIZE);
  assert.deepEqual(apply(readOnly, "set-variant", { variant: "baseline" }), { ...initial(), lastOperation: "variant-set" });
  for (const payload of [{ variant: "bogus" }, {}, null, "read-only"]) assert.equal(apply(browsing, "set-variant", payload), browsing);
});

test("open-record records only customers the armed book holds", () => {
  const base = initial();
  const opened = apply(base, "open-record", { recordId: ADMIN_CONSOLE_TARGET });
  assert.deepEqual(opened.openedRecordIds, [ADMIN_CONSOLE_TARGET]);
  assert.equal(opened.oracle.routePath, `/scenarios/admin-console/records/${ADMIN_CONSOLE_TARGET}`);
  assert.equal(opened.lastOperation, "record-opened");
  for (const payload of [{ recordId: "CUS-9999" }, { recordId: 12 }, {}]) assert.equal(apply(base, "open-record", payload), base);
  const short = apply(base, "set-variant", { variant: "short-book" });
  assert.equal(apply(short, "open-record", { recordId: ADMIN_CONSOLE_TARGET }), short);
  assert.deepEqual(apply(short, "open-record", { recordId: "CUS-0003" }).openedRecordIds, ["CUS-0003"]);
});

test("save-record commits bounded edits, one per field, and ignores everything else", () => {
  const base = initial();
  const saved = apply(base, "save-record", { recordId: ADMIN_CONSOLE_TARGET, fields: [{ field: "mrr", value: "$5,400.00" }] });
  assert.deepEqual(saved.savedEdits[ADMIN_CONSOLE_TARGET], [{ field: "mrr", value: "$5,400.00" }]);
  assert.equal(saved.oracle.savedCount, 1);
  const twice = apply(saved, "save-record", { recordId: ADMIN_CONSOLE_TARGET, fields: [{ field: "mrr", value: "$99.00" }, { field: "owner", value: "  Nadia   Bergman " }] });
  assert.deepEqual(twice.savedEdits[ADMIN_CONSOLE_TARGET], [{ field: "mrr", value: "$99.00" }, { field: "owner", value: "Nadia Bergman" }]);
  assert.equal(twice.oracle.savedCount, 2);
  assert.equal(apply(base, "save-record", { recordId: ADMIN_CONSOLE_TARGET, fields: [{ field: "plan", value: "Scale" }] }), base);
  assert.equal(apply(base, "save-record", { recordId: ADMIN_CONSOLE_TARGET, fields: [{ field: "mrr", value: "   " }] }), base);
  assert.equal(apply(base, "save-record", { recordId: "CUS-9999", fields: [{ field: "mrr", value: "$1.00" }] }), base);
  for (const payload of [{ recordId: ADMIN_CONSOLE_TARGET, fields: "mrr" }, { recordId: ADMIN_CONSOLE_TARGET }, null]) {
    assert.equal(apply(base, "save-record", payload), base);
  }
  const long = apply(base, "save-record", { recordId: ADMIN_CONSOLE_TARGET, fields: [{ field: "owner", value: "x".repeat(200) }] });
  assert.equal(long.savedEdits[ADMIN_CONSOLE_TARGET]?.[0]?.value.length, 60);
});

test("preferences and same-document routes are recorded, and unknown operations are not", () => {
  const base = initial();
  const digest = apply(base, "set-preference", { preference: "weeklyDigest", value: true });
  assert.equal(digest.oracle.weeklyDigest, true);
  for (const payload of [{ preference: "weeklyDigest", value: "yes" }, { preference: "theme", value: true }, {}]) {
    assert.equal(apply(base, "set-preference", payload), base);
  }
  const settings = apply(base, "navigate-route", { view: "settings", tab: "notifications" });
  assert.equal(settings.oracle.routePath, "/scenarios/admin-console/settings?tab=notifications");
  assert.equal(apply(settings, "navigate-route", { view: "settings", tab: "profile" }).oracle.routePath, "/scenarios/admin-console/settings");
  assert.equal(apply(settings, "navigate-route", { view: "records" }).oracle.routePath, "/scenarios/admin-console/");
  assert.equal(apply(base, "navigate-route", { view: "settings", tab: "bogus" }).route.tab, "profile");
  assert.equal(apply(base, "unknown-operation", { view: "settings" }), base);
});

test("the start page renders the console shell, the whole book as bootstrap state, and the shadow-rooted switch", () => {
  const html = scenario.render(initial(), context);
  // Test ids are counted in the served markup only: the client script names
  // many of them again, and a match there says nothing about the document.
  const markup = html.slice(0, html.indexOf('<script type="module">'));
  assert.match(html, /<title>Atlas Admin<\/title>/);
  for (const testId of ["app-root", "nav-records", "nav-settings", "records-screen", "record-search", "list-summary", "list-viewport", "list-canvas", "detail-body", "detail-empty", "settings-view", "tab-notifications", "digest-status", "bootstrap-records"]) {
    assert.equal(count(markup, `data-testid="${testId}"`), 1, testId);
  }
  assert.match(html, /<p data-testid="list-summary" role="status">240 records<\/p>/);
  assert.equal(count(markup, ">Reset to default</button>"), 3, "three identical accessible names, told apart only by section");
  assert.equal(count(markup, 'data-testid="read-only-banner"'), 0);
  assert.match(html, /<fx-toggle data-testid="digest-toggle-host" data-pref="weeklyDigest" data-control-testid="digest-toggle" data-checked="false"><\/fx-toggle>/);
  assert.equal(count(markup, 'data-testid="digest-toggle"'), 0, "the switch's test id is written by the component, inside its shadow root");
  assert.match(html, /Weekly digest: off/);
  // The bootstrap payload is the whole book, and the client renders rows from it.
  const payload = html.slice(html.indexOf('data-testid="bootstrap-records">') + 'data-testid="bootstrap-records">'.length);
  const bootstrapped = JSON.parse(payload.slice(0, payload.indexOf("</script>"))) as Array<{ id: string }>;
  assert.equal(bootstrapped.length, FULL_BOOK_SIZE);
  assert.equal(bootstrapped[127]?.id, ADMIN_CONSOLE_TARGET);
  assert.equal(html.includes("<script>"), false, "the bootstrap payload must not be able to close its own tag");
});

test("each variant changes exactly the rendering it is the control for", () => {
  const readOnly = scenario.render(apply(initial(), "set-variant", { variant: "read-only" }), context);
  assert.equal(count(readOnly.slice(0, readOnly.indexOf('<script type="module">')), 'data-testid="read-only-banner"'), 1);
  assert.match(readOnly, /const READ_ONLY = true;/);
  const light = scenario.render(apply(initial(), "set-variant", { variant: "light-dom-toggle" }), context);
  assert.equal(count(light, "<fx-toggle"), 0);
  assert.match(light, /<button type="button" class="[^"]+" role="switch" aria-checked="false" aria-label="Weekly digest email" data-testid="digest-toggle">Off<\/button>/);
  const short = scenario.render(apply(initial(), "set-variant", { variant: "short-book" }), context);
  assert.match(short, /<p data-testid="list-summary" role="status">12 records<\/p>/);
  assert.match(short, /aria-rowcount="12"/);
  const shortPayload = short.slice(short.indexOf('data-testid="bootstrap-records">') + 'data-testid="bootstrap-records">'.length);
  assert.equal((JSON.parse(shortPayload.slice(0, shortPayload.indexOf("</script>"))) as unknown[]).length, SHORT_BOOK_SIZE);
});

test("deep links serve the same shell and record the one route a request did produce", () => {
  const state = initial();
  const record = route(state, `records/${ADMIN_CONSOLE_TARGET}`);
  assert.equal(record?.status, 200);
  assert.equal(record?.body, scenario.render(state, context));
  assert.deepEqual(record?.mutation, { operation: "deep-link", payload: { view: "records", recordId: ADMIN_CONSOLE_TARGET } });
  const settings = route(state, "settings", "tab=notifications");
  assert.deepEqual(settings?.mutation, { operation: "deep-link", payload: { view: "settings", tab: "notifications" } });
  assert.deepEqual(route(state, "settings", "tab=bogus")?.mutation, { operation: "deep-link", payload: { view: "settings", tab: "profile" } });
  for (const subpath of ["records/CUS-9999", "records/", "records/cus-0128", "settings/extra", "unknown", ""]) {
    assert.equal(route(state, subpath), undefined, subpath);
  }
  assert.equal(route(apply(state, "set-variant", { variant: "short-book" }), `records/${ADMIN_CONSOLE_TARGET}`), undefined);
  assert.deepEqual(route(state, `records/${ADMIN_CONSOLE_TARGET}`, "", "HEAD"), route(state, `records/${ADMIN_CONSOLE_TARGET}`));
  const walked = apply(state, "deep-link", { view: "records", recordId: ADMIN_CONSOLE_TARGET });
  assert.deepEqual(walked.openedRecordIds, [ADMIN_CONSOLE_TARGET]);
  assert.equal(walked.oracle.routePath, `/scenarios/admin-console/records/${ADMIN_CONSOLE_TARGET}`);
});

test("the extraction workflow expects the whole book, written as the page writes each row", () => {
  // This workflow pins no `actions`: the Flow lane judges its `extracted` records instead. Since X5.1 an extract step does record a web.dom.extract_list, so a pin here would be meetable -- the manifest simply makes none.
  assert.equal(resolveScenarioWorkflow(manifest, { workflowId: "extract-customer-list" }).expected.actions, undefined);
  assert.equal(resolveScenarioWorkflow(manifest, { workflowId: "extract-customer-list", variantId: "short-book" }).expected.actions, undefined);
  const whole = resolveScenarioWorkflow(manifest, { workflowId: "extract-customer-list" }).expected.extracted?.[0];
  assert.equal(whole?.count, FULL_BOOK_SIZE);
  assert.equal(whole?.records?.length, FULL_BOOK_SIZE);
  assert.deepEqual(whole?.records?.[0], {
    company: adminRecords[0]?.company,
    reference: `${adminRecords[0]?.id} · ${adminRecords[0]?.contact}`,
    plan: adminRecords[0]?.plan,
    mrr: formatMoney(adminRecords[0]?.mrrCents ?? 0),
  });
  assert.equal(whole?.records?.[127]?.company, "Quarrow Robotics");
  const short = resolveScenarioWorkflow(manifest, { workflowId: "extract-customer-list", variantId: "short-book" }).expected.extracted?.[0];
  assert.equal(short?.count, SHORT_BOOK_SIZE);
  assert.deepEqual(short?.records, whole?.records?.slice(0, SHORT_BOOK_SIZE));
});

/**
 * The identifier-less renderings. `variant` changes what the console *is*;
 * this changes only what a recorder can see of it, so the two are separate
 * axes and compose. A production build removes `data-testid` and the console
 * still has to work, which is why the attribute is renamed to the
 * application's own node handle rather than deleted -- the client script finds
 * its rows, its detail pane and its shadow-rooted switch through it.
 * `reports/x-identifierless.md` has the measurements these were built to take.
 */
test("set-identifiers arms a policy on its own axis, and rejects anything else", () => {
  const browsing = apply(apply(initial(), "open-record", { recordId: ADMIN_CONSOLE_TARGET }), "set-preference", { preference: "weeklyDigest", value: true });
  const built = apply(browsing, "set-identifiers", { policy: "no-test-ids" });
  assert.equal(built.identifiers, "no-test-ids");
  assert.deepEqual(built.openedRecordIds, [], "arming a policy resets the console, as set-variant does");
  assert.equal(built.oracle.weeklyDigest, false);
  assert.equal(built.variant, "baseline", "the variant axis is untouched");
  const short = apply(apply(initial(), "set-variant", { variant: "short-book" }), "set-identifiers", { policy: "no-identifiers" });
  assert.equal(short.variant, "short-book", "the two axes compose");
  assert.equal(short.identifiers, "no-identifiers");
  assert.equal(short.oracle.recordCount, SHORT_BOOK_SIZE);
  assert.equal(apply(short, "set-variant", { variant: "baseline" }).identifiers, "no-identifiers", "a variant does not reach for the policy");
  for (const payload of [{ policy: "stripped" }, { policy: 1 }, {}, null]) assert.equal(apply(browsing, "set-identifiers", payload), browsing);
});

test("no-test-ids leaves the console with no test id anywhere, script included, and every control still wired", () => {
  const authored = scenario.render(initial(), context);
  const page = scenario.render(apply(initial(), "set-identifiers", { policy: "no-test-ids" }), context);
  for (const attribute of ["data-testid", "data-test", "data-cy"]) assert.equal(page.includes(`${attribute}=`), false, attribute);
  assert.equal(count(page, "data-fx-node"), count(authored, "data-testid"), "every one is renamed, none is dropped");
  // The client finds the same nodes it always did, under the new name.
  assert.match(page, /const app = document\.querySelector\('\[data-fx-node="app-root"\]'\)/u);
  assert.match(page, /setAttribute\('data-fx-node', this\.getAttribute\('data-control-testid'\)/u, "the shadow switch still labels its inner button");
  // Ids a build has no reason to touch are untouched, and so is the markup.
  assert.match(page, /id="record-search"/u);
  assert.match(page, /aria-labelledby="customer-list-heading"/u);
  assert.equal(count(page, "<button"), count(authored, "<button"));
});

test("no-identifiers replaces every author-stable id and keeps every reference pointing at one", () => {
  const page = scenario.render(apply(initial(), "set-identifiers", { policy: "no-identifiers" }), context);
  assert.equal(page.includes("data-testid="), false);
  for (const authored of ["record-search", "customer-list-heading", "digest-label"]) {
    assert.equal(page.includes(`id="${authored}"`), false, authored);
  }
  const ids = [...page.matchAll(/\sid="([^"]*)"/gu)].map(([, id]) => id ?? "");
  assert.deepEqual(ids, [":r0:", ":r1:", ":r2:"]);
  assert.match(page, /aria-labelledby=":r0:"/u);
  assert.match(page, /<label for=":r1:">Search customers<\/label>/u);
  assert.match(page, /id=":r1:" type="search"/u);
});
