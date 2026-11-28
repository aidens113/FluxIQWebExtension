// A press the page ignored is pressed again although the page's beacon kept talking to its server (t1094).
//
// local-classifieds' radius picker ignores the first press of Apply after its select changes (the shipped widget
// re-renders its footer under the press, `client/location-element.ts`); the content script's click presses once more
// when the page answered nothing. Its pages also send an analytics beacon every 0.6-0.9 s
// (`client/background-script.ts`). Until t1094 any request begun after the press counted as the press reaching the
// server, so a beacon in the press's window stopped the second press, and a saved Flow's Apply failed
// (`run-mwznq45m-4adad633`, attempt 3). The page world now counts only requests the press may have caused
// (`src/page-world/request-starts.ts`). Each round here changes the radius and presses Apply once, as a Flow's step
// does, and counts the beacons the Lab received while that press was being answered.

import type { Page, Route } from "@playwright/test";
import { CLASSIFIEDS_ROOT } from "../../../../../../scenario-lab/src/scenarios/local-classifieds/index.js";
import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

type ActionCommand = Parameters<ContentHarness["runAction"]>[0];
type Descriptor = Awaited<ReturnType<ContentHarness["capture"]>>["interactiveElements"][number];

const PICKER = "kf-location";
/** The radii each round chooses, away from the one before: every change re-renders the footer, so every first Apply is ignored. */
const ROUNDS = [10, 5, 40, 2, 60, 1, 100, 20];
let commands = 0;

test.describe.configure({ timeout: 180_000 });

/** The snapshot descriptor a model would be shown for `name`. */
async function described(harness: ContentHarness, name: string, accept: (element: Descriptor) => boolean = () => true): Promise<Descriptor> {
  const found = (await harness.capture()).interactiveElements.filter(accept).find((element) => element.accessibleName?.trim() === name);
  if (!found) throw new Error(`The snapshot shows no element named ${JSON.stringify(name)}.`);
  return found;
}

/** Runs one action on the control named `name`, aimed as a model's handle is, shadow hosts included. */
async function act(harness: ContentHarness, name: string, actionType: ActionCommand["actionType"], extra: Partial<ActionCommand> = {}, accept?: (element: Descriptor) => boolean): Promise<BrowserActionResult> {
  const element = await described(harness, name, accept);
  const hosts = element.context?.shadowHosts;
  return await harness.runAction({
    commandId: `background-press.${++commands}`,
    actionType,
    selector: element.selector,
    element: {
      tagName: element.tagName,
      selector: element.selector,
      ...(element.role ? { role: element.role } : {}),
      ...(element.accessibleName ? { accessibleName: element.accessibleName } : {}),
      ...(hosts?.length ? { context: { shadowHosts: [...hosts] } } : {})
    },
    ...extra
  } as ActionCommand);
}

async function beacons(harness: ContentHarness): Promise<number> {
  const response = await fetch(`${harness.lab.origin}/__control/requests?path=${encodeURIComponent(`${CLASSIFIEDS_ROOT}collect`)}`, {
    headers: { authorization: `Bearer ${harness.lab.runToken}` }
  });
  return ((await response.json()) as { count?: number }).count ?? 0;
}

/** Holds the long poll open, as a real server with nothing to say does. */
async function holdLongPoll(page: Page): Promise<() => Promise<void>> {
  const routes: Route[] = [];
  await page.route(`**${CLASSIFIEDS_ROOT}updates.json*`, (route) => { routes.push(route); });
  return async () => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await Promise.all(routes.map((route) => route.fulfill({ status: 200, contentType: "application/json", body: "{\"messages\":[]}" }).catch(() => undefined)));
  };
}

test("each ignored Apply is pressed once more within its step, beacons in its window or not", async ({ openHarness, page }) => {
  const release = await holdLongPoll(page);
  const harness = await openHarness("local-classifieds");
  try {
    await page.goto(new URL(`${CLASSIFIEDS_ROOT}search/?query=dining+table`, harness.lab.origin).href);
    expect((await act(harness, "Allow all cookies", "web.dom.click")).status).toBe("succeeded");
    let radius = 20;
    let withBeacon = 0;
    for (const next of ROUNDS) {
      const chip = await act(harness, `Kelford · Within ${radius} mi`, "web.dom.click");
      expect(chip.status, `the chip opens the panel: ${chip.message ?? ""}`).toBe("succeeded");
      await expect(page.locator(PICKER).getByRole("dialog")).toBeVisible();
      const select = await act(harness, "Radius", "web.dom.select", { value: String(next) }, (element) => element.tagName === "select");
      expect(select.status).toBe("succeeded");
      const before = await beacons(harness);
      const apply = await act(harness, "Apply", "web.dom.click");
      const during = (await beacons(harness)) - before;
      if (during > 0) withBeacon += 1;
      const said = JSON.stringify(apply.validation);
      console.log(`t1094 radius ${radius} -> ${next}: ${apply.status}, ${during} beacon(s) during the press, ${said.includes("pressed once more") ? "pressed once more" : "pressed once"}`);
      expect(apply.status, `Apply to ${next} mi: ${apply.message ?? ""} ${said}`).toBe("succeeded");
      expect(said, "the ignored first press was followed by one more").toContain("pressed once more");
      await expect(page.locator(PICKER).getByText(`Kelford · Within ${next} mi`)).toBeVisible({ timeout: 4_000 });
      await expect(page.locator(PICKER).getByRole("dialog")).toBeHidden();
      radius = next;
    }
    console.log(`t1094 radius rounds with a beacon during the Apply press: ${withBeacon} of ${ROUNDS.length}`);
    expect(withBeacon, "the beacon talked during at least one press, or the round proved nothing").toBeGreaterThan(0);
  } finally {
    await release();
  }
});
