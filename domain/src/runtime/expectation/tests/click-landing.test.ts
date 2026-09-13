// The path a recorded click claims it landed on (W19, design D1).
//
// Every click and landing below is built by the domain's own recording event
// builder, so each row carries the event id and sequence the extension really
// sends. No row spells an event id out.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationRecordingEvent } from "../../../client";
import { webAutomationClickLandingExpectation } from "../click-landing";

type Step = Parameters<typeof webAutomationClickLandingExpectation>[0];

const SIGN_IN = "https://example.test/scenarios/auth-gate/sign-in";
const ACCOUNT = "https://example.test/scenarios/auth-gate/account";

function urlClaim(expected: string): JsonObject {
  return { conditions: [{ assert: { kind: "url", expected } }], mode: "all", timeoutMs: 5_000 };
}

/** A recorded click and the event id it was sent under. */
function click(sequence: number, timestamp: number, input: { url?: string; sourceId?: string } = {}): { step: Step; eventId: string } {
  const wire = createWebAutomationRecordingEvent({
    kind: "dom.click",
    sequence,
    url: input.url ?? SIGN_IN,
    title: "Sign in",
    eventTimestampMs: timestamp,
    element: { selector: "#continue", tagName: "button", text: "Continue" }
  });
  const metadata = { ...(wire.metadata ?? {}), ...(input.sourceId === undefined ? {} : { sourceId: input.sourceId }) };
  assert.ok(wire.eventId, "the builder names every recording event");
  return { step: { eventType: wire.eventType, timestamp, payload: wire.payload ?? {}, metadata }, eventId: wire.eventId };
}

/** A navigation the recorder saw commit, carrying the explanation metadata it was sent with. */
function navigation(url: string, metadata: JsonObject): Step {
  const wire = createWebAutomationRecordingEvent({ kind: "browser.navigation", sequence: 0, url, title: "", eventTimestampMs: 2_000, metadata });
  return { eventType: wire.eventType, timestamp: 2_000, payload: wire.payload ?? {}, metadata: wire.metadata ?? {} };
}

function landing(url: string, eventId: string): Step {
  return navigation(url, { transition: "explained", explainedBy: 0, explainedByEventId: eventId });
}

test("a click whose landing names its event id claims exactly the landing's path", () => {
  const signIn = click(3, 900);
  assert.deepEqual(webAutomationClickLandingExpectation(signIn.step, [landing(ACCOUNT, signIn.eventId)]), urlClaim("/scenarios/auth-gate/account"));
});

test("the claim is the path only: the query and hash are dropped", () => {
  const signIn = click(3, 900);
  assert.deepEqual(webAutomationClickLandingExpectation(signIn.step, [landing(`${ACCOUNT}?welcome=1#profile`, signIn.eventId)]), urlClaim("/scenarios/auth-gate/account"));
});

test("a landing that names another click's event id claims nothing", () => {
  const signIn = click(3, 900);
  const other = click(3, 901);
  assert.equal(webAutomationClickLandingExpectation(signIn.step, [landing(ACCOUNT, other.eventId)]), undefined);
});

test("a typed navigation is not a landing, even when it names the click", () => {
  const signIn = click(3, 900);
  const typed = navigation(ACCOUNT, { transition: "typed", explainedBy: 3, explainedByEventId: signIn.eventId });
  assert.equal(webAutomationClickLandingExpectation(signIn.step, [typed]), undefined);
});

test("no following landing claims nothing", () => {
  assert.equal(webAutomationClickLandingExpectation(click(3, 900).step, []), undefined);
});

test("a landing on the click page's own path claims nothing", () => {
  const signIn = click(3, 900);
  assert.equal(webAutomationClickLandingExpectation(signIn.step, [landing(`${SIGN_IN}?error=1`, signIn.eventId)]), undefined);
});

test("a landing on / claims nothing", () => {
  const signIn = click(3, 900);
  assert.equal(webAutomationClickLandingExpectation(signIn.step, [landing("https://example.test/", signIn.eventId)]), undefined);
});

test("a landing whose URL cannot be parsed claims nothing", () => {
  const signIn = click(3, 900);
  assert.equal(webAutomationClickLandingExpectation(signIn.step, [landing("not a url", signIn.eventId)]), undefined);
  assert.equal(webAutomationClickLandingExpectation(signIn.step, [landing("about:blank", signIn.eventId)]), undefined, "an opaque URL has no path to claim");
});

test("two clicks sharing a sequence each claim their own landing", () => {
  const first = click(1, 100);
  const second = click(1, 900, { url: ACCOUNT });
  const firstLanding = landing(ACCOUNT, first.eventId);
  const secondLanding = landing("https://example.test/scenarios/auth-gate/settings", second.eventId);
  assert.deepEqual(webAutomationClickLandingExpectation(first.step, [firstLanding, second.step, secondLanding]), urlClaim("/scenarios/auth-gate/account"));
  assert.deepEqual(webAutomationClickLandingExpectation(second.step, [secondLanding]), urlClaim("/scenarios/auth-gate/settings"));
});

test("two landings for one click give the last", () => {
  const signIn = click(3, 900);
  const interstitial = landing("https://example.test/scenarios/auth-gate/checking", signIn.eventId);
  assert.deepEqual(webAutomationClickLandingExpectation(signIn.step, [interstitial, landing(ACCOUNT, signIn.eventId)]), urlClaim("/scenarios/auth-gate/account"));
  assert.equal(webAutomationClickLandingExpectation(signIn.step, [landing(ACCOUNT, signIn.eventId), landing(SIGN_IN, signIn.eventId)]), undefined, "the page settled back where it started, so the claim would prove nothing");
});

test("a landing with no event id names the nearest preceding click in its tab with that sequence", () => {
  const signIn = click(3, 900, { sourceId: "tab:7:frame:0" });
  const byTab = navigation(ACCOUNT, { transition: "explained", explainedBy: 3, sourceId: "tab:7" });
  assert.deepEqual(webAutomationClickLandingExpectation(signIn.step, [byTab]), urlClaim("/scenarios/auth-gate/account"));

  const nearer = click(3, 950, { url: SIGN_IN, sourceId: "tab:7:frame:0" });
  assert.equal(webAutomationClickLandingExpectation(signIn.step, [nearer.step, byTab]), undefined, "a nearer click in the tab with the same sequence owns the landing");
  assert.deepEqual(webAutomationClickLandingExpectation(nearer.step, [byTab]), urlClaim("/scenarios/auth-gate/account"));

  const otherTab = click(3, 950, { sourceId: "tab:8:frame:0" });
  assert.deepEqual(webAutomationClickLandingExpectation(signIn.step, [otherTab.step, byTab]), urlClaim("/scenarios/auth-gate/account"), "a click in another tab does not");
});

test("a landing with no event id and no tab to compare claims nothing", () => {
  const signIn = click(3, 900);
  assert.equal(webAutomationClickLandingExpectation(signIn.step, [navigation(ACCOUNT, { transition: "explained", explainedBy: 3 })]), undefined);
  const inTab = click(3, 900, { sourceId: "tab:7:frame:0" });
  assert.equal(webAutomationClickLandingExpectation(inTab.step, [navigation(ACCOUNT, { transition: "explained", explainedBy: 4, sourceId: "tab:7" })]), undefined, "another sequence names another click");
});

/** A click recorded through its action input, as Core's `action` entry: no page URL, no sequence, and the event id it was sent under kept on its metadata. */
function storedClick(eventId?: string, payload: JsonObject = {}): Step {
  const entry = { type: "action", actionType: "web.dom.click", outputId: "web.dom.click", parameters: { selector: "#continue" }, ...payload };
  return { eventType: "action", timestamp: 1_789_000_000_000, payload: entry, metadata: { sourceId: "tab:7:frame:0", ...(eventId === undefined ? {} : { eventId }) } };
}

test("a click's action entry claims the landing that names its stored event id", () => {
  const signIn = click(3, 900);
  assert.deepEqual(webAutomationClickLandingExpectation(storedClick(signIn.eventId), [landing(ACCOUNT, signIn.eventId)]), urlClaim("/scenarios/auth-gate/account"));
  assert.deepEqual(webAutomationClickLandingExpectation(storedClick(signIn.eventId), [landing(`${SIGN_IN}?error=1`, signIn.eventId)]), urlClaim("/scenarios/auth-gate/sign-in"), "the entry names no page, so a landing on the click page's own path is still claimed");
  assert.equal(webAutomationClickLandingExpectation(storedClick(signIn.eventId), [landing("https://example.test/", signIn.eventId)]), undefined, "a landing on / still claims nothing");
});

test("a click's action entry is named by its stored event id alone", () => {
  const signIn = click(3, 900);
  assert.equal(webAutomationClickLandingExpectation(storedClick(click(3, 901).eventId), [landing(ACCOUNT, signIn.eventId)]), undefined, "a landing naming another click's id");
  assert.equal(webAutomationClickLandingExpectation(storedClick(), [landing(ACCOUNT, signIn.eventId)]), undefined, "an entry with no stored id");
  assert.equal(webAutomationClickLandingExpectation(storedClick(" "), [landing(ACCOUNT, " ")]), undefined, "a blank id names nothing");
  assert.equal(webAutomationClickLandingExpectation(storedClick(signIn.eventId, { sequence: 3 }), [navigation(ACCOUNT, { transition: "explained", explainedBy: 3, sourceId: "tab:7" })]), undefined, "a landing with no event id names no entry by sequence and tab");
});
