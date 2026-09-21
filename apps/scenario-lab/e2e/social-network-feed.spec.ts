// Circleway, the social-network fixture, proven at the fixture level: every
// workflow's own recording script is driven as the recording lane drives it
// and meets every oracle it declares, and each shortcut a naive automation
// takes -- filling every field, pressing once, reading every article, reading
// a post before "See more", firing presses in a burst, clicking where
// something is in the way -- is shown to fail the same oracle.
//
// What is pinned here is what the page does. Whether FluxIQ can do the honest
// thing is what the Lab's live runs measure.

import { expect, type Locator, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import type { RunningScenarioLab } from "../src/server.js";
import { GROUP_POST_TEXT, socialNetworkFeedScenario, type FeedState } from "../src/scenarios/social-network-feed/index.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

const manifest = socialNetworkFeedScenario.manifest;
const ROOT = manifest.startPath;
const finalState = (lab: RunningScenarioLab) => readFinalState<FeedState>(lab, manifest.id);
type Row = Record<string, string | null>;

/** A manifest target resolved the way the runner resolves one (`parse-target.ts`). */
function locate(page: Page, target: string | undefined): Locator {
  if (!target) throw new Error("step has no target");
  if (target.startsWith("testid:")) return page.locator(`[data-testid=${JSON.stringify(target.slice(7))}]`);
  if (target.startsWith("role:")) {
    const body = target.slice(5);
    const split = body.indexOf(":");
    const role = (split < 0 ? body : body.slice(0, split)) as Parameters<Page["getByRole"]>[0];
    return split < 0 ? page.getByRole(role) : page.getByRole(role, { name: body.slice(split + 1), exact: true });
  }
  return page.locator(target);
}

/**
 * What an extract step reads, with the extension's field rules: a field is a
 * selector inside the item, `selector@attribute` reads an attribute, text is
 * whitespace-collapsed `textContent`, and a field whose element is absent has
 * no value.
 */
async function extract(page: Page, step: ScenarioStep): Promise<Row[]> {
  return page.evaluate(({ target, fields }) => Array.from(document.querySelectorAll(target)).map((item) => Object.fromEntries(Object.entries(fields).map(([name, spec]) => {
    const at = spec.lastIndexOf("@");
    const [selector, attribute] = at > 0 && !spec.slice(at).includes("]") ? [spec.slice(0, at), spec.slice(at + 1)] : [spec, undefined];
    const element = item.querySelector(selector);
    if (!element) return [name, null];
    return [name, attribute ? element.getAttribute(attribute) : (element.textContent ?? "").replace(/\s+/gu, " ").trim()];
  }))), { target: step.target ?? "", fields: step.fields ?? {} });
}

/** One step, as the recording lane drives it. An extract step's records are returned. */
async function perform(page: Page, step: ScenarioStep): Promise<Row[] | undefined> {
  switch (step.operation) {
    case "checkpoint": return undefined;
    case "click": await locate(page, step.target).click(); return undefined;
    case "type": await locate(page, step.target).fill(String(step.value)); return undefined;
    case "waitForState": await locate(page, step.target).waitFor({ state: "visible", timeout: step.timeoutMs ?? 3_000 }); return undefined;
    case "scroll": await page.mouse.wheel(0, Number(step.value ?? 500)); await page.waitForTimeout(500); return undefined;
    case "extract": return extract(page, step);
    default: throw new Error(`This spec does not drive ${step.operation}`);
  }
}

/** Runs a script and returns what each extract step read, by step id. */
async function run(page: Page, script: readonly ScenarioStep[]): Promise<Map<string, Row[]>> {
  const read = new Map<string, Row[]>();
  for (const step of script) {
    const records = await perform(page, step);
    if (records) read.set(step.id, records);
  }
  return read;
}

/** The manifest's facts with the runner's meanings (`scenario-assertions.ts`): text is the subject's trimmed `textContent`. */
async function expectFacts(page: Page, facts: readonly ExpectedFact[]): Promise<void> {
  expect(facts.length, "a rendering that asserts nothing proves nothing").toBeGreaterThan(0);
  for (const fact of facts) {
    if (fact.predicate === "path") { expect(new URL(page.url()).pathname, fact.id).toBe(fact.value); continue; }
    const subject = page.locator(`[data-testid=${JSON.stringify(fact.subject)}]`).first();
    if (fact.predicate === "text") expect(((await subject.textContent()) ?? "").trim(), fact.id).toBe(fact.value);
    else if (fact.predicate === "visible") await (fact.value ? expect(subject, fact.id).toBeVisible() : expect(subject, fact.id).toBeHidden());
    else if (fact.predicate === "exists") await expect(page.locator(`[data-testid=${JSON.stringify(fact.subject)}]`), fact.id).toHaveCount(fact.value ? 1 : 0);
    else throw new Error(`Fact predicate ${fact.predicate} is not used by this fixture`);
  }
}

/** The three overlays every fresh visit opens with, answered the way the manifest answers them. */
const overlays = (workflowId?: string) => resolveScenarioWorkflow(manifest, workflowId ? { workflowId } : {}).recordingScript.slice(0, 5);

/**
 * What a press at the centre of an element would land on: the element itself,
 * or the name of the layer in front of it -- the dialog it holds, named as
 * assistive technology names it.
 */
async function coveredBy(locator: Locator): Promise<string> {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = element.ownerDocument.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    if (!hit) return "nothing";
    if (hit === element || element.contains(hit)) return "itself";
    let layer: Element = hit;
    while (layer.parentElement && layer.parentElement !== document.body) layer = layer.parentElement;
    const dialog = layer.matches("[role=\"dialog\"]") ? layer : layer.querySelector("[role=\"dialog\"], [role=\"alertdialog\"]");
    const named = dialog?.getAttribute("aria-label") ?? document.getElementById(dialog?.getAttribute("aria-labelledby") ?? "")?.textContent;
    return named ?? layer.tagName.toLowerCase();
  });
}

test.describe.configure({ timeout: 90_000 });

test("group post: the recorded honest path leaves exactly one post waiting for the admins", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest);
  await page.goto(`${lab.origin}${ROOT}`);
  await expectFacts(page, workflow.expected.pageFacts ?? []);
  await page.locator("[role=\"feed\"] > [role=\"article\"]").first().waitFor();
  expect(await page.evaluate(() => document.querySelectorAll("*").length), "a real page, not a dozen elements").toBeGreaterThan(400);
  await run(page, workflow.recordingScript);
  await expectFacts(page, workflow.expected.finalState ?? []);
  await expectFacts(page, manifest.playbackGoal?.successFacts ?? []);
  const state = await finalState(lab);
  expect(state.pending).toEqual([{ group: "riverside-allotments", kind: "post", text: GROUP_POST_TEXT }]);
  expect(state.spam).toBe(0);
});

test("group post: a form-filler that fills the hidden Website field is dropped silently, and the goal fails", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${ROOT}`);
  await run(page, overlays());
  await page.locator("nav[aria-label=\"Shortcuts\"] a[href$=\"/groups/riverside-allotments/\"]").click();
  await page.getByTestId("group-composer-prompt").click();
  const dialog = page.getByRole("dialog", { name: "Create post" });
  await dialog.getByRole("textbox", { name: "Write something..." }).fill(GROUP_POST_TEXT);
  // What a form-filler does: every input in the form gets a value.
  for (const input of await dialog.locator("input").all()) await input.fill("https://example.test", { force: true });
  await dialog.getByRole("button", { name: "Post", exact: true }).click();
  await dialog.locator("[aria-label=\"Post\"]:not([aria-busy])").waitFor();
  await dialog.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText("Your post was submitted to the admins for approval.")).toBeVisible();
  await expect(page.getByTestId("pending-posts"), "the page says submitted, and the server kept nothing").toHaveCount(0);
  const state = await finalState(lab);
  expect(state.pending).toEqual([]);
  expect(state.spam).toBe(1);
});

test("group post: pressing Post once posts nothing, because the first press is swallowed", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${ROOT}`);
  await run(page, overlays());
  await page.locator("nav[aria-label=\"Shortcuts\"] a[href$=\"/groups/riverside-allotments/\"]").click();
  await page.getByTestId("group-composer-prompt").click();
  await page.getByRole("textbox", { name: "Write something..." }).fill(GROUP_POST_TEXT);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await page.waitForTimeout(1500);
  await expect(page.getByRole("dialog", { name: "Create post" }), "the dialog is still open with the text in it").toBeVisible();
  await expect(page.getByTestId("pending-posts")).toHaveCount(0);
  expect((await finalState(lab)).pending).toEqual([]);
});

test("group post: the cookie dialog owns every click until it is answered", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${ROOT}`);
  const prompt = page.getByRole("button", { name: "What's on your mind, Maya?", exact: true });
  await expect(prompt).toBeVisible();
  expect(await coveredBy(prompt), "a press aimed at the composer lands on the cookie dialog").toBe("Allow the use of cookies from Circleway on this browser?");
  await page.getByRole("button", { name: "Allow all cookies", exact: true }).click();
  expect(await coveredBy(prompt)).toBe("itself");
});

test("regrouped: the recorded prompt is gone, Create post repairs the job and Create poll does not", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { variantId: "regrouped" });
  await armVariant(lab, manifest.id, workflow.variant);
  await page.goto(`${lab.origin}${ROOT}`);
  await expectFacts(page, workflow.variant?.expected.pageFacts ?? []);
  await run(page, overlays());
  await page.locator("nav[aria-label=\"Shortcuts\"] a[href$=\"/groups/riverside-allotments/\"]").click();
  await expect(page.getByRole("button", { name: "Create post", exact: true })).toBeVisible();
  await expect(page.getByTestId("group-composer-prompt"), "the control the recording pressed").toHaveCount(0);

  // The wrong repair: the same words become a poll question.
  await page.getByRole("button", { name: "Create poll", exact: true }).click();
  await page.getByRole("textbox", { name: "Ask a question..." }).fill(GROUP_POST_TEXT);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await page.locator("[aria-label=\"Post\"]:not([aria-busy])").waitFor();
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await page.getByTestId("pending-posts").waitFor();
  expect(((await page.getByTestId("pending-posts").textContent()) ?? "").trim()).not.toBe(workflow.expected.finalState?.[0]?.value);

  // The right repair, on a fresh account.
  await armVariant(lab, manifest.id, workflow.variant);
  await page.goto(`${lab.origin}${ROOT}`);
  await run(page, overlays());
  await page.locator("nav[aria-label=\"Shortcuts\"] a[href$=\"/groups/riverside-allotments/\"]").click();
  await page.getByRole("button", { name: "Create post", exact: true }).click();
  await run(page, workflow.recordingScript.slice(workflow.recordingScript.findIndex(({ id }) => id === "composer-open")));
  await expectFacts(page, workflow.expected.finalState ?? []);
});

test("feed digest: the recorded honest path reads exactly the sixteen posts friends wrote, whole", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "feed-digest" });
  await page.goto(`${lab.origin}${ROOT}`);
  await expectFacts(page, workflow.expected.pageFacts ?? []);
  const read = await run(page, workflow.recordingScript);
  const expected = workflow.expected.extracted?.[0];
  expect(expected?.count).toBe(16);
  expect(read.get("extract-feed-digest")).toEqual(expected?.records);
  await expectFacts(page, workflow.expected.finalState ?? []);
});

test("feed digest: reading every article, or reading before See more, returns the wrong table", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "feed-digest" });
  const expected = workflow.expected.extracted?.[0]?.records ?? [];
  const extractStep = workflow.recordingScript.find(({ operation }) => operation === "extract")!;
  await page.goto(`${lab.origin}${ROOT}`);
  const withoutSeeMore = workflow.recordingScript.filter(({ id }) => !id.startsWith("see-more-") && id !== extractStep.id);
  await run(page, withoutSeeMore);

  const unexpanded = await extract(page, extractStep);
  expect(unexpanded.length).toBe(expected.length);
  const cut = unexpanded.filter((record, index) => record.text !== expected[index]?.text);
  expect(cut.length, "four long posts read as their shortened start").toBe(4);
  for (const record of cut) expect(record.text).toMatch(/… See more$/u);

  const everything = await extract(page, { ...extractStep, target: "[role=\"feed\"] > [role=\"article\"]" });
  expect(everything.length, "every unit down to the end of the feed").toBe(34);
  expect(everything).not.toEqual(expected);
  // The adverts are in there, with no word "Sponsored" a reader could filter on.
  const ads = await page.locator("[role=\"feed\"] a[href*=\"/ads/about/\"]").all();
  expect(ads.length).toBe(5);
  for (const ad of ads) {
    expect(await ad.innerText(), "what a person sees").toBe("Sponsored");
    expect(((await ad.textContent()) ?? ""), "what a text read gets").not.toBe("Sponsored");
  }
});

test("feed digest: the chat window covers the right-hand strip of the feed", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${ROOT}`);
  await run(page, overlays().slice(0, 4));
  const menu = page.locator("[role=\"feed\"] > [aria-posinset=\"4\"] [aria-label=\"Actions for this post\"]");
  await menu.evaluate((element) => { const box = element.getBoundingClientRect(); window.scrollBy(0, box.top - 520); });
  expect(await coveredBy(menu), "the boosted post's menu sits under the chat window").toBe("Chat with Elena Sokolova");
  await page.getByRole("button", { name: "Close chat", exact: true }).click();
  expect(await coveredBy(menu)).toBe("itself");
});

test("confirm requests: the recorded honest path waits out the rate limit and confirms the four who qualify", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "confirm-requests" });
  await page.goto(`${lab.origin}${ROOT}`);
  await expect(page.locator("[role=\"banner\"] a[aria-label=\"Friends\"]"), "the stale badge").toHaveText("4");
  const read = await run(page, workflow.recordingScript);
  expect(read.get("extract-confirmed")).toEqual(workflow.expected.extracted?.[0]?.records);
  await expectFacts(page, workflow.expected.finalState ?? []);
  const state = await finalState(lab);
  expect(Object.values(state.requests).filter((answer) => answer === "confirmed")).toHaveLength(4);
  expect(state.rateLimited).toBe(1);
});

test("confirm requests: a burst of presses that shrugs off the warning loses the fourth confirmation", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "confirm-requests" });
  await page.goto(`${lab.origin}${ROOT}friends/requests/`);
  await run(page, overlays().slice(0, 1));
  for (const slug of ["amara-osei", "jonas-weber", "lin-zhao", "freya-holm"]) {
    await page.locator(`[role="listitem"]:has(a[href$="/people/${slug}/"]) [aria-label="Confirm"]`).click();
  }
  await page.getByRole("alertdialog", { name: "You're going too fast" }).getByRole("button", { name: "OK", exact: true }).click();
  const extractStep = workflow.recordingScript.find(({ operation }) => operation === "extract")!;
  const read = await extract(page, extractStep);
  expect(read.map(({ name }) => name)).toEqual(["Amara Osei", "Jonas Weber", "Lin Zhao"]);
  expect(read).not.toEqual(workflow.expected.extracted?.[0]?.records);
});

test("move open day: the boosted post cannot be edited, and the permitted path trashes and reposts it", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "move-open-day" });
  await page.goto(`${lab.origin}${ROOT}`);
  await run(page, overlays());
  const own = page.locator("[role=\"feed\"] > [role=\"article\"]:has(h3 a[href*=\"/people/maya-lindqvist/\"])");
  await own.getByRole("button", { name: "Actions for this post", exact: true }).click();
  const edit = page.getByRole("menuitem").filter({ hasText: "Edit post" });
  await expect(edit).toHaveAttribute("aria-disabled", "true");
  await edit.dispatchEvent("click");
  await expect(page.getByRole("menu"), "a refused item does nothing").toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto(`${lab.origin}${ROOT}`);
  const read = await run(page, workflow.recordingScript.slice(5));
  expect(read.get("extract-open-day")).toEqual(workflow.expected.extracted?.[0]?.records);
  const state = await finalState(lab);
  expect(state.trashed).toEqual(["p_0d3a91"]);
  expect(state.created.map(({ audience }) => audience)).toEqual(["Public"]);
});

test("variants: quiet-feed is caught up after fifteen units, and app-install stands in front of the feed until passed", async ({ page, lab, networkGuard: _guard }) => {
  const quiet = resolveScenarioWorkflow(manifest, { workflowId: "feed-digest", variantId: "quiet-feed" });
  await armVariant(lab, manifest.id, quiet.variant);
  await page.goto(`${lab.origin}${ROOT}`);
  await expectFacts(page, quiet.variant?.expected.pageFacts ?? []);
  await run(page, overlays("feed-digest"));
  for (let index = 0; index < 6; index += 1) { await page.mouse.wheel(0, 6000); await page.waitForTimeout(500); }
  await page.getByRole("heading", { name: "You're all caught up", exact: true }).waitFor();
  const before = await page.evaluate(() => {
    const marker = Array.from(document.querySelectorAll("h2")).find((heading) => heading.textContent === "You're all caught up");
    return Array.from(document.querySelectorAll("[role=\"feed\"] > [role=\"article\"]")).filter((unit) => marker && unit.compareDocumentPosition(marker) & Node.DOCUMENT_POSITION_FOLLOWING).length;
  });
  expect(before, "units before You're all caught up").toBe(15);
  expect(quiet.expected.extracted?.[0]?.count).toBe(7);

  const promo = resolveScenarioWorkflow(manifest, { workflowId: "feed-digest", variantId: "app-install" });
  await armVariant(lab, manifest.id, promo.variant);
  await page.goto(`${lab.origin}${ROOT}`);
  await expectFacts(page, promo.variant?.expected.pageFacts ?? []);
  await expect(page.locator("[role=\"feed\"]")).toHaveCount(0);
  await page.getByText("Continue in browser", { exact: true }).click();
  await page.locator("[role=\"feed\"] > [role=\"article\"]").first().waitFor();
  await expect(page.getByTestId("app-promo")).toHaveCount(0);
});

test("the build: class names move with the lab seed, and ids are generated as units mount", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${ROOT}`);
  await page.locator("[role=\"feed\"] > [role=\"article\"]").first().waitFor();
  const first = await page.locator("[role=\"feed\"] > [role=\"article\"]").first().getAttribute("class");
  const ids = await page.locator("[role=\"feed\"] > [role=\"article\"]").evaluateAll((units) => units.map((unit) => unit.getAttribute("aria-labelledby")));
  for (const id of ids) expect(id).toMatch(/^:r[0-9a-z]+:$/u);
  await fetch(`${lab.origin}/__control/seed`, { method: "POST", headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify({ seed: 7 }) });
  await page.goto(`${lab.origin}${ROOT}`);
  await page.locator("[role=\"feed\"] > [role=\"article\"]").first().waitFor();
  expect(await page.locator("[role=\"feed\"] > [role=\"article\"]").first().getAttribute("class")).not.toBe(first);
  expect(await page.locator("[data-testid]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")))).toEqual(["build-marker"]);
});
