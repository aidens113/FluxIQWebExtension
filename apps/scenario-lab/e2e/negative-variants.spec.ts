// The corpus's four missing negative surfaces, proven at the fixture level:
// W10 `broken-link`, W25 `too-slow`, W26 `no-context`, and W27's three
// (`disabled`, `detached`, `blocked-url`).
//
// Two things are pinned for each. **Honest**: the armed page does what a real
// site does -- a retired URL really is gone, slow content really is slow, a
// deleted item really is absent -- and nothing here reports a failure the page
// did not actually cause. **Discriminating**: each variant's declared
// `finalState` is applied to the armed page by `expectFacts`, so a manifest
// that claims a failure the page cannot produce fails here rather than in a
// two-hour bench run, and each armed page is checked for the signals that
// would let a run succeed for the wrong reason.
//
// **Recordable**: for `failure-surfaces`, whose recording script once pressed a
// control the same manifest declared unpressable, the baseline row drives the
// manifest's own script and checks each step against Playwright's actionability
// conditions -- visible, enabled, hit-testable -- so a fixture that cannot be
// recorded fails here rather than hanging the recording lane.
//
// What is *not* pinned here is the failure code a run reports. That needs the
// extension and Core; these rows prove the page a run would meet.

import { expect, type Locator, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioVariant, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { ambiguousTargetsScenario } from "../src/scenarios/ambiguous-targets/index.js";
import { delayedUiScenario } from "../src/scenarios/delayed-ui/index.js";
import { failureSurfacesScenario } from "../src/scenarios/failure-surfaces/index.js";
import { navigationScenario } from "../src/scenarios/navigation/index.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

/** The variant, the final state, and the console errors the manifest says an armed run may show. */
function variantOf(manifest: WebScenario, variantId: string): { variant: ScenarioVariant; finalState: ExpectedFact[]; allowedConsoleErrors: string[] } {
  const resolved = resolveScenarioWorkflow(manifest, { variantId });
  if (!resolved.variant) throw new Error(`${manifest.id} has no variant ${variantId}`);
  return { variant: resolved.variant, finalState: resolved.expected.finalState ?? [], allowedConsoleErrors: resolved.expected.allowedConsoleErrors ?? [] };
}

/**
 * Console errors, judged the way the runner judges them
 * (`run-expectations/console-errors.ts`): an error is allowed when it contains
 * one of the manifest's allowed strings. The lab fixture's own `consoleErrors`
 * compares the list exactly, which cannot express "this page is a 404 and says
 * so once per load"; the substring rule is what a real run applies.
 */
function watchConsole(page: Page): (allowed: readonly string[]) => void {
  const entries: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") entries.push(message.text()); });
  page.on("pageerror", (error) => entries.push(error.message));
  return (allowed) => expect(entries.filter((text) => !allowed.some((pattern) => text.includes(pattern))), "console errors the manifest does not allow").toEqual([]);
}

/** The manifest's own facts, with the runner's predicate meanings (`scenario-assertions.ts`). */
async function expectFacts(page: Page, facts: ExpectedFact[]): Promise<void> {
  expect(facts.length, "a negative variant that asserts nothing proves nothing").toBeGreaterThan(0);
  for (const fact of facts) {
    if (fact.predicate === "path") { expect(new URL(page.url()).pathname, fact.id).toBe(fact.value); continue; }
    const subject = page.getByTestId(fact.subject);
    if (fact.predicate === "text") await expect(subject, fact.id).toHaveText(String(fact.value));
    else if (fact.predicate === "contains") await expect(subject, fact.id).toContainText(String(fact.value));
    else if (fact.predicate === "visible") await (fact.value ? expect(subject, fact.id).toBeVisible() : expect(subject, fact.id).toBeHidden());
    else if (fact.predicate === "exists") await expect(subject, fact.id).toHaveCount(fact.value ? 1 : 0);
    else if (fact.predicate === "enabled") await (fact.value ? expect(subject, fact.id).toBeEnabled() : expect(subject, fact.id).toBeDisabled());
    else throw new Error(`Fact predicate ${fact.predicate} is not used by these fixtures`);
  }
}

/** The recorded wait, run against the armed page: it must genuinely run out of time. */
async function expectWaitToExpire(page: Page, testId: string, timeout: number): Promise<void> {
  await expect(page.getByTestId(testId).waitFor({ state: "visible", timeout })).rejects.toThrow(/Timeout/u);
}

/**
 * Far below Playwright's 30s default, which is what a recording-script step
 * with no `timeoutMs` actually gets: a control that only becomes actionable
 * late must fail this bound rather than pass slowly.
 */
const ACTIONABLE_TIMEOUT = 2_000;

/** A recording-script target, resolved the way the recording lane resolves it (`scenario-steps/parse-target.ts`). */
function stepLocator(page: Page, target: string | undefined): Locator {
  if (target?.startsWith("testid:")) return page.getByTestId(target.slice("testid:".length));
  throw new Error(`These fixtures address controls by test id; ${String(target)} would need the runner's own parser`);
}

/** The last of Playwright's actionability conditions: the click point belongs to the target, not to something over it. */
async function hitTestable(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return false;
    const hit = element.ownerDocument.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit !== null && (hit === element || element.contains(hit));
  });
}

test.describe("navigation: broken-link", () => {
  const manifest = navigationScenario.manifest;
  const { variant, finalState, allowedConsoleErrors } = variantOf(manifest, "broken-link");

  test("the recorded link is untouched and the page it points at is gone", async ({ page, lab, networkGuard: _guard }) => {
    const assertConsole = watchConsole(page);
    await page.goto(`${lab.origin}${manifest.startPath}`);
    const href = await page.getByTestId("full-navigation").getAttribute("href");
    expect(href).toBe("/scenarios/navigation/second");
    await page.getByTestId("full-navigation").click();
    await expect(page.getByTestId("navigation-page")).toHaveText("Navigation: second");

    await armVariant(lab, manifest.id, variant);
    await page.goto(`${lab.origin}${manifest.startPath}`);
    expect(await page.getByTestId("full-navigation").getAttribute("href"), "arming rewrites no href").toBe(href);

    // Following the recorded link lands somewhere the workflow never asked for.
    await page.getByTestId("full-navigation").click();
    await page.waitForURL(/\/scenarios\/navigation\/link-retired$/u);
    await expectFacts(page, finalState);
    // And the recorded wait for the second page cannot be satisfied by the notice.
    await expectWaitToExpire(page, "navigation-page", 1000);

    // The destination is genuinely broken, not merely moved: 404, at a URL that
    // is not the one requested.
    const response = await page.goto(`${lab.origin}/scenarios/navigation/second`);
    expect(response?.status()).toBe(404);
    expect(new URL(response?.url() ?? "").pathname).toBe("/scenarios/navigation/link-retired");
    const state = await readFinalState<{ visits: string[]; mode: string }>(lab, manifest.id);
    expect(state.mode).toBe("broken-link");
    expect(state.visits, "the second page is never reached").not.toContain("second");
    expect(state.visits.at(-1)).toBe("link-retired");
    assertConsole(allowedConsoleErrors);
  });
});

test.describe("delayed-ui: too-slow", () => {
  const manifest = delayedUiScenario.manifest;
  const { variant, finalState, allowedConsoleErrors } = variantOf(manifest, "too-slow");

  test("the same content, too late for the recorded wait and for the runtime default", async ({ page, lab, networkGuard: _guard }) => {
    test.setTimeout(90_000);
    const assertConsole = watchConsole(page);
    await page.goto(`${lab.origin}${manifest.startPath}`);
    await page.getByTestId("begin-delay").click();
    await expect(page.getByTestId("late-action"), "the unarmed page is prompt").toBeVisible({ timeout: 2_000 });

    await armVariant(lab, manifest.id, variant);
    await page.goto(`${lab.origin}${manifest.startPath}`);
    const startedAt = Date.now();
    await page.getByTestId("begin-delay").click();

    // The recorded 1,000 ms wait runs out with nothing to show for it.
    await expectWaitToExpire(page, "late-action", 1000);
    await expectFacts(page, finalState);

    // And so would the content script's 10,000 ms default
    // (`content/action-runtime/waits.ts` DEFAULT_WAIT_TIMEOUT_MS).
    await page.waitForTimeout(10_000);
    await expect(page.getByTestId("late-action")).toHaveCount(0);
    expect(Date.now() - startedAt).toBeGreaterThan(10_000);

    // Slow, not broken: the content does arrive, which is what makes `timeout`
    // the honest classification rather than a missing target.
    await expect(page.getByTestId("late-action")).toBeVisible({ timeout: 20_000 });
    expect(Date.now() - startedAt, "the reveal is the fixture's own 20s delay").toBeGreaterThanOrEqual(19_000);
    expect(await readFinalState<{ revealed: boolean; mode: string }>(lab, manifest.id)).toMatchObject({ revealed: true, mode: "too-slow" });
    assertConsole(allowedConsoleErrors);
  });
});

test.describe("ambiguous-targets: no-context and form-context", () => {
  const manifest = ambiguousTargetsScenario.manifest;
  const ambiguous = variantOf(manifest, "no-context");
  const contextual = variantOf(manifest, "form-context");

  /**
   * Every signal `content/identity/context.ts` and the element descriptor read,
   * for each `Continue` button, computed in the page by the same rules.
   */
  async function continueSignals(page: Page) {
    return page.$$eval("button", (elements) => elements
      .filter((element) => (element.textContent ?? "").trim() === "Continue")
      .map((element) => {
        const heading = (() => {
          for (let current: Element | null = element; current; current = current.parentElement) {
            for (let sibling = current.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
              if (sibling.matches("h1,h2,h3,h4,h5,h6,[role='heading']")) return (sibling.textContent ?? "").trim();
            }
          }
          return null;
        })();
        const form = element.closest("form");
        return {
          tag: element.tagName,
          text: (element.textContent ?? "").trim(),
          attributes: [...element.attributes].map((attribute) => `${attribute.name}=${attribute.value}`).sort(),
          formName: form?.getAttribute("name") ?? null,
          formAction: form?.getAttribute("action") ?? null,
          fieldsetLegend: element.closest("fieldset")?.querySelector(":scope > legend")?.textContent?.trim() ?? null,
          landmark: element.closest("main,nav,header,footer,aside,section,form,[role]")?.tagName ?? null,
          landmarkName: element.closest("main,nav,header,footer,aside,section,form,[role]")?.getAttribute("aria-label") ?? null,
          heading,
          listItem: Boolean(element.closest("li,[role='listitem']")),
        };
      }));
  }

  test("no-context: two Continue buttons no signal on the page can tell apart", async ({ page, lab, networkGuard: _guard }) => {
    const assertConsole = watchConsole(page);
    await page.goto(`${lab.origin}${manifest.startPath}`);
    const baseline = await continueSignals(page);
    expect(baseline).toHaveLength(2);
    expect(baseline[0], "the recorded page is resolvable, by test id").not.toEqual(baseline[1]);

    await armVariant(lab, manifest.id, ambiguous.variant);
    await page.goto(`${lab.origin}${manifest.startPath}`);
    const armed = await continueSignals(page);
    expect(armed).toHaveLength(2);
    expect(armed[0], "the two candidates must be indistinguishable").toEqual(armed[1]);
    expect(armed[0]?.attributes).toEqual(['class=ui-button']);

    // Nothing the recording carries can pick one: the test id is gone and no
    // form, fieldset, list, named region or second heading stands between them.
    await expect(page.getByTestId("choice-primary")).toHaveCount(0);
    await expect(page.getByTestId("choice-secondary")).toHaveCount(0);
    await expect(page.locator("form, fieldset, section, li")).toHaveCount(0);
    await expectFacts(page, ambiguous.finalState);

    // Both are live controls, so the ambiguity is a real choice rather than one
    // working button beside one broken twin.
    await page.getByRole("button", { name: "Continue" }).nth(1).click();
    await expect(page.getByTestId("result")).toHaveText("secondary");
    assertConsole([]);
  });

  test("form-context: the same two buttons, and the context alone resolves them", async ({ page, lab, networkGuard: _guard }) => {
    const assertConsole = watchConsole(page);
    await armVariant(lab, manifest.id, contextual.variant);
    await page.goto(`${lab.origin}${manifest.startPath}`);
    const armed = await continueSignals(page);
    expect(armed).toHaveLength(2);

    // The controls themselves are still identical; only the context differs.
    const withoutContext = (signals: (typeof armed)[number]) => ({ ...signals, formName: null, formAction: null, fieldsetLegend: null, landmark: null, landmarkName: null });
    expect(withoutContext(armed[0]!)).toEqual(withoutContext(armed[1]!));
    expect(armed[0]?.formName).toBe("primary-choice");
    expect(armed[1]?.formName).toBe("secondary-choice");
    expect([armed[0]?.fieldsetLegend, armed[1]?.fieldsetLegend]).toEqual(["Primary", "Secondary"]);

    // The recorded test id is just as dead here, so a resolution on this page
    // can only have come from the context.
    await expect(page.getByTestId("choice-primary")).toHaveCount(0);
    await expect(page.locator('form[name="primary-choice"]').getByRole("button", { name: "Continue" })).toHaveCount(1);
    await page.locator('form[name="primary-choice"]').getByRole("button", { name: "Continue" }).click();
    await expectFacts(page, contextual.finalState);
    assertConsole([]);
  });
});

test.describe("failure-surfaces: disabled, detached and blocked-url", () => {
  const manifest = failureSurfacesScenario.manifest;
  const primary = resolveScenarioWorkflow(manifest);
  /** The step the armed surfaces break: the click the recording actually made. */
  const recordedClick = primary.recordingScript.find((step) => step.operation === "click");

  /** The page facts the armed rendering states about itself; an inherited baseline fact would be a lie about the armed page. */
  function armedPageFacts(variant: ScenarioVariant): ExpectedFact[] {
    expect(variant.expected.pageFacts, `${variant.id} must state the page facts true of its own rendering`).toBeDefined();
    return variant.expected.pageFacts ?? [];
  }

  test("baseline: every recorded step is actionable, so the recording can be made at all", async ({ page, lab, networkGuard: _guard }) => {
    const assertConsole = watchConsole(page);
    await page.goto(`${lab.origin}${manifest.startPath}`);
    // Where the runner checks them: on the unarmed page, before a single step
    // is driven (`run-scenario.ts` `assertExpectedFacts`).
    await expectFacts(page, primary.expected.pageFacts ?? []);

    for (const step of primary.recordingScript) {
      if (step.operation === "checkpoint") continue;
      expect(step.operation, `${step.id}: this row drives clicks; another operation must be added here rather than skipped`).toBe("click");
      const locator = stepLocator(page, step.target);
      // Playwright's actionability check, spelled out. This is the property
      // that was false while the script pressed a permanently disabled control:
      // the recording lane hung on step one, so all three variants below were
      // theoretical however well they were written.
      await expect(locator, `${step.id}: visible`).toBeVisible();
      await expect(locator, `${step.id}: enabled`).toBeEnabled();
      expect(await hitTestable(locator), `${step.id}: nothing covers the point the click lands on`).toBe(true);
      await locator.click({ timeout: ACTIONABLE_TIMEOUT });
    }

    // And the workflow's declared outcome follows from driving its own script.
    await expectFacts(page, primary.expected.finalState ?? []);
    expect(await readFinalState<{ lastFailure: string | null }>(lab, manifest.id)).toMatchObject({ lastFailure: "detached", attempts: 1 });
    assertConsole([]);
  });

  test("disabled: the control is still there and refuses to be pressed", async ({ page, lab, networkGuard: _guard }) => {
    const assertConsole = watchConsole(page);
    const { variant, finalState } = variantOf(manifest, "disabled");
    await armVariant(lab, manifest.id, variant);
    await page.goto(`${lab.origin}${manifest.startPath}`);
    await expectFacts(page, armedPageFacts(variant));
    await expectFacts(page, finalState);

    // The mirror of the baseline row: the same recorded step, now unactionable.
    // Present and refusing, which is the difference between this surface and
    // `detached`.
    const locator = stepLocator(page, recordedClick?.target);
    await expect(locator, "a refusal, not a missing target").toBeVisible();
    await expect(locator).toBeDisabled();
    expect(await hitTestable(locator), "still on top: it is refused, not covered").toBe(true);
    await expect(locator.click({ timeout: ACTIONABLE_TIMEOUT })).rejects.toThrow(/Timeout/u);
    expect(await readFinalState<{ attempts: number }>(lab, manifest.id)).toMatchObject({ attempts: 0, lastFailure: null });
    assertConsole([]);
  });

  test("detached: the item was deleted and a notice stands where it was", async ({ page, lab, networkGuard: _guard }) => {
    const assertConsole = watchConsole(page);
    const { variant, finalState } = variantOf(manifest, "detached");
    await armVariant(lab, manifest.id, variant);
    await page.goto(`${lab.origin}${manifest.startPath}`);
    await expectFacts(page, armedPageFacts(variant));
    await expectFacts(page, finalState);
    // Not the disabled surface: the other controls are untouched, so a run that
    // reported `blocked_by_capability_or_policy` here would be wrong.
    await expect(page.getByTestId("disabled-target")).toBeDisabled();
    await expect(page.getByTestId("dead-link")).toBeEnabled();
    assertConsole([]);
  });

  test("blocked-url: the workspace guard refuses the destination and bounces the run", async ({ page, lab, networkGuard: guard }) => {
    const assertConsole = watchConsole(page);
    const { variant, finalState, allowedConsoleErrors } = variantOf(manifest, "blocked-url");
    await armVariant(lab, manifest.id, variant);
    await page.goto(`${lab.origin}${manifest.startPath}`);
    await expectFacts(page, armedPageFacts(variant));
    const locator = stepLocator(page, recordedClick?.target);
    await expect(locator, "the control is neither missing nor disabled").toBeEnabled();

    await locator.click({ timeout: ACTIONABLE_TIMEOUT });
    await page.waitForURL(/\/scenarios\/failure-surfaces\/blocked\?/u);
    await expectFacts(page, finalState);
    // The refused destination is named and never requested: nothing left
    // loopback, so this surface cannot be confused with a network violation.
    expect(guard.unexpectedDestinations).toEqual([]);
    expect(await readFinalState<{ lastFailure: string | null }>(lab, manifest.id)).toMatchObject({ lastFailure: "blocked-url" });
    assertConsole(allowedConsoleErrors);
  });
});
