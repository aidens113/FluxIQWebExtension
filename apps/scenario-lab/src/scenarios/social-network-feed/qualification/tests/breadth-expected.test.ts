import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExpectedFact, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { communityBySlug, FEED_BEFORE_CAUGHT_UP, feedPlanFor, FRIEND_REQUESTS, fullDateText, personBySlug, REFERENCE_NOW_MS } from "../../content/index.js";
import { SOCIAL_NETWORK_FEED_TASKS } from "../../live-tasks.js";
import { MEMBER_GROUPS } from "../../markup/index.js";
import { accountChanges, ACCOUNT_CHANGES_SUBJECT } from "../../oracle/index.js";
import { socialNetworkFeedScenario as scenario } from "../../scenario.js";
import type { FeedState } from "../../types.js";
import { CLAIM_KEY_TEXT, claimFoundKeyWorkflow, deleteStrangerRequestsWorkflow, hideSuggestedPostsWorkflow, recentGroupPostsWorkflow } from "../index.js";

// The four breadth workflows' oracles, against the authored content and the
// server's own state. Each expected record is worked out here again from the
// content, and each final state is reached by the mutations an honest run
// sends -- and missed by the ones a careless run sends.

const context = { runToken: "social-network-feed-breadth-token", seed: 5101, alternateOrigin: "http://127.0.0.1:9" };
const fresh = () => scenario.createState(scenario.seed);
const apply = (state: FeedState, ...steps: ReadonlyArray<readonly [string, unknown]>) => steps.reduce((current, [operation, payload]) => scenario.mutate(current, operation, payload), state);
const BREADTH = [recentGroupPostsWorkflow, hideSuggestedPostsWorkflow, deleteStrangerRequestsWorkflow, claimFoundKeyWorkflow];
const accountFact = (facts: readonly ExpectedFact[] | undefined) => facts?.find(({ subject }) => subject === ACCOUNT_CHANGES_SUBJECT);
const finalAccount = (workflow: ScenarioWorkflow) => accountFact(workflow.expected.finalState)?.value;
const records = (workflow: ScenarioWorkflow) => workflow.expected.extracted?.[0]?.records;
const beforeCaughtUp = () => {
  const plan = feedPlanFor({ mode: "baseline", created: [], trashed: [], hidden: [] });
  return plan.batches.slice(0, plan.caughtUpAfter + 1).flat();
};
const positionsIn = (target: string | undefined) => [...(target ?? "").matchAll(/aria-posinset="(\d+)"/gu)].map((match) => Number(match[1]));
const extractStep = (workflow: ScenarioWorkflow) => workflow.recordingScript.find(({ operation }) => operation === "extract");

test("breadth: every workflow starts from the untouched account the page renders, and names a registered task", () => {
  const html = scenario.render(fresh(), context);
  const rendered = new RegExp(`data-testid="${ACCOUNT_CHANGES_SUBJECT}">([^<]*)<`, "u").exec(html)?.[1];
  assert.equal(rendered, accountChanges(fresh()));
  for (const workflow of BREADTH) {
    assert.equal(accountFact(workflow.expected.pageFacts)?.value, accountChanges(fresh()), workflow.id);
    const entry = workflow.expected.extracted?.[0];
    assert.ok(entry?.records && entry.records.length > 0 && entry.count === entry.records.length, workflow.id);
    assert.ok(SOCIAL_NETWORK_FEED_TASKS.some((task) => task.expectedDatasetId === entry.step), `${workflow.id}: no task names ${entry.step}`);
  }
  assert.match(html, /changes\.textContent = oracleAccountChanges\(result\.state\)/u, "the client rewrites the element after every change");
});

test("breadth: recent group posts are the feed's posts from Maya's groups since Saturday 19 September, once each", () => {
  const since = (REFERENCE_NOW_MS - Date.UTC(2026, 8, 19)) / 60_000;
  const picked = beforeCaughtUp().flatMap(({ unit, position }) => (unit.kind === "post" && unit.group !== undefined && MEMBER_GROUPS.includes(unit.group) && unit.minutesAgo <= since ? [{ unit, position }] : []));
  assert.deepEqual(records(recentGroupPostsWorkflow), picked.map(({ unit }) => ({
    group: communityBySlug(unit.group!).name, author: personBySlug(unit.author).name, posted: fullDateText(unit.minutesAgo), text: unit.text, comments: unit.comments,
  })));
  assert.deepEqual(positionsIn(extractStep(recentGroupPostsWorkflow)?.target), picked.map(({ position }) => position));
  assert.equal(finalAccount(recentGroupPostsWorkflow), accountChanges(fresh()));
  assert.notEqual(accountChanges(apply(fresh(), ["hide-post", { id: "p_7c1e44" }])), finalAccount(recentGroupPostsWorkflow), "a read that also hid a post fails");
});

test("breadth: hiding the two suggested posts holds in either order, and an extra hide, a miss or an undo fails", () => {
  const suggested = beforeCaughtUp().flatMap(({ unit, position }) => (unit.kind === "suggested" ? [{ unit, position }] : []));
  assert.deepEqual(records(hideSuggestedPostsWorkflow), suggested.map(({ unit }) => ({ community: communityBySlug(unit.community).name, text: unit.text })));
  assert.deepEqual(positionsIn(extractStep(hideSuggestedPostsWorkflow)?.target), suggested.map(({ position }) => position));
  const hide = (id: string) => ["hide-post", { id }] as const;
  const [first, second] = suggested.map(({ unit }) => unit.id) as [string, string];
  const expected = finalAccount(hideSuggestedPostsWorkflow);
  assert.equal(accountChanges(apply(fresh(), hide(first), hide(second))), expected);
  assert.equal(accountChanges(apply(fresh(), hide(second), hide(first))), expected);
  assert.notEqual(accountChanges(apply(fresh(), hide(first), hide(second), hide("h_b71d09"))), expected, "a friend's share hidden too");
  assert.notEqual(accountChanges(apply(fresh(), hide(first), hide(second), hide("g_7e2b90"))), expected, "a suggestion below the end of the feed hidden too");
  assert.notEqual(accountChanges(apply(fresh(), hide(first))), expected, "one missed");
  assert.notEqual(accountChanges(apply(fresh(), hide(first), hide(second), ["unhide-post", { id: second }])), expected, "one undone");
});

test("breadth: only the request with no mutual friends is deleted, and deleting or confirming anyone else fails", () => {
  const strangers = FRIEND_REQUESTS.filter(({ mutualCount }) => mutualCount === 0);
  assert.deepEqual(records(deleteStrangerRequestsWorkflow), strangers.map(({ person }) => ({ name: personBySlug(person).name, url: `/scenarios/social-network-feed/people/${person}/` })));
  assert.ok(FRIEND_REQUESTS.indexOf(strangers[0]!) >= 4, "past the four-card preview");
  const expected = finalAccount(deleteStrangerRequestsWorkflow);
  const remove = (id: string) => ["delete-request", { id }] as const;
  assert.equal(accountChanges(apply(fresh(), remove(strangers[0]!.id))), expected);
  assert.notEqual(accountChanges(apply(fresh(), remove(strangers[0]!.id), remove("rq_52e0a1"))), expected, "the second Tom Becker has one mutual friend");
  assert.notEqual(accountChanges(apply(fresh(), ["confirm-request", { id: strangers[0]!.id }])), expected, "confirmed instead");
  assert.notEqual(accountChanges(apply(fresh(), remove(strangers[0]!.id), ["confirm-request", { id: "rq_8b41c7" }])), expected, "confirmed someone as well");
});

test("breadth: the key claim waits in Harbourside Runners, word for word, once; any other group, kind or spam fails", () => {
  const found = FEED_BEFORE_CAUGHT_UP.filter((unit) => unit.kind === "post" && unit.group === "harbourside-runners" && unit.text.includes("car key"));
  assert.equal(found.length, 1);
  const [post] = found as [Extract<(typeof found)[number], { kind: "post" }>];
  assert.deepEqual(records(claimFoundKeyWorkflow), [{ author: personBySlug(post.author).name, posted: fullDateText(post.minutesAgo), text: post.text }]);
  const claim = (group: string, kind = "post", website = "") => ["group-post", { group, kind, text: `${CLAIM_KEY_TEXT}\n`, website }] as const;
  const expected = finalAccount(claimFoundKeyWorkflow);
  assert.equal(accountChanges(apply(fresh(), claim("harbourside-runners"))), expected);
  assert.notEqual(accountChanges(apply(fresh(), claim("riverside-allotments"))), expected, "the wrong group");
  assert.notEqual(accountChanges(apply(fresh(), claim("harbourside-runners", "poll"))), expected, "a poll");
  assert.notEqual(accountChanges(apply(fresh(), claim("harbourside-runners", "post", "https://example.test"))), expected, "the trap field filled");
  assert.notEqual(accountChanges(apply(fresh(), claim("harbourside-runners"), claim("harbourside-runners"))), expected, "posted twice");
  assert.notEqual(accountChanges(fresh()), expected, "a single swallowed press posts nothing");
});
