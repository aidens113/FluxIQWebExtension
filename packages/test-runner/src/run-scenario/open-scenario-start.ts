import type { Page } from "@playwright/test";
import type { WebScenario } from "@fluxiq-web-extension/test-contracts";
import { scenarioStartUrl } from "../lane-rules/index.js";

/**
 * Loads the fixture's own entry point, `scenario.startPath`. Every load of the
 * fixture the runner performs goes through it -- the unarmed load the
 * recording is made against, and the Flow lane's load before every Flow run,
 * armed or not -- because a Flow generated from a recording that began at
 * `startPath` begins there too.
 *
 * The Flow lane's load used to be a `page.reload()` once a variant was armed,
 * which reloads wherever the recording left the page rather than where the Flow
 * starts, and an unarmed run had no load at all. Most fixtures end their
 * recording on the page they opened on and could not tell the difference;
 * `auth-gate` ends on `/scenarios/auth-gate/account`, and once the `expired`
 * variant is armed that URL answers 302 to `/?expired=1`. So the armed run
 * began on a rendering the workflow never starts from: its page facts were
 * judged against the wrong page, the Flow's first action typed into a
 * `testid:username` that page does not carry, and the account GET recorded a
 * denial in the fixture state before the Flow had done anything. Unarmed, W18
 * ran its Flow on that account page, where no password field exists. No
 * scenario wants the recording's last page here -- the Flow replays the
 * recording from its beginning, and `multi-tab`, the only other fixture whose
 * recording leaves this tab's URL in question, expects to be back on
 * `startPath` anyway.
 *
 * The address comes from `scenarioStartUrl`, the same expression the runner
 * hands the created-Flow lane as its start location, so the page the harness
 * opens and the page Core is told about can never be two different pages.
 */
export async function openScenarioStart(page: Pick<Page, "goto">, scenarioOrigin: string, scenario: Pick<WebScenario, "startPath">): Promise<void> {
  await page.goto(scenarioStartUrl(scenarioOrigin, scenario));
}
