import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, scenarioPageFactSchedule, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { applyChanges, filterMembers, rosterFor, statsText } from "../filters.js";
import { directoryMembers, RECORDED_MEMBER, ROSTER_SIZE, teamNames } from "../members.js";
import { memberDirectoryScenario as scenario } from "../scenario.js";
import { directoryClasses, DIRECTORY_BUILDS } from "../styles.js";
import type { DirectoryMode, MemberDirectoryState } from "../types.js";

type Selection = { workflowId?: string; variantId?: string };

const manifest = scenario.manifest;
const context = { runToken: "member-directory-unit-token", seed: 137 };
const baseline = directoryClasses(DIRECTORY_BUILDS.baseline);
const restyled = directoryClasses(DIRECTORY_BUILDS.restyled);

const render = (mode: DirectoryMode) => scenario.render(apply(scenario.createState(scenario.seed), "set-mode", { mode }), context);
const apply = (state: MemberDirectoryState, operation: string, payload: unknown) => scenario.mutate(state, operation, payload);
const occurrences = (html: string, needle: string) => html.split(needle).length - 1;
/** The document without the page's own script, which quotes selectors and class names that are not markup. */
const markupOf = (html: string) => html.slice(0, html.indexOf("<script"));
const label = ({ workflowId, variantId }: Selection) => `${workflowId ?? "primary"}/${variantId ?? "unarmed"}`;

/** The primary workflow and every `workflows[]` entry, each bare and under each of its variants. */
function selections(): Selection[] {
  return [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)]
      .map((variantId): Selection => ({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
}

test("the manifest is a valid scenario with three workflows and four variants, each arming one mode", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["filter-members", "remove-invitations"]);
  assert.deepEqual([manifest, ...(manifest.workflows ?? [])].map((workflow) => (workflow.variants ?? []).map(({ id, arm }) => ({ id, arm }))), [
    [
      { id: "restyled", arm: { operation: "set-mode", payload: { mode: "restyled" } } },
      { id: "member-left", arm: { operation: "set-mode", payload: { mode: "member-left" } } },
    ],
    [{ id: "sorted-by-activity", arm: { operation: "set-mode", payload: { mode: "sorted-by-activity" } } }],
    [{ id: "support-drawer", arm: { operation: "set-mode", payload: { mode: "support-drawer" } } }],
  ]);
  assert.equal(selections().length, 7);
  for (const selection of selections()) {
    const { expected } = resolveScenarioWorkflow(manifest, selection);
    assert.ok((expected.finalState ?? []).length > 0, label(selection));
  }
});

test("every rendering declares its own page facts and inherits none", () => {
  for (const selection of selections()) {
    const { atLoad, afterArm } = scenarioPageFactSchedule(manifest, selection, "arms-after-loading");
    assert.ok(atLoad.length > 0, `${label(selection)} unarmed facts`);
    if (selection.variantId === undefined) assert.deepEqual(afterArm, [], label(selection));
    else assert.ok(afterArm.length > 0, `${label(selection)} armed facts`);
  }
  const armed = scenarioPageFactSchedule(manifest, { variantId: "member-left" }, "arms-before-loading").atLoad;
  const smaller = statsText(rosterFor("member-left"));
  assert.equal(armed.find((fact) => fact.subject === "member-stats")?.value, smaller);
  assert.notEqual(smaller, statsText(rosterFor("baseline")));
});

test("the roster is 240 authored people, in name order, identical for every seed", () => {
  assert.equal(directoryMembers.length, ROSTER_SIZE);
  assert.equal(new Set(directoryMembers.map(({ id }) => id)).size, ROSTER_SIZE);
  assert.equal(new Set(directoryMembers.map(({ email }) => email)).size, ROSTER_SIZE);
  assert.deepEqual([...directoryMembers].sort((left, right) => (left.name < right.name ? -1 : 1)).map(({ id }) => id), directoryMembers.map(({ id }) => id));
  assert.equal(statsText(directoryMembers), "240 members · 43 admins · 32 pending");
  assert.equal(directoryMembers.filter(({ status }) => status === "Suspended").length, 13);
  assert.equal(directoryMembers.filter(({ status }) => status === "Invited").every(({ lastActive }) => lastActive === "Never"), true);
  assert.deepEqual(scenario.createState(1), scenario.createState(scenario.seed));
  assert.deepEqual(scenario.createState(42).oracle, { memberCount: 240, adminCount: 43, pendingCount: 32 });
  assert.deepEqual(
    { name: RECORDED_MEMBER.name, role: RECORDED_MEMBER.role, status: RECORDED_MEMBER.status, team: RECORDED_MEMBER.team },
    { name: "Priya Hollis", role: "Member", status: "Active", team: "Platform" },
  );
  assert.ok((teamNames as readonly string[]).includes(RECORDED_MEMBER.team));
});

test("every class name is a build hash, and no two builds share one", () => {
  const baselineNames = Object.values(baseline);
  const restyledNames = Object.values(restyled);
  assert.ok(baselineNames.every((name) => /^css-[0-9a-z]{7}$/.test(name)), baselineNames.find((name) => !/^css-[0-9a-z]{7}$/.test(name)));
  assert.equal(new Set(baselineNames).size, baselineNames.length);
  assert.equal(baselineNames.filter((name) => restyledNames.includes(name)).length, 0);
  const markup = markupOf(render("baseline"));
  const authored = [...markup.matchAll(/class="([^"]+)"/g)].flatMap((match) => (match[1] ?? "").split(" "));
  assert.deepEqual([...new Set(authored.filter((name) => !/^css-[0-9a-z]{7}$/.test(name)))], []);
  // One icon button style, worn by the three top-bar controls, the table
  // settings control, and all 240 row action buttons.
  assert.equal(occurrences(markup, `class="${baseline.iconButton}"`), 244);
});

test("the page renders the whole roster at application scale, with the identifiers a run reads", () => {
  const html = render("baseline");
  const markup = markupOf(html);
  assert.equal(occurrences(markup, "<tr"), ROSTER_SIZE + 1);
  assert.equal(occurrences(markup, `aria-label="Row actions"`), ROSTER_SIZE);
  assert.equal(occurrences(markup, `aria-haspopup="menu"`), ROSTER_SIZE + 1);
  assert.equal(occurrences(markup, `data-member-id=`), ROSTER_SIZE);
  assert.ok([...markup.matchAll(/<[a-z][a-z0-9]*[\s>]/g)].length > 4_000);
  for (const testId of ["member-stats", "member-search", "role-filter", "status-filter", "member-rows", "result-count", "sort-status", "build-marker", "toast-region"]) {
    assert.equal(occurrences(markup, `data-testid="${testId}"`), 1, testId);
  }
  assert.equal(occurrences(markup, `>Search</label>`), 2);
  assert.equal(occurrences(markup, `>Invite people</button>`), 2);
  assert.match(html, /data-testid="member-stats">240 members · 43 admins · 32 pending</);
  assert.match(html, /data-testid="result-count">Showing 240 of 240 members</);
  assert.match(html, /data-testid="sort-status">Sorted by Name</);
  assert.match(html, /data-testid="build-marker">Meridian Console · build 24\.6\.1</);
  assert.equal(occurrences(markup, `data-testid="support-drawer"`), 0);
  assert.equal(html.includes(context.runToken), true, "the page's own script is authorized by the run token");
});

test("each armed rendering changes one thing and leaves the rest alone", () => {
  const base = render("baseline");
  const drift = render("restyled");
  assert.match(drift, /data-testid="build-marker">Meridian Console · build 24\.7\.2</);
  assert.equal(occurrences(drift, `aria-label="Row actions"`), ROSTER_SIZE);
  for (const name of Object.values(baseline)) assert.equal(drift.includes(name), false, name);
  assert.equal(stripClasses(drift), stripClasses(base).replace("build 24.6.1", "build 24.7.2"));

  const left = render("member-left");
  assert.equal(occurrences(left, `data-member-id="${RECORDED_MEMBER.id}"`), 0);
  assert.equal(occurrences(left, "<tr"), ROSTER_SIZE);
  assert.match(left, /data-testid="member-stats">239 members · 43 admins · 32 pending</);

  const drawer = render("support-drawer");
  assert.equal(occurrences(drawer, `data-testid="support-drawer"`), 1);
  assert.equal(occurrences(drawer, "<tr"), ROSTER_SIZE + 1);

  const sorted = render("sorted-by-activity");
  assert.match(sorted, /data-testid="sort-status">Sorted by Last active</);
  assert.deepEqual(memberIds(sorted), rosterFor("sorted-by-activity").map(({ id }) => id));
  assert.deepEqual(memberIds(base), rosterFor("baseline").map(({ id }) => id));
  assert.notDeepEqual(memberIds(sorted), memberIds(base));
});

test("mutations record what the page reported and refuse what it could not have", () => {
  const initial = scenario.createState(scenario.seed);
  const promoted = apply(initial, "update-role", { id: RECORDED_MEMBER.id, role: "Admin" });
  assert.deepEqual(promoted.oracle, { memberCount: 240, adminCount: 44, pendingCount: 32 });
  assert.deepEqual(promoted.activity, [`role ${RECORDED_MEMBER.id} Admin`]);
  assert.match(scenario.render(promoted, context), /data-testid="member-stats">240 members · 44 admins · 32 pending</);

  const invited = filterMembers(rosterFor("baseline"), { search: "", role: "", status: "invited" });
  const removed = apply(initial, "remove-members", { ids: invited.map(({ id }) => id) });
  assert.deepEqual(removed.oracle, { memberCount: 208, adminCount: 38, pendingCount: 0 });
  assert.deepEqual(removed.activity, ["removed 32"]);
  assert.equal(apply(removed, "remove-members", { ids: invited.map(({ id }) => id) }), removed);

  for (const payload of [{ id: RECORDED_MEMBER.id, role: "Superuser" }, { id: "usr_zzzzzz", role: "Admin" }, { id: 7, role: "Admin" }, {}, null]) {
    assert.equal(apply(initial, "update-role", payload), initial, JSON.stringify(payload));
  }
  for (const payload of [{ ids: "usr_zzzzzz" }, { ids: [7] }, { ids: [] }, {}]) {
    assert.equal(apply(initial, "remove-members", payload), initial, JSON.stringify(payload));
  }
  assert.equal(apply(initial, "unknown-operation", { mode: "restyled" }), initial);
  for (const payload of [{ mode: "bogus" }, {}, null]) assert.equal(apply(initial, "set-mode", payload), initial, JSON.stringify(payload));
  assert.deepEqual(apply(promoted, "set-mode", { mode: "restyled" }), { ...initial, mode: "restyled" }, "arming clears what an earlier run did");

  let busy = initial;
  for (let index = 0; index < 60; index += 1) busy = apply(busy, "update-role", { id: RECORDED_MEMBER.id, role: index % 2 === 0 ? "Admin" : "Member" });
  assert.equal(busy.activity.length, 50);
});

test("the manifest's expectations are what the fixture actually produces", () => {
  const admins = filterMembers(rosterFor("baseline"), { search: "hollis", role: "admin", status: "" });
  assert.deepEqual(admins.map(({ name }) => name), ["Joon Hollis", "Otto Hollis"]);
  const extracted = resolveScenarioWorkflow(manifest, { workflowId: "filter-members" }).expected.extracted?.[0];
  assert.equal(extracted?.count, 2);
  assert.deepEqual(extracted?.records?.[0], {
    id: admins[0]?.id ?? "", member: "JH Joon Hollis joon.hollis@halden-robotics.test", role: "Admin", team: "Support", status: "Active",
  });
  const reordered = resolveScenarioWorkflow(manifest, { workflowId: "filter-members", variantId: "sorted-by-activity" }).expected.extracted?.[0];
  assert.deepEqual(reordered?.records?.map((record) => record.member), [
    "OH Otto Hollis otto.hollis@halden-robotics.test", "JH Joon Hollis joon.hollis@halden-robotics.test",
  ]);
  assert.notDeepEqual(reordered?.records, extracted?.records);

  const promotedText = statsText(applyChanges(rosterFor("baseline"), { [RECORDED_MEMBER.id]: "Admin" }, []));
  assert.equal(manifest.expected.finalState?.find((fact) => fact.subject === "member-stats")?.value, promotedText);
  assert.equal(manifest.expected.finalState?.find((fact) => fact.subject === "toast")?.value, "Priya Hollis's role is now Admin");
  const bulk = manifest.workflows?.find(({ id }) => id === "remove-invitations")?.expected.finalState ?? [];
  assert.equal(bulk.find((fact) => fact.subject === "toast")?.value, "32 members removed");
  assert.equal(bulk.find((fact) => fact.subject === "member-stats")?.value, "208 members · 38 admins · 0 pending");
});

/** The document with every generated class name taken out, so two builds can be compared for everything else. */
function stripClasses(html: string): string {
  return html.replaceAll(/css-[0-9a-z]{7}/g, "css-x");
}

/** The rows in the order the table renders them. */
function memberIds(html: string): string[] {
  return [...html.matchAll(/data-member-id="([^"]+)"/g)].map((match) => match[1] ?? "");
}

/**
 * The identifier-less renderings. `mode` changes what the console *is*; this
 * changes only what a recorder can see of it, so they are separate axes and
 * compose. A production build removes `data-testid` and the console still has
 * to work, which is why the attribute is renamed to the application's own node
 * handle rather than deleted -- the client script finds its rows and both
 * dialogs through it. `reports/x-identifierless.md` has the measurements.
 */
test("set-identifiers arms a policy on its own axis, composes with a mode, and rejects anything else", () => {
  const changed = apply(scenario.createState(scenario.seed), "update-role", { id: RECORDED_MEMBER.id, role: "Admin" });
  const built = apply(changed, "set-identifiers", { policy: "no-test-ids" });
  assert.equal(built.identifiers, "no-test-ids");
  assert.deepEqual(built.roles, {}, "arming a policy clears the run's changes, as set-mode does");
  assert.equal(built.mode, "baseline", "the mode axis is untouched");
  const restyledBuild = apply(apply(scenario.createState(scenario.seed), "set-mode", { mode: "restyled" }), "set-identifiers", { policy: "no-identifiers" });
  assert.equal(restyledBuild.mode, "restyled", "the two axes compose");
  assert.equal(restyledBuild.identifiers, "no-identifiers");
  assert.equal(apply(restyledBuild, "set-mode", { mode: "baseline" }).identifiers, "no-identifiers", "a mode does not reach for the policy");
  for (const payload of [{ policy: "stripped" }, { policy: 7 }, {}]) assert.equal(apply(changed, "set-identifiers", payload), changed);
});

test("no-test-ids leaves the console with no test id anywhere, script included, and every control still wired", () => {
  const authored = scenario.render(scenario.createState(scenario.seed), context);
  const page = scenario.render(apply(scenario.createState(scenario.seed), "set-identifiers", { policy: "no-test-ids" }), context);
  for (const attribute of ["data-testid", "data-test", "data-cy"]) assert.equal(page.includes(`${attribute}=`), false, attribute);
  assert.equal(occurrences(page, "data-fx-node"), occurrences(authored, "data-testid"), "every one is renamed, none is dropped");
  assert.equal(occurrences(page, "<button"), occurrences(authored, "<button"), "the controls are all still there");
});

test("no-identifiers replaces every author-stable id and keeps every reference pointing at one", () => {
  const page = scenario.render(apply(scenario.createState(scenario.seed), "set-identifiers", { policy: "no-identifiers" }), context);
  assert.equal(page.includes("data-testid="), false);
  // The markup only. The client script composes ids at runtime
  // (`id="' + member.id + '"`), which the transform deliberately leaves whole
  // -- rewriting half of a template the browser has not finished would break
  // the page. That limitation is stated on `applyIdentifierPolicy`, and it
  // means a rendering whose recorded target is client-composed is not fully
  // identifier-less. Nothing this console records is one.
  const markup = markupOf(page);
  const ids = [...markup.matchAll(/\sid="([^"]*)"/gu)].map(([, id]) => id ?? "");
  assert.deepEqual(ids.filter((id) => !/^:r\d+:$/u.test(id)), [], "every server-rendered id is a generated one");
  const declared = new Set(ids);
  for (const [, value] of markup.matchAll(/\s(?:for|aria-labelledby|aria-describedby|aria-controls)="([^"]*)"/gu)) {
    for (const reference of (value ?? "").split(/\s+/u)) {
      assert.ok(declared.has(reference), `${reference} is referenced but no element declares it`);
    }
  }
});
