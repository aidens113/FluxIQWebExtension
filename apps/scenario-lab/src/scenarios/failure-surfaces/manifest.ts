import { createScenarioManifest } from "../../types.js";
import { BLOCKED_URL_PATH } from "./render.js";

/**
 * One page carrying the three ways an action can fail on a control that was
 * there when the workflow was recorded, and the three armed modes that put the
 * recorded control into each of them (W27).
 *
 * **Record time and replay time are different phases, and this manifest keeps
 * them apart.** The workflow is recorded against the unarmed page, so every
 * control the `recordingScript` touches must be one a person could actually
 * press: Playwright's click waits for the enabled actionability check, and a
 * script that pressed a control the same manifest declares unpressable could
 * never produce a recording for the variants to replay. The breakage belongs
 * to the armed run, introduced by `arm` after the recording exists. The
 * `recorded-target-*` page facts state that separation as an assertion, so a
 * script that drifts back onto a broken control fails at the fact check
 * instead of hanging in the recording lane.
 *
 * `disabled-target` is on the page and permanently disabled on purpose -- it is
 * a page fact and the content harness's refused-target fixture -- but the
 * recording never presses it. The disabled *surface* is proven where it can be
 * proven: by the `disabled` variant, which locks the recorded control after the
 * recording and replays a click that is rejected.
 *
 * Every variant arms the same control -- `detach-target`, the one the recording
 * actually pressed -- so the three are alternatives rather than a list of
 * unrelated surfaces, and each variant's final state names something only its
 * own mode produces. Each also states the page facts true of its own
 * rendering: page facts are the one expectation a variant does not inherit
 * (`ScenarioVariant`), because the workflow's describe the unarmed page the
 * recording is made against and a variant's describe the armed page its run is
 * judged on. `scenarioPageFactSchedule` checks each at its own moment, so the
 * same declared facts are judged against the same rendering whichever lane
 * arms them.
 */
export const failureSurfacesManifest = createScenarioManifest({
  id: "failure-surfaces", title: "Failure surfaces", tags: ["failure", "safety"], seed: 108,
  startPath: "/scenarios/failure-surfaces/", capabilities: ["navigation"],
  recordingScript: [
    { id: "detach-target", operation: "click", target: "testid:detach-target" },
    { id: "detached-final", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [
      { id: "recorded-target-present", subject: "detach-target", predicate: "visible", value: true },
      { id: "recorded-target-enabled", subject: "detach-target", predicate: "enabled", value: true },
      { id: "disabled", subject: "disabled-target", predicate: "enabled", value: false },
    ],
    recordingEvents: [{ type: "web.element.clicked" }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }],
    finalState: [{ id: "detached", subject: "detach-target", predicate: "exists", value: false }],
    allowedConsoleErrors: [],
  },
  variants: [
    {
      id: "disabled",
      description: "The record was locked after the recording: the control the run means to press is still on the page and refuses to be pressed.",
      arm: { operation: "set-mode", payload: { mode: "disabled" } },
      expected: {
        pageFacts: [
          { id: "recorded-target-present", subject: "detach-target", predicate: "visible", value: true },
          { id: "recorded-target-locked", subject: "detach-target", predicate: "enabled", value: false },
          { id: "disabled", subject: "disabled-target", predicate: "enabled", value: false },
        ],
        // `failed`, not `rejected`: an attempt's status comes from Core's
        // `RuntimeStatus` (`queued|running|waiting|succeeded|failed|cancelled`,
        // widened to `unknown`), which has no `rejected`. The contract no
        // longer offers the word either -- `expectedActionOutcomes` is
        // `succeeded | failed` -- so a refusal is `failed` here, carried by
        // `failure` below as one code with the reason in the record, exactly as
        // `content/action-runtime` reports it.
        actions: [{ action: "web.dom.click", outcome: "failed" }],
        finalState: [
          { id: "detach-target-present", subject: "detach-target", predicate: "exists", value: true },
          { id: "detach-target-disabled", subject: "detach-target", predicate: "enabled", value: false },
          { id: "nothing-happened", subject: "result", predicate: "text", value: "Ready" },
        ],
        failure: { category: "blocked_by_capability_or_policy", code: "web.action.rejected" },
      },
    },
    {
      id: "detached",
      description: "The item was deleted after the recording: the control is not on the page at all, and a deletion notice stands where it was.",
      arm: { operation: "set-mode", payload: { mode: "detached" } },
      expected: {
        pageFacts: [
          { id: "recorded-target-gone", subject: "detach-target", predicate: "exists", value: false },
          { id: "disabled", subject: "disabled-target", predicate: "enabled", value: false },
        ],
        actions: [{ action: "web.dom.click", outcome: "failed" }],
        finalState: [
          { id: "detach-target-absent", subject: "detach-target", predicate: "exists", value: false },
          { id: "deletion-notice", subject: "detach-target-removed", predicate: "visible", value: true },
          { id: "nothing-happened", subject: "result", predicate: "text", value: "Ready" },
        ],
        failure: { category: "target_not_found", code: "web.target.not_found" },
      },
    },
    {
      id: "blocked-url",
      description: "The action now leads off-site and the workspace link guard refuses the destination, so pressing the recorded control lands the run on an interstitial it never asked for.",
      arm: { operation: "set-mode", payload: { mode: "blocked-url" } },
      expected: {
        // The control is untouched here: this surface is about where the click
        // goes, not about whether it can be made at all.
        pageFacts: [
          { id: "recorded-target-present", subject: "detach-target", predicate: "visible", value: true },
          { id: "recorded-target-enabled", subject: "detach-target", predicate: "enabled", value: true },
          { id: "disabled", subject: "disabled-target", predicate: "enabled", value: false },
        ],
        actions: [{ action: "web.dom.click" }],
        finalState: [
          { id: "blocked-location", subject: "document", predicate: "path", value: BLOCKED_URL_PATH },
          { id: "blocked-notice", subject: "access-blocked", predicate: "visible", value: true },
          { id: "refused-destination", subject: "blocked-destination", predicate: "contains", value: "partner.example.invalid" },
        ],
        // The guard really does refuse with `403`, and Chromium reports a
        // non-2xx main-frame response as a console error. Allowing exactly that
        // string keeps the refusal real rather than a 200 dressed as one.
        allowedConsoleErrors: ["Failed to load resource: the server responded with a status of 403"],
        failure: { category: "navigation_unexpected", code: "web.navigation.unexpected" },
      },
    },
  ],
  evidencePolicy: { screenshots: "events", trace: "always", video: "failure", sampleFps: 0, reviewRequired: true },
});
