// What the identity specs share: the two failure records they assert, the
// helpers that put a recorded descriptor on a replayed command, and the few
// moves every realistic page needs before a row can start -- a page mutation
// posted the way the site's own script posts it, a path opened with the
// content script ready in it, a click log, and company-website's quote drawer,
// which most of the rows run on.
//
// It exists because one spec grew past 700 lines carrying three subjects --
// which signal resolves a drifted control, what happens when two controls
// answer to one description, and when a fast answer is refused before it is
// acted on. Those are now `identity-resolution.spec.ts`,
// `identity-ambiguity.spec.ts` and `identity-veto.spec.ts`; this is the part
// none of them owns alone. `identity-signals.spec.ts`,
// `identity-wire-chain.spec.ts`, `large-page-resolution.spec.ts`,
// `dialog-identity/` and `selectors/` import it as well.
//
// Every row opens one of the ten realistic scenarios (AGENTS.md, user
// 2026-09-29). Their traps -- consent walls, chat greetings, newsletter offers
// -- are answered through each site's own `/api` mutations before the page is
// loaded, which is what a person's earlier answer leaves behind, so no row
// depends on winning a race with a timer.
//
// Scope, precisely: these rows hand the descriptor to the content script the
// way the background worker does, in `options.element`, and prove what the
// content script then does with it. They are not end-to-end proof of the
// plumbing that fills `options` on a live run. That half lives in the domain --
// `webAutomationOutputPayload` puts the fingerprint in a node's `parameters`
// and `webAutomationActionFromGatewayCommand` copies `parameters` into
// `options` -- and belongs to the domain's own tests. The two halves no longer
// differ in what they carry: the wire projection in `gateway-payloads.ts` and
// `output-nodes/targets.ts` both keep `testId`, `accessibleName`, `label`,
// `implicitRole` and `context`, and `identity-wire-chain.spec.ts` runs a
// recorded click through both before replaying it, so a signal lost on the way
// fails a row there instead of a refusal on a live run.

import type { Page } from "@playwright/test";
import { QUOTE_INPUT } from "../../../../scenario-lab/src/scenarios/company-website/index.js";
import { quoteDrawerIds, type QuoteDrawerIds } from "../../../../scenario-lab/src/scenarios/company-website/pages/index.js";
import { expect } from "../index.js";
import type { ContentHarness } from "../index.js";

type ActionCommand = Parameters<ContentHarness["runAction"]>[0];
type ActionOptions = NonNullable<ActionCommand["options"]>;
export type Descriptor = NonNullable<Awaited<ReturnType<ContentHarness["runAction"]>>["element"]>;
export type Rect = { x: number; y: number; width: number; height: number };

/** The closed set's record for an ambiguous target, exactly as Core stores it. */
export const TARGET_AMBIGUOUS = { category: "target_ambiguous", code: "web.target.ambiguous", retryable: false, stage: "target_resolution" };
/** And for one that could not be found at all. */
export const TARGET_NOT_FOUND = { category: "target_not_found", code: "web.target.not_found", retryable: true, stage: "target_resolution" };

/** The descriptor for one element, read through `web.dom.extract`, which changes nothing. */
export async function describe(harness: ContentHarness, selector: string): Promise<Descriptor> {
  const reply = await harness.runAction({ commandId: `describe:${selector}`, actionType: "web.dom.extract", selector });
  if (reply.status !== "succeeded" || !reply.element) {
    throw new Error(`extract did not describe ${selector}: ${reply.status} ${reply.message ?? ""}`);
  }
  return reply.element;
}

/** A recorded descriptor as a replayed command carries it, in `options.element`. */
export function recordedElement(descriptor: Descriptor): ActionOptions {
  return { element: descriptor } as unknown as ActionOptions;
}

/** Posts one of the open scenario's own page mutations, as its page script posts it: `POST /api/<scenario>/<operation>`. */
export async function labMutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${harness.scenarioId} ${operation} answered ${response.status}`).toBe(true);
}

/** Opens `path` under the open scenario (its start page by default) and waits for the content script to announce itself there. */
export async function openPath(harness: ContentHarness, path = ""): Promise<void> {
  await harness.page.goto(new URL(`/scenarios/${harness.scenarioId}/${path}`, harness.lab.origin).href);
  await harness.page.waitForLoadState("load");
  await expect
    .poll(async () => (await harness.messages().catch(() => [])).some((message) => message.type === "fluxiq.contentReady"))
    .toBe(true);
}

export async function documentRect(harness: ContentHarness, selector: string): Promise<Rect> {
  return harness.page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
  });
}

/** A visual target as the background worker sends it; the content script reads only its bounds. */
export function visualTarget(bounds: { bounds?: Rect; documentBounds?: Rect }) {
  return { namespace: "web" as const, statePath: "harness.target", ...bounds };
}

/**
 * Starts logging every click the page receives, whatever it lands on, and
 * returns a reader. Each entry is `<landmark>|<label>`: the nearest of header,
 * main, footer, aside or nav, then the element's text, or the title it sits
 * under when it has none -- enough to tell two look-alike controls apart.
 */
export async function trackClicks(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    const clicks: string[] = [];
    (window as unknown as { __identityClicks: string[] }).__identityClicks = clicks;
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const landmark = target?.closest("header, main, footer, aside, nav")?.tagName.toLowerCase() ?? "body";
      const label = (target?.textContent ?? "").trim().replace(/\s+/gu, " ").slice(0, 40) || (target?.closest("[title]")?.getAttribute("title") ?? "");
      clicks.push(`${landmark}|${label}`);
    }, true);
  });
  return () => page.evaluate(() => (window as unknown as { __identityClicks: string[] }).__identityClicks);
}

/**
 * company-website's quote drawer: Back, Continue and Send request in its
 * footer, a test id on Send request alone, generated ids and hashed classes
 * that another lab seed redraws, and a `redesigned-quote-submit` variant that
 * puts "Save and finish later" where Send request stood. Its ids come from the
 * scenario's own `quoteDrawerIds`, so no row restates them.
 */
export const quoteDrawer = {
  /** The drawer's generated ids for one lab seed; the scenario's own seed by default. */
  ids(seed = 4519): QuoteDrawerIds {
    return quoteDrawerIds(seed);
  },
  /** `[id="…"]`, because the generated ids carry colons a `#` selector would have to escape. */
  byId(id: string): string {
    return `[id="${id}"]`;
  },
  /** A visitor who answered consent and waved off the newsletter and the chat greeting, on the home page; `mode` arms a variant first. */
  async settle(harness: ContentHarness, mode?: string): Promise<void> {
    if (mode) await labMutate(harness, "set-mode", { mode });
    await labMutate(harness, "set-consent", { choice: "essential" });
    await labMutate(harness, "dismiss-newsletter");
    await labMutate(harness, "dismiss-chat-greeting");
    await openPath(harness);
  },
  /** The drawer opened through the header's own "Get a free quote" button. */
  async open(harness: ContentHarness, mode?: string): Promise<void> {
    await quoteDrawer.settle(harness, mode);
    await harness.page.click("header button[data-open-quote]");
    await expect(harness.page.getByRole("dialog", { name: "Get a free quote" })).toBeVisible();
  },
  /**
   * Step 2 or 3 of an open drawer, reached as a person reaches it: step 1's
   * fields filled with the scenario's own `QUOTE_INPUT`, a service chosen.
   * The privacy box is left unticked, so pressing Send request (or its
   * redesign) shows the drawer's own error instead of starting the human
   * check -- an observable press that changes nothing on the server.
   */
  async toStep(page: Page, step: 2 | 3, seed = 4519): Promise<void> {
    const ids = quoteDrawer.ids(seed);
    const field = (name: string) => quoteDrawer.byId(ids.fields[name]!);
    for (const name of ["fullName", "email", "phone", "postcode"] as const) await page.fill(field(name), QUOTE_INPUT[name]);
    await page.click(quoteDrawer.byId(ids.next));
    await page.click(quoteDrawer.byId(ids.select));
    await page.click(`[data-value="${QUOTE_INPUT.service}"]`);
    if (step === 3) await page.click(quoteDrawer.byId(ids.next));
    await expect(page.locator(quoteDrawer.byId(ids.steps[step - 1]!))).toBeVisible();
  }
};
