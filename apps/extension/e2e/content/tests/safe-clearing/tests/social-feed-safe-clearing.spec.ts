// The interference clearing presses only a way out, never an act, and never
// closes the dialog a step is aimed at -- on social-network-feed, through the
// real content-script bundle (T2 harness: no background worker, no Core, no
// model). The oracle is the Scenario Lab's own server state.
//
// Both rows come from the provider-free recovery matrix (t399, row 13a/13b):
//
// - The fourth Confirm inside the site's window is refused with "You're going
//   too fast" and an OK. When its count reaches zero a "Try again" appears
//   beside the OK, and "Try again" confirms the request the refused press was
//   for. The node's retry after the wait met that notice over its target; the
//   clearing must close it by its OK, so the retry's own press is the one that
//   confirms, and the result says so (t401).
// - The notification prompt's "Not now" is a step's own target. The clearing
//   between that step's attempts must not close the prompt it is aimed at.

import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

type FeedState = {
  notificationsPrompt: "pending" | "dismissed" | "allowed";
  requests: Record<string, "confirmed" | "deleted">;
  rateLimited: number;
};

const ROOT = "/scenarios/social-network-feed/";

const actualOf = (reply: BrowserActionResult): string =>
  reply.failure?.actual ?? (reply.validation.status === "none" ? "" : reply.validation.actual);

async function apply(harness: ContentHarness, operation: string, payload: object): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

async function openAndWait(harness: ContentHarness, path: string): Promise<void> {
  await harness.page.goto(new URL(path, harness.lab.origin).href);
  await expect
    .poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady"))
    .toBe(true);
}

const state = async (harness: ContentHarness): Promise<FeedState> => (await harness.finalState()).state as unknown as FeedState;

const confirmOf = (person: string): string => `[role="listitem"]:has(a[href$="/people/${person}/"]) [aria-label="Confirm"]`;

test("a rate-limit notice offering OK and Try again is closed by its OK; the node's own press confirms", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("social-network-feed");
  await apply(harness, "consent", { choice: "all" });
  await apply(harness, "notifications", { choice: "dismissed" });
  await apply(harness, "chat", { state: "closed" });
  await openAndWait(harness, `${ROOT}friends/requests/`);

  for (const person of ["amara-osei", "jonas-weber", "lin-zhao"]) {
    const reply = await harness.runAction({ commandId: `confirm-${person}`, actionType: "web.dom.click", selector: confirmOf(person), element: { selector: confirmOf(person) } });
    expect(reply.status, `${person}: ${actualOf(reply)}`).toBe("succeeded");
  }
  const refused = await harness.runAction({ commandId: "confirm-freya-1", actionType: "web.dom.click", selector: confirmOf("freya-holm"), element: { selector: confirmOf("freya-holm") } });
  expect(refused.failure?.code, actualOf(refused)).toBe("web.action.rate_limited");

  // Core waits out the notice; by the time its retry arrives the notice offers "Try again".
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible({ timeout: 20_000 });
  const retried = await harness.runAction({ commandId: "confirm-freya-2", actionType: "web.dom.click", selector: confirmOf("freya-holm"), element: { selector: confirmOf("freya-holm") } });

  const after = await state(harness);
  expect(retried.status, actualOf(retried)).toBe("succeeded");
  expect(actualOf(retried)).toMatch(/closing 1 dialog the page had put in the way/u);
  expect(after.requests["rq_7a95b3"]).toBe("confirmed");
  expect(after.rateLimited).toBe(1);
  // What the clearing pressed is said on the result, in closed words only.
  expect(retried.clearedLayers).toEqual([{ kind: "rate_limit", control: "OK" }]);
});

/** The prompt's footer's first button, as the matrix Flow addresses it, without the attribute the page never keeps. */
const NOT_NOW = '[role="dialog"][aria-modal="true"] > div:last-child > [role="button"]:first-child';

/** 13a/13b's own selector: `data-lb` is not on the rendered prompt, so it matches nothing. */
const NOT_NOW_UNMATCHED = '[role="dialog"][data-lb="dlg-t"] > div:last-child > [role="button"]:first-child';

async function promptUp(openHarness: (scenarioId: string) => Promise<ContentHarness>): Promise<ContentHarness> {
  const harness = await openHarness("social-network-feed");
  await apply(harness, "consent", { choice: "all" });
  await openAndWait(harness, ROOT);
  await expect(harness.page.getByRole("dialog", { name: "Turn on notifications?" })).toBeVisible({ timeout: 15_000 });
  return harness;
}

test("a Not now step whose target resolves presses it itself; the clearing does not close the prompt first", async ({ openHarness }) => {
  test.setTimeout(60_000);
  const harness = await promptUp(openHarness);
  const reply = await harness.runAction({ commandId: "not-now", actionType: "web.dom.click", selector: NOT_NOW });
  expect(reply.status, actualOf(reply)).toBe("succeeded");
  expect(actualOf(reply)).not.toMatch(/closing/u);
  expect(reply.clearedLayers).toBeUndefined();
  expect((await state(harness)).notificationsPrompt).toBe("dismissed");
});

test("a Not now step whose selector matches nothing is not answered by the clearing when its recorded name is on the prompt", async ({ openHarness, page }) => {
  test.setTimeout(60_000);
  const harness = await promptUp(openHarness);
  const reply = await harness.runAction({
    commandId: "not-now-unmatched",
    actionType: "web.dom.click",
    selector: NOT_NOW_UNMATCHED,
    element: { selector: NOT_NOW_UNMATCHED, visibleText: "Not now" }
  });
  // Either the resolver finds "Not now" by its name and the step presses it, or
  // the step fails on its own selector; the clearing never answers the prompt.
  expect(actualOf(reply)).not.toMatch(/closing/u);
  expect(reply.clearedLayers).toBeUndefined();
  if (reply.status === "succeeded") expect((await state(harness)).notificationsPrompt).toBe("dismissed");
  else {
    await expect(page.getByRole("dialog", { name: "Turn on notifications?" })).toBeVisible();
    expect((await state(harness)).notificationsPrompt).toBe("pending");
  }
});
