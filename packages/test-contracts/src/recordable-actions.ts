import type { ScenarioStepOperation } from "./scenario.js";

/**
 * The action types a recording of each step operation can yield, as the domain
 * maps what the extension records (`domain/src/io/input-model.ts`,
 * `recordedActionInputId`) and as the recording lane drives each step
 * (`packages/test-runner/src/scenario-steps/step-runner.ts`):
 *
 * - `click` records a click. Clicking a checkbox, radio or switch also records
 *   its change, which the domain maps to `web.dom.check`. A wait for a click's
 *   target is proposed from the DOM addition recorded before that click
 *   (`domain/src/recording/proposals/late-target-wait.ts`), so a script with
 *   no click can yield no `web.dom.wait_for_selector`.
 * - `type` fills a control: text entry, or `web.dom.clear` for an empty value.
 * - `select` presses only typeahead and arrow keys on a `<select>`
 *   (`trusted-input/select-option.ts`). The domain drops those keys, so the
 *   value change is the one action.
 * - `press` records the key, and a key can change the focused control's value.
 * - `check` sets the control by clicking it.
 * - `navigate` loads a URL directly, which the recorder marks `typed`.
 *
 * `extract` is the runner's own check, not a user action, so no recording holds
 * a `web.dom.extract`. Without `pagination` it only reads the page and yields
 * nothing. With it, the step clicks `next` as trusted input to reach each
 * further page, and the extension records those clicks
 * (`scenario-steps/extract-records.ts`), so it yields what a click yields.
 *
 * Every other operation yields nothing. `waitForState`, `checkpoint`,
 * `switchTab`, `closeTab` and `waitForDownload` are the runner's own waits and
 * tab moves. `upload` has no recorded mapping.
 *
 * Keyed by every operation, so a new operation does not compile until its row
 * says what a recording of it yields.
 */
const ACTIONS_BY_OPERATION: Readonly<Record<ScenarioStepOperation, readonly string[]>> = {
  click: ["web.dom.click", "web.dom.check", "web.dom.wait_for_selector"],
  type: ["web.dom.type", "web.dom.clear"],
  select: ["web.dom.select"],
  scroll: ["web.dom.scroll"],
  navigate: ["web.browser.navigate"],
  waitForState: [],
  checkpoint: [],
  press: ["web.dom.keypress", "web.dom.type", "web.dom.clear", "web.dom.select", "web.dom.check"],
  check: ["web.dom.check", "web.dom.click"],
  upload: [],
  switchTab: [],
  closeTab: [],
  waitForDownload: [],
  extract: [],
};

/**
 * Every action type some step of `script` can yield once recorded. An
 * `expected.actions` entry outside this set cannot be met by any run, so it is
 * a defect in the scenario, never a product failure.
 */
export function recordableActionTypes(script: readonly { operation?: unknown; pagination?: unknown }[]): ReadonlySet<string> {
  const types = new Set<string>();
  for (const { operation, pagination } of script) {
    if (typeof operation !== "string" || !Object.hasOwn(ACTIONS_BY_OPERATION, operation)) continue;
    // A paginated extract follows `next` by clicking it, and those clicks are recorded.
    const yields = operation === "extract" && pagination !== undefined ? ACTIONS_BY_OPERATION.click : ACTIONS_BY_OPERATION[operation as ScenarioStepOperation];
    for (const type of yields) types.add(type);
  }
  return types;
}
