// Arming a Scenario Lab fixture variant, and the reload that puts the content
// script back in the armed page.
//
// It sits here because three of the four `web.dom.extract_list` specs need it
// -- the catalog's text variant, the table's column reorder, and the feed's
// end-early mode -- and none of them owns it. `inference.spec.ts` carries its
// own narrower copy, which takes no payload; that one is not this file's
// consumer and was left alone.

import { expect } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/**
 * Arms a fixture variant through the Lab's authenticated `mutate` endpoint, as
 * `armScenarioVariant` does, then reloads so the server renders the armed page
 * with the content script back in it.
 */
export async function armVariant(harness: ContentHarness, operation: string, payload: unknown = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`The Scenario Lab answered ${response.status} arming ${operation} on ${harness.scenarioId}.`);
  await reloadHarness(harness);
}

/** Reloads the fixture page and waits for the content script to announce itself again. */
export async function reloadHarness(harness: ContentHarness): Promise<void> {
  await harness.page.reload();
  const ready = (await harness.messages()).some((message) => message.type === "fluxiq.contentReady");
  expect(ready, "the content script re-announced itself after the reload").toBe(true);
}
