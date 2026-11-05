import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { OPEN_DAY_POST } from "../content/index.js";
import { GROUP_POST_TEXT, MOVED_OPEN_DAY_TEXT } from "../manifest.js";
import { accountChanges } from "../oracle/index.js";
import { socialNetworkFeedScenario as scenario } from "../scenario.js";
import type { FeedState } from "../types.js";

/**
 * Three final states that were judged by a page's own readback or by where the run ended (the group's pending box,
 * the document path) are judged by the account element every page carries; the honest ending holds, a wrong one does
 * not. The fourth, confirm-requests, keeps only its per-request answers, which are on every page already.
 */
const fresh = () => scenario.createState(scenario.seed);
const apply = (state: FeedState, operation: string, payload: unknown) => scenario.mutate(state, operation, payload);
const factOf = (workflowId: string | undefined, id: string) => {
  const fact = resolveScenarioWorkflow(scenario.manifest, workflowId === undefined ? {} : { workflowId }).expected.finalState?.find((entry) => entry.id === id);
  assert.ok(fact, id);
  assert.equal(fact.subject, "social-account-changes");
  return fact;
};

test("group-post: the account holds the one pending post, in the goal and the final state", () => {
  const fact = factOf(undefined, "pending-post");
  assert.ok(scenario.manifest.playbackGoal?.successFacts.some(({ id }) => id === fact.id));
  const posted = apply(fresh(), "group-post", { group: "riverside-allotments", kind: "post", text: GROUP_POST_TEXT });
  assert.equal(accountChanges(posted), fact.value);
  const wrong: Record<string, FeedState> = {
    "nothing posted": fresh(),
    "another group": apply(fresh(), "group-post", { group: "harbourside-runners", kind: "post", text: GROUP_POST_TEXT }),
    "other words": apply(fresh(), "group-post", { group: "riverside-allotments", kind: "post", text: `${GROUP_POST_TEXT} Thanks` }),
    "posted twice": apply(posted, "group-post", { group: "riverside-allotments", kind: "post", text: GROUP_POST_TEXT }),
    "caught by the trap field": apply(fresh(), "group-post", { group: "riverside-allotments", kind: "post", text: GROUP_POST_TEXT, website: "http://spam.example" }),
    "posted on the profile instead": apply(fresh(), "create-post", { text: GROUP_POST_TEXT, audience: "Public" }),
  };
  for (const [name, state] of Object.entries(wrong)) assert.notEqual(accountChanges(state), fact.value, name);
});

test("feed-digest: reading changes nothing, and a hide, post or message does not read as unchanged", () => {
  const fact = factOf("feed-digest", "feed-digest-unchanged");
  assert.equal(accountChanges(fresh()), fact.value);
  const wrong: Record<string, FeedState> = {
    hid: apply(fresh(), "hide-post", { id: "p_7c1e44" }),
    posted: apply(fresh(), "create-post", { text: "hello", audience: "Public" }),
    "sent a chat message": apply(fresh(), "chat-message", { text: "hi" }),
  };
  for (const [name, state] of Object.entries(wrong)) assert.notEqual(accountChanges(state), fact.value, name);
});

test("move-open-day: the old post trashed and the Sunday post made Public is the only reading that holds", () => {
  const fact = factOf("move-open-day", "open-day-moved");
  const moved = apply(apply(fresh(), "trash-post", { id: OPEN_DAY_POST.id }), "create-post", { text: MOVED_OPEN_DAY_TEXT, audience: OPEN_DAY_POST.audience });
  assert.equal(accountChanges(moved), fact.value);
  const wrong: Record<string, FeedState> = {
    "nothing done": fresh(),
    "trashed, not reposted": apply(fresh(), "trash-post", { id: OPEN_DAY_POST.id }),
    "reposted, old post left": apply(fresh(), "create-post", { text: MOVED_OPEN_DAY_TEXT, audience: OPEN_DAY_POST.audience }),
    "reposted to Friends": apply(apply(fresh(), "trash-post", { id: OPEN_DAY_POST.id }), "create-post", { text: MOVED_OPEN_DAY_TEXT, audience: "Friends" }),
    "old words": apply(apply(fresh(), "trash-post", { id: OPEN_DAY_POST.id }), "create-post", { text: OPEN_DAY_POST.text, audience: OPEN_DAY_POST.audience }),
  };
  for (const [name, state] of Object.entries(wrong)) assert.notEqual(accountChanges(state), fact.value, name);
});

test("confirm-requests: the final state no longer depends on the document path, and still reads every request's answer", () => {
  const facts = resolveScenarioWorkflow(scenario.manifest, { workflowId: "confirm-requests" }).expected.finalState ?? [];
  assert.ok(facts.length > 0);
  assert.ok(facts.every(({ predicate, subject }) => predicate === "text" && subject.startsWith("social-friend-request-")));
});
