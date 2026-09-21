import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { LIVE_INSTRUCTION_TASKS, LIVE_REPAIR_TASKS } from "../../index.js";
import { MEMBERS, RECEIVED_INVITATIONS, SENT_INVITATIONS, timeAgoLabel, sentAtIso, REFERENCE_NOW_MS } from "../data/index.js";
import { invitationStore, invitationStoreText, professionalNetworkScenario, ROTTERDAM_ENGINEERS, staleConnectionRequests, STORE_AFTER_WITHDRAWAL, STORE_AT_START } from "../index.js";
import { peopleResultsPage, searchChallenged } from "../search/index.js";
import type { ProfessionalNetworkState } from "../types.js";

const { createState, mutate, render, route, manifest } = professionalNetworkScenario;
const context = (seed: number) => ({ runToken: "professional-network-token", seed });
const start = (state = createState(4303), seed = 4303) => render(state, context(seed));
const page = (subpath: string, state = createState(4303), seed = 4303, query = "") =>
  route!(state, { subpath, query: new URLSearchParams(query), method: "GET" }, context(seed));
/** The markup without the text of its module scripts, which name selectors and words the page itself does not show. */
const markupOnly = (html: string) => html.replace(/<script type="module">[\s\S]*?<\/script>/gu, "");
const storeOf = (html: string) => /<script type="application\/json" data-testid="invitation-store">([^<]*)<\/script>/u.exec(html)?.[1];

test("the manifest is valid, loopback-only, and declares its workflows, variants and tasks", () => {
  assert.deepEqual(validateWebScenario(manifest), { valid: true, value: manifest });
  assert.equal(manifest.networkPolicy, "loopback-only");
  assert.deepEqual(manifest.variants?.map(({ id }) => id), ["redesigned-withdraw-dialog"]);
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["people-search"]);
  assert.deepEqual(manifest.workflows?.[0]?.variants?.map(({ id }) => id), ["premium-upsell"]);
  const tasks = LIVE_INSTRUCTION_TASKS.filter(({ scenarioId }) => scenarioId === "professional-network").map(({ id }) => id);
  assert.deepEqual(tasks, ["professional-network-rotterdam-data-engineers", "professional-network-rotterdam-data-engineers-upsell", "professional-network-withdraw-stale-requests", "professional-network-invitation-allowance"]);
  assert.deepEqual(LIVE_REPAIR_TASKS.filter(({ scenarioId }) => scenarioId === "professional-network").map(({ id }) => id), ["professional-network-repair-redesigned-withdraw-dialog"]);
});

test("the extraction oracle is the search's own matches: 23 people, each once, no promoted entry, in first-seen order", () => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "people-search" });
  const [dataset] = workflow.expected.extracted ?? [];
  assert.equal(dataset?.count, 23);
  assert.equal(dataset?.records?.length, 23);
  const names = dataset!.records!.map((record) => record.name);
  assert.equal(new Set(names).size, 23, "nobody twice");
  for (const absent of ["Sanne de Wit", "Kayla Brooks", "Emre Yilmaz", "Wouter de Boer", "Guildline Member", "Fleur Brouwer", "Rosa Meijer"]) assert.ok(!names.includes(absent), absent);
  assert.deepEqual(names.slice(0, 3), ["Mara Okafor", "Joost van Dijk 🚀", "Aylin Demir"]);
  assert.equal(names[19], "Lars Hoekstra", "Lars sits where the search found him, not where his promotion put him");
  assert.equal(names[22], "Yara Haddad");
  assert.equal(dataset!.records!.find((record) => record.name === "Lotte Jansen")?.location, "Rotterdam, Zuid-Holland, Nederland");
  assert.equal(resolveScenarioWorkflow(manifest, { workflowId: "people-search", variantId: "premium-upsell" }).expected.extracted?.[0]?.records?.length, 23);
});

test("results pages carry the ad, promoted profiles, a repeat and a module that no oracle counts", () => {
  const pages = [1, 2, 3].map((number) => peopleResultsPage({ ...ROTTERDAM_ENGINEERS, page: number }));
  assert.deepEqual(pages.map(({ pageCount }) => pageCount), [3, 3, 3]);
  assert.deepEqual(pages[0]!.entries.map(({ kind }) => kind), ["organic", "organic", "organic", "ad", "organic", "organic", "organic", "organic", "promoted", "organic", "organic", "organic"]);
  const promoted = pages.flatMap(({ entries }) => entries.flatMap((entry) => (entry.kind === "promoted" ? [entry.member.name] : [])));
  assert.deepEqual(promoted, ["Sanne de Wit", "Lars Hoekstra"]);
  const third = pages[2]!.entries.flatMap((entry) => (entry.kind === "organic" ? [entry.member.name] : []));
  assert.deepEqual(third, ["Lars Hoekstra", "Ewa Kowalczyk", "Matteo Ricci", "Yara Haddad"]);
  assert.equal(pages[1]!.entries.filter(({ kind }) => kind === "suggestions").length, 1);
});

test("the withdrawal goal is an exact set: twelve connection requests gone, every other invitation still there", () => {
  const stale = staleConnectionRequests();
  assert.equal(stale.length, 12);
  assert.ok(stale.every(({ kind, days }) => kind === "person" && days >= 33));
  assert.ok(SENT_INVITATIONS.some(({ kind, days }) => kind !== "person" && days >= 30), "month-old page and newsletter invitations exist and must stay");
  assert.ok(SENT_INVITATIONS.some(({ kind, days }) => kind === "person" && days === 28), "a four-week-old request exists and must stay");
  const before = JSON.parse(STORE_AT_START) as { received: string[]; sent: string[] };
  const after = JSON.parse(STORE_AFTER_WITHDRAWAL) as { received: string[]; sent: string[] };
  assert.equal(before.sent.length, 36);
  assert.equal(before.received.length, RECEIVED_INVITATIONS.length);
  assert.deepEqual(after.received, before.received);
  assert.deepEqual(before.sent.filter((urn) => !after.sent.includes(urn)).sort(), stale.map(({ urn }) => urn).sort());
  assert.equal(manifest.playbackGoal?.successFacts[0]?.value, STORE_AFTER_WITHDRAWAL);
});

test("ages read the way the page words them, measured from the fixed reference time", () => {
  const label = (days: number) => timeAgoLabel(sentAtIso(days), REFERENCE_NOW_MS);
  assert.deepEqual([0, 1, 3, 8, 21, 28, 33, 61, 240].map(label), ["today", "yesterday", "3 days ago", "1 week ago", "3 weeks ago", "4 weeks ago", "1 month ago", "2 months ago", "8 months ago"]);
});

test("the start page renders the store, the hooked dialog, and none of the task's words in its class names", () => {
  const html = start();
  assert.equal(storeOf(html), STORE_AT_START);
  assert.match(html, /data-testid="withdraw-confirm">Withdraw<\/button>/u);
  assert.equal((markupOnly(html).match(/data-testid=/gu) ?? []).length, 2, "only the store and the one shared dialog hook carry test ids");
  const classes = new Set([...html.matchAll(/class="([^"]+)"/gu)].flatMap((match) => match[1]!.split(" ")));
  assert.ok(classes.size > 20);
  for (const name of classes) assert.match(name, /^css-[a-z0-9]{7}$/u, `class ${name} reads as authored`);
  const drifted = start(mutate(createState(4303), "set-mode", { mode: "redesigned-withdraw-dialog" }));
  assert.doesNotMatch(drifted, /data-testid="withdraw-confirm"/u);
  assert.match(drifted, />Withdraw invitation<\/button><button[^>]*>Keep invitation<\/button>/u);
});

test("class names and element ids change with the seed; text does not", () => {
  const a = start(createState(4303), 42);
  const b = start(createState(4303), 43);
  const classesOf = (html: string) => [...html.matchAll(/class="([^"]+)"/gu)].map((match) => match[1]);
  const idsOf = (html: string) => [...html.matchAll(/id="(ember\d+)"/gu)].map((match) => match[1]);
  assert.notDeepEqual(classesOf(a), classesOf(b));
  assert.notDeepEqual(idsOf(a), idsOf(b));
  const text = (html: string) => html.replace(/<style>[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gu, "").replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ");
  assert.equal(text(a), text(b));
  assert.equal(start(createState(4303), 42), start(createState(4303), 42), "one seed renders one page");
});

test("withdrawals, answers and connection requests change the store only when the page could have sent them", () => {
  const [stale] = staleConnectionRequests();
  let state = mutate(createState(4303), "withdraw-invitation", { urn: stale!.urn });
  assert.ok(!state.store.sent.includes(stale!.urn));
  assert.equal(mutate(state, "withdraw-invitation", { urn: stale!.urn }), state, "a second withdrawal is refused");
  assert.equal(mutate(state, "withdraw-invitation", { urn: "urn:gl:invitation:0" }), state);
  state = mutate(state, "ignore-invitation", { urn: RECEIVED_INVITATIONS[0]!.urn });
  assert.ok(!state.store.received.includes(RECEIVED_INVITATIONS[0]!.urn));
  const mara = MEMBERS.find(({ name }) => name === "Mara Okafor")!;
  const flagged = mutate(state, "send-invitation", { memberUrn: mara.urn, note: "Hi Mara", website: "https://example.test" });
  assert.equal(flagged.sentByRun.at(-1)?.flagged, true);
  assert.deepEqual(flagged.store, state.store, "a honeypot submission is acknowledged and never stored");
  const sent = mutate(state, "send-invitation", { memberUrn: mara.urn, note: "Hi Mara", website: "" });
  assert.equal(sent.store.sent.length, state.store.sent.length + 1);
  assert.equal(mutate(sent, "send-invitation", { memberUrn: mara.urn, note: "", website: "" }), sent, "one pending request per person");
  const wouter = MEMBERS.find(({ name }) => name === "Wouter de Boer")!;
  assert.equal(mutate(state, "send-invitation", { memberUrn: wouter.urn, note: "", website: "" }), state, "a first connection cannot be invited");
  const armed = mutate(sent, "set-mode", { mode: "premium-upsell" });
  assert.deepEqual(armed.store, createState(4303).store, "arming starts the session over");
  assert.equal(armed.mode, "premium-upsell");
});

test("the search asks for a check after three results requests inside three seconds, and never at a reading pace", () => {
  assert.equal(searchChallenged([1_000, 1_800, 2_600], 3_400), true);
  assert.equal(searchChallenged([1_000, 1_800, 2_600], 4_100), false);
  assert.equal(searchChallenged([0, 3_100, 6_200, 9_300], 12_400), false);
  let state: ProfessionalNetworkState = createState(4303);
  for (const at of [1, 2, 3]) state = mutate(state, "search-hit", { at: Date.now() - at });
  const answer = page("search/results/people/fragment", state, 4303, "keywords=data%20engineer");
  assert.equal(answer?.status, 429);
  assert.equal(answer?.headers?.["retry-after"], "5");
  assert.equal(answer?.mutation?.operation, "search-challenged");
  const served = page("search/results/people/fragment", createState(4303), 4303, "keywords=data%20engineer");
  assert.equal(served?.status, 200);
  assert.equal(served?.mutation?.operation, "search-hit");
});

test("every page the navigation reaches renders in the shell with the store, and unknown paths are 404s", () => {
  const profile = MEMBERS.find(({ name }) => name === "Mara Okafor")!;
  for (const subpath of ["mynetwork/", "mynetwork/invitation-manager/", "mynetwork/invitation-manager/sent/", "search/results/all/", "search/results/people/", "jobs/", "messaging/", "notifications/", "premium/", "premium/checkout/", "app/", "settings/", "signed-out/", "in/me/", `in/${profile.slug}/`]) {
    const response = page(subpath);
    assert.equal(response?.status, 200, subpath);
    assert.equal(storeOf(response?.body ?? ""), STORE_AT_START, subpath);
  }
  assert.equal(page("in/nobody-000000/"), undefined);
  assert.equal(page("wp-admin/"), undefined);
  assert.match(page(`in/${profile.slug}/`)?.body ?? "", /<template shadowrootmode="open">/u);
  const sent = page("mynetwork/invitation-manager/sent/")?.body ?? "";
  assert.equal((sent.match(/<gl-time-ago /gu) ?? []).length, 10);
  assert.doesNotMatch(markupOnly(sent), /month ago|weeks ago/u, "ages live only in shadow roots");
  assert.equal(invitationStoreText(invitationStore({ withdrawn: [], accepted: [], ignored: [], sentByRun: [] })), STORE_AT_START);
});
