// A help widget's greeting over the consent sheet's own answers, through the
// real content-script bundle on company-website (T2 harness: no background
// worker, no Core, no model), with the real domain view built from its capture
// (t507).
//
// Breadth wave 1 (`run-mv6qrcln-2e194a12`, step 0008): the greeting card,
// painted above the consent sheet, covers its three answers, so a press on
// "Reject non-essential" is rightly refused as covered by the widget. The
// refusal named no closer and the view listed the widget's launcher, card and
// "×" under the sheet's `[dialog]`; the model pressed the same answer again
// until the repeat guard ended the build. These hold that the view names the
// widget's own "×" as its closer and keeps the widget out of the sheet, and
// that pressing that "×" and then the answer works. The oracle is the Scenario
// Lab's own state.

import { publishedWebLlmPage, sanitizeWebLlmSnapshotWithBindings } from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

type SiteState = { consent: string; chat: { greetingDismissed: boolean } };

async function view(harness: ContentHarness) {
  const { evidence } = sanitizeWebLlmSnapshotWithBindings(await harness.capture());
  return { evidence, page: publishedWebLlmPage(evidence).page };
}

test.describe("company-website: the chat greeting over the consent sheet's answers", () => {
  test.setTimeout(90_000);

  test("the view names the greeting's × as its closer and keeps it out of the sheet; × then Reject non-essential lands", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await expect(page.locator('[title="Close"]'), "the greeting opens on its timer, over the sheet's answers").toBeVisible({ timeout: 10_000 });

    const before = await view(harness);
    const reject = before.evidence.elements.find((element) => element.name === "Reject non-essential");
    const close = before.evidence.elements.find((element) => element.name === "Close" && element.text === "×");
    expect(reject, before.page).toBeDefined();
    expect(close, before.page).toBeDefined();
    const widget = reject!.coveredBy?.[0];
    expect(widget, "the greeting really is over the answer: the press stays refused").toBeDefined();
    const sheet = before.evidence.elements.find((element) => element.isDialog?.modal === true)?.target;
    const widgetOwn = before.evidence.elements.filter((element) => element.target === widget || element.parent === widget || element.target === close!.target);
    expect(widgetOwn.length, before.page).toBeGreaterThan(1);
    for (const element of widgetOwn) expect(element.inDialog, `${element.target} is the widget's, not the sheet's (${sheet})`).toBeUndefined();
    const covering = before.page.split("\n").find((line) => line.startsWith("COVERING ")) ?? "";
    const entry = covering.replace(/^COVERING /u, "").split(" · ").find((part) => part.startsWith(`${widget} `)) ?? "";
    expect(entry, covering).toMatch(new RegExp(`close ${close!.target} `, "u"));

    const closed = await harness.runAction({ commandId: "close-greeting", actionType: "web.dom.click", selector: '[title="Close"]' });
    expect(closed.status, closed.message).toBe("succeeded");
    await expect.poll(async () => ((await harness.finalState()).state as unknown as SiteState).chat.greetingDismissed).toBe(true);
    expect(((await harness.finalState()).state as unknown as SiteState).consent, "closing the greeting answered nothing").toBe("pending");

    const after = await view(harness);
    const answer = after.evidence.elements.find((element) => element.name === "Reject non-essential");
    expect(answer?.coveredBy, after.page).toBeUndefined();

    const reply = await harness.runAction({ commandId: "reject", actionType: "web.dom.click", selector: 'button[data-choice="essential"]' });
    expect(reply.status, reply.message).toBe("succeeded");
    expect(((await harness.finalState()).state as unknown as SiteState).consent).toBe("essential");
  });
});
