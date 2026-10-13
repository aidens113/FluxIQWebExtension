import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, type ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { FRIEND_REQUESTS } from "../content/index.js";
import { socialNetworkFeedScenario as scenario } from "../scenario.js";
import type { FeedState } from "../types.js";

// The confirm-requests oracle judges what the server did, not what the page's
// table says. A Flow that confirmed all eight requests and filtered its final
// read to the four with five or more mutual friends stored exactly the
// expected records (run-mv6bg8sv-99895ba1, D6); only these facts tell it from
// the honest run.

const context = { runToken: "social-network-feed-oracle-token", seed: 5101, alternateOrigin: "http://127.0.0.1:9" };
const REQUESTS_PATH = "/scenarios/social-network-feed/friends/requests/";
const fresh = () => scenario.createState(scenario.seed);
const answer = (state: FeedState, operation: "confirm-request" | "delete-request", ids: readonly string[]) =>
  ids.reduce((current, id) => scenario.mutate(current, operation, { id }), state);
const qualifying = FRIEND_REQUESTS.filter(({ mutualCount }) => mutualCount >= 5).map(({ id }) => id);
const others = FRIEND_REQUESTS.filter(({ mutualCount }) => mutualCount < 5).map(({ id }) => id);
const finalState = (): readonly ExpectedFact[] => resolveScenarioWorkflow(scenario.manifest, { workflowId: "confirm-requests" }).expected.finalState ?? [];

/** The text of the element carrying `data-testid="<subject>"` in the served document, as the Lab's probe reads it. */
function subjectText(html: string, subject: string): string | null {
  const match = new RegExp(`<[^>]*data-testid="${subject}"[^>]*>([^<]*)<`, "u").exec(html);
  return match ? (match[1] ?? "") : null;
}

/** The ids of the final-state facts that do not hold on the requests page after `state`, judged as the Lab's fact probe judges them. */
function unheld(state: FeedState): string[] {
  const html = scenario.route?.(state, { subpath: "friends/requests/", query: new URLSearchParams(), method: "GET" }, context)?.body ?? "";
  return finalState().filter((fact) => {
    if (fact.predicate === "path") return fact.value !== REQUESTS_PATH;
    const text = subjectText(html, fact.subject);
    if (fact.predicate === "contains") return text === null || typeof fact.value !== "string" || !text.includes(fact.value);
    if (fact.predicate === "text") return text?.trim() !== fact.value;
    throw new Error(`unexpected predicate ${fact.predicate} on ${fact.id}`);
  }).map(({ id }) => id);
}

test("the oracle declares a server-state fact for each of the eight requests", () => {
  const server = finalState().filter(({ subject }) => subject.startsWith("social-friend-request-"));
  assert.deepEqual(server.map(({ subject }) => subject), FRIEND_REQUESTS.map(({ id }) => `social-friend-request-${id}`));
  assert.ok(server.every(({ predicate }) => predicate === "text"), "judged by whole text, which every fact evaluator supports");
  assert.deepEqual(qualifying, ["rq_8b41c7", "rq_c7a0e5", "rq_e24f90", "rq_7a95b3"]);
});

test("the honest run, confirming exactly the four qualifying requests, holds every fact", () => {
  assert.deepEqual(unheld(answer(fresh(), "confirm-request", qualifying)), []);
  // A second press on an answered request changes nothing on the server, so each is confirmed once.
  assert.deepEqual(unheld(answer(answer(fresh(), "confirm-request", qualifying), "confirm-request", qualifying)), []);
});

test("a run that confirms all eight fails, naming each request it should have left pending", () => {
  const overConfirmed = answer(fresh(), "confirm-request", [...qualifying, ...others]);
  const failed = unheld(overConfirmed);
  assert.equal(failed.length, others.length);
  for (const id of others) {
    const person = FRIEND_REQUESTS.find((request) => request.id === id)!.person;
    assert.ok(failed.some((factId) => factId.includes(person)), `${person} is named`);
  }
});

test("a run that confirms one extra, deletes one it should leave, or misses one fails", () => {
  assert.equal(unheld(answer(fresh(), "confirm-request", [...qualifying, others[0]!])).length, 1);
  assert.equal(unheld(answer(answer(fresh(), "confirm-request", qualifying), "delete-request", [others[1]!])).length, 1);
  assert.equal(unheld(answer(fresh(), "confirm-request", qualifying.slice(0, 3))).length, 1);
  assert.equal(unheld(fresh()).length, qualifying.length, "a run that did nothing has confirmed no one");
});

test("the page keeps the server-state element current after each answer, as the server renders it", () => {
  const html = scenario.route?.(fresh(), { subpath: "friends/requests/", query: new URLSearchParams(), method: "GET" }, context)?.body ?? "";
  assert.match(html, /answer\.textContent = oracleRequestAnswer\(result\.state\.requests, id\)/u, "the client rewrites each element after every mutation");
  const after = scenario.route?.(answer(fresh(), "confirm-request", qualifying), { subpath: "friends/requests/", query: new URLSearchParams(), method: "GET" }, context)?.body ?? "";
  const served = FRIEND_REQUESTS.map(({ id }) => subjectText(after, `social-friend-request-${id}`));
  assert.deepEqual(served, FRIEND_REQUESTS.map(({ mutualCount }) => (mutualCount >= 5 ? "confirmed" : "pending")));
});
