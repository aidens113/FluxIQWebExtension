// Controls inside open shadow roots, as a model meets them: described in the
// snapshot with a handle, pressable through that handle, and named when they
// are the layer that covers what the model tried to reach.
//
// Why this is its own spec. Live run `run-mulwm2dc-0bd95f22` (job board) spent
// half its build loop refused as covered behind `rf-consent`, a consent wall
// whose Accept, Reject and Manage buttons live in the widget's open shadow
// root. The snapshot's control list was built with `document.querySelectorAll`,
// which never enters one, so the model was never given a handle for "Reject
// non-essential", and the refusal it kept getting named only `div.scrim`.
//
// What must hold, and what must not change:
// - the wall's buttons are in the snapshot, near its head, with their host chain;
// - the command a model's handle becomes -- a selector written inside the root
//   and the name it was shown, with no host chain, because the packet's element
//   identity has no field for one -- presses the right button;
// - a covered refusal names the layer and its controls, and the runtime still
//   does not answer a consent choice for the person;
// - a closed shadow root is described as its host and crashes nothing;
// - the fixture's other widgets -- the chat panel in `rf-assistant`'s root and
//   the job-alert offer in the light document -- behave as before.

import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { Page } from "@playwright/test";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

type ActionCommand = Parameters<ContentHarness["runAction"]>[0];
type Descriptor = Awaited<ReturnType<ContentHarness["capture"]>>["interactiveElements"][number];

const SEARCH_BOX = 'input[name="q"]';

/** The snapshot element a model would be shown under this accessible name, and where it ranked. */
async function described(harness: ContentHarness, name: string): Promise<{ element: Descriptor | undefined; rank: number }> {
  const elements = (await harness.capture()).interactiveElements;
  const rank = elements.findIndex((element) => element.accessibleName === name);
  return { element: elements[rank], rank };
}

/**
 * The click a model's handle on `element` is dispatched as: the selector the
 * packet bound the handle to, and the identity `webPlanElementIdentity`
 * (domain `plan-resolution/element-identity.ts`) copies -- tag, role, name,
 * text, selector. No `context.shadowHosts`: that identity carries none.
 */
function handleClick(element: Descriptor, commandId: string): ActionCommand {
  return {
    commandId,
    actionType: "web.dom.click",
    selector: element.selector,
    element: {
      tagName: element.tagName,
      selector: element.selector,
      ...(element.role ? { role: element.role } : {}),
      ...(element.accessibleName ? { accessibleName: element.accessibleName } : {}),
      ...(element.visibleText ? { visibleText: element.visibleText } : {})
    }
  };
}

/** Adds a widget with a closed shadow root, fixed over the whole viewport, holding its own button. */
async function addClosedWall(page: Page): Promise<void> {
  await page.evaluate(() => {
    const host = document.createElement("closed-wall");
    host.setAttribute("style", "position:fixed;inset:0;z-index:2147483000;display:block");
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = '<div style="position:absolute;inset:0;background:rgb(0 0 0 / .4)"></div><button style="position:absolute;bottom:20px;left:20px">Hidden choice</button>';
    document.body.append(host);
  });
}

test.describe("job-board: the consent wall in rf-consent's open shadow root", () => {
  test("its buttons are in the snapshot near the head, with the host chain beside them", async ({ openHarness }) => {
    const harness = await openHarness("job-board");
    for (const name of ["Accept all", "Reject non-essential", "Manage choices"]) {
      const { element, rank } = await described(harness, name);
      expect(element, `${name} is described`).toMatchObject({ tagName: "button", context: { shadowHosts: ["body > rf-consent"] } });
      // The wall is painted over the page, so its controls rank with the
      // page-state controls, ahead of the page's own.
      expect(rank, `${name} ranks near the head`).toBeLessThan(15);
    }
  });

  test("the handle a model is given for Reject non-essential presses it, and only it", async ({ openHarness }) => {
    const harness = await openHarness("job-board");
    const { element } = await described(harness, "Reject non-essential");
    expect(element).toBeDefined();
    const reply = await harness.runAction(handleClick(element!, "shadow:reject-by-handle"));
    expect(reply, reply.message).toMatchObject({ status: "succeeded", element: { tagName: "button", accessibleName: "Reject non-essential" } });
    await expect.poll(async () => (await harness.finalState()).state).toMatchObject({ consent: "rejected" });
  });

  test("a click on the search box behind it is refused as covered, names the wall's controls, and the runtime answers nothing", async ({ openHarness }) => {
    const harness = await openHarness("job-board");
    const reply = await harness.runAction({ commandId: "shadow:search-behind-wall", actionType: "web.dom.click", selector: SEARCH_BOX, timeoutMs: 1_000 });
    expect(reply).toMatchObject({
      status: "failed",
      failure: { code: WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED }
    });
    expect(reply.failure?.actual).toMatch(/^covered: the point \d+,\d+ landed on div\.scrim, which covers the target; it is part of rf-consent headed "We value your privacy", a layer over the page whose controls are "Accept all", "Reject non-essential", "Manage choices"; /u);
    // A choice about the person's data is not a way out the runtime takes.
    expect((await harness.finalState()).state).toMatchObject({ consent: "pending" });
  });
});

test.describe("a closed shadow root", () => {
  test("is described as its host, is never entered, and a refusal under it names the host without throwing", async ({ openHarness, page }) => {
    const harness = await openHarness("job-board");
    await described(harness, "Reject non-essential").then(async ({ element }) => {
      await harness.runAction(handleClick(element!, "shadow:clear-consent"));
    });
    await expect.poll(async () => (await harness.finalState()).state).toMatchObject({ consent: "rejected" });
    await addClosedWall(page);

    const snapshot = await harness.capture();
    expect(snapshot.interactiveElements.some((element) => element.accessibleName === "Hidden choice"), "nothing inside the closed root is described").toBe(false);

    const reply = await harness.runAction({ commandId: "shadow:search-behind-closed", actionType: "web.dom.click", selector: SEARCH_BOX, timeoutMs: 1_000 });
    expect(reply.status).toBe("failed");
    expect(reply.failure?.code).toBe(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED);
    expect(reply.failure?.actual).toMatch(/^covered: the point \d+,\d+ landed on closed-wall, which covers the target; it is part of closed-wall, a layer over the page with no control to press/u);
  });
});

test.describe("job-board: the fixture's other widgets", () => {
  test("the chat panel's controls are described inside rf-assistant, and a target under the panel names it", async ({ openHarness, page }) => {
    // The panel's own six-second timer, then a refusal the defence retries.
    test.setTimeout(60_000);
    const harness = await openHarness("job-board");
    await page.getByRole("button", { name: "Reject non-essential" }).click();
    await expect.poll(async () => (await harness.finalState()).state).toMatchObject({ consent: "rejected" });
    // The panel opens itself six seconds after load.
    const input = page.getByPlaceholder("Ask Finch anything");
    await expect(input).toBeVisible({ timeout: 10_000 });

    const snapshot = await harness.capture();
    const chatInput = snapshot.interactiveElements.find((element) => element.tagName === "input" && element.context?.shadowHosts?.[0] === "body > rf-assistant");
    expect(chatInput, "the chat input is described with its host chain").toBeDefined();
    // Its handle reaches it: typing into it through the same command shape.
    const typed = await harness.runAction({ ...handleClick(chatInput!, "shadow:chat-type"), actionType: "web.dom.type", text: "hello" } as ActionCommand);
    expect(typed, typed.message).toMatchObject({ status: "succeeded" });
    await expect(input).toHaveValue("hello");

    // Something light-document under the panel: the point the panel's centre covers.
    const covered = await page.evaluate(() => {
      const host = document.querySelector("rf-assistant")!;
      const panel = host.shadowRoot!.querySelector(".panel")!.getBoundingClientRect();
      const probe = document.createElement("button");
      probe.textContent = "Under the chat";
      probe.setAttribute("style", `position:absolute;left:${panel.left + window.scrollX + 40}px;top:${panel.top + window.scrollY + 80}px;z-index:1`);
      probe.setAttribute("data-probe", "under-chat");
      document.body.append(probe);
      return true;
    });
    expect(covered).toBe(true);
    const reply = await harness.runAction({ commandId: "shadow:under-chat", actionType: "web.dom.click", selector: '[data-probe="under-chat"]', timeoutMs: 1_000 });
    expect(reply.status).toBe("failed");
    // Both of its controls are drawn `<div>`s, named by their own words: the
    // minimise control is the dash it shows, and Send.
    expect(reply.failure?.actual).toMatch(/; it is part of rf-assistant, a layer over the page whose controls are "–", "Send"; /u);
  });

  test("the job-alert offer in the light document is still closed by its own No thanks, and the click behind it lands", async ({ openHarness, page }) => {
    const harness = await openHarness("job-board");
    await page.getByRole("button", { name: "Reject non-essential" }).click();
    await expect.poll(async () => (await harness.finalState()).state).toMatchObject({ consent: "rejected" });
    // The offer opens four seconds after a results page loads.
    await page.goto(new URL("/scenarios/job-board/jobs?q=rust&l=", harness.url).href);
    await expect(page.getByText("Never miss a new job")).toBeVisible({ timeout: 10_000 });
    const reply = await harness.runAction({ commandId: "shadow:search-behind-offer", actionType: "web.dom.click", selector: SEARCH_BOX });
    expect(reply, reply.message).toMatchObject({ status: "succeeded" });
    await expect.poll(async () => (await harness.finalState()).state).toMatchObject({ alertOfferDismissed: true, alertSubscriptions: [] });
  });
});
