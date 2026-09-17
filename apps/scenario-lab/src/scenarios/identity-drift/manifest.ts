import type { ExpectedAction, ExpectedFact, ScenarioVariant } from "@fluxiq-web-extension/test-contracts";
import { createScenarioManifest } from "../../types.js";
import type { IdentityDriftMode } from "./modes.js";

const WORKSPACE_NAME = "Aurora Field Team";

/** The oracle every drift variant shares: the status line shows the save the fixture state recorded. */
const SAVED_FACT: ExpectedFact = { id: "settings-saved", subject: "save-status", predicate: "text", value: `Saved: ${WORKSPACE_NAME}` };
const SAVE_ACTIONS: ExpectedAction[] = [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }];

/**
 * One drift corpus row: arming renders the Save action in `mode`, and the run
 * must recover it without the harness and save exactly as recorded.
 */
function driftVariant(mode: Exclude<IdentityDriftMode, "baseline" | "renamed-redesign" | "save-and-exit">, description: string): ScenarioVariant {
  return {
    id: mode,
    description,
    arm: { operation: "set-mode", payload: { mode } },
    expected: { actions: [...SAVE_ACTIONS], finalState: [{ ...SAVED_FACT }] },
  };
}

/**
 * The drift only a repair can recover (`modes.ts`). Its expectations are the
 * *repaired* run's, deliberately: the save through the renamed control, with
 * Save's own oracle, and no failure. A provider-free run is expected to fail
 * them -- the matcher refuses the control, so the click fails with
 * `target_not_found` and the status line stays empty -- and that red run is
 * the correct result without a model, not a defect.
 *
 * A correct repair shows in the run's `harnessRecovery` as `attempted: true`
 * and one `temporary_target_override` in `runtimePatchAttempts` with
 * `preflightOk: true` and no `issueCodes`. Under the Lab's `--llm-task adapt`
 * grant (`diagnose_and_adapt`) Core only *proposes* a target, so that attempt
 * is `proposalOnly: true`, `executed: false`, with an adaptation and a change
 * proposal, and the run itself still ends `target_not_found` with nothing
 * saved. Such a run is therefore held to `repair.ts` instead: the declared
 * `target_not_found`, and a change proposal whose target names Apply changes.
 * These expectations are met only once the repair is applied: an
 * executed override, or the approved adaptation replayed, whose run shows the
 * failed click beside a succeeded one and ends `Saved: <name>` with
 * `savedInMode: "renamed-redesign"`, `saveCount: 1` and `discardCount: 0`.
 * Discard is the pressable wrong answer on the same page; pressing it writes
 * "Changes discarded", which fails the oracle.
 */
const repairableVariant: ScenarioVariant = {
  id: "renamed-redesign",
  description: "Only a repair can pass this row. Save is redesigned with no id or test id, a new class, and the label and accessible name renamed to Apply changes, so the element matcher refuses it and a provider-free run fails with target_not_found. The expectations are the repaired run's: a model that re-points the click at the one submit control, Apply changes, saves the name, and pressing Discard changes instead fails the oracle. A live run that may only propose the repair is judged by its proposal instead (repair.ts): the click still fails with target_not_found, and the change proposal must name Apply changes.",
  arm: { operation: "set-mode", payload: { mode: "renamed-redesign" } },
  expected: {
    pageFacts: [
      { id: "settings-form-visible", subject: "settings-form", predicate: "visible", value: true },
      { id: "recorded-save-gone", subject: "save-changes", predicate: "exists", value: false },
      { id: "discard-kept", subject: "discard-changes", predicate: "exists", value: true },
    ],
    actions: [...SAVE_ACTIONS],
    finalState: [{ ...SAVED_FACT }],
  },
};

/**
 * The negative row beside the drifts, row R7 of reports/i-resolver-safety.md:
 * Save is gone, and a different action whose name contains Save's stands alone
 * in its slot. The only right outcome is a refusal, so the click is declared
 * `failed` with `target_not_found`, and the status line must stay empty.
 * Pressing the wrong action writes "Saved and exited", which fails that fact as
 * surely as it misses Save's oracle.
 */
const wrongActionVariant: ScenarioVariant = {
  id: "save-and-exit",
  description: "Save is gone, and a lone Save changes and exit stands in its slot with no id, class, or test id: a different action whose name contains the recorded one. The run must refuse it rather than press it.",
  arm: { operation: "set-mode", payload: { mode: "save-and-exit" } },
  expected: {
    pageFacts: [
      { id: "settings-form-visible", subject: "settings-form", predicate: "visible", value: true },
      { id: "recorded-save-gone", subject: "save-changes", predicate: "exists", value: false },
      { id: "discard-gone", subject: "discard-changes", predicate: "exists", value: false },
    ],
    actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "failed" }],
    finalState: [{ id: "nothing-saved", subject: "save-status", predicate: "text", value: "" }],
    failure: { category: "target_not_found", code: "web.target.not_found" },
  },
};

export const identityDriftManifest = createScenarioManifest({
  id: "identity-drift",
  title: "Identity drift",
  tags: ["forms", "target-drift", "element-identity", "recovery"],
  seed: 121,
  startPath: "/scenarios/identity-drift/",
  capabilities: ["forms", "scroll"],
  recordingScript: [
    { id: "enter-workspace-name", operation: "type", target: "testid:display-name", value: WORKSPACE_NAME },
    { id: "save-changes", operation: "click", target: "testid:save-changes" },
    { id: "settings-saved", operation: "checkpoint" },
  ],
  playbackGoal: {
    id: "rename-workspace",
    description: `Rename the workspace to ${WORKSPACE_NAME} and save the settings.`,
    successFacts: [{ ...SAVED_FACT }],
  },
  expected: {
    pageFacts: [
      { id: "settings-form-visible", subject: "settings-form", predicate: "visible", value: true },
      { id: "workspace-name-visible", subject: "display-name", predicate: "visible", value: true },
    ],
    recordingEvents: [{ type: "web.element.input_changed", count: 1 }, { type: "web.element.clicked", count: 1 }],
    actions: [...SAVE_ACTIONS],
    finalState: [{ ...SAVED_FACT }],
  },
  variants: [
    driftVariant("selector-only", "W20: the Save action's id, class, and test id change; its text, role, and position do not."),
    driftVariant("text-only", "W21: the Save action's visible text and accessible name become Apply changes and it loses its test id; its id, class, and position do not change."),
    driftVariant("moved", "W22: the Save action renders in the form footer, below the fold, without its test id; its text, role, id, and class do not change."),
    driftVariant("wrapped-aria", "W23: the Save action gains wrapper elements, takes its accessible name from aria-labelledby, and loses its test id."),
    driftVariant("reworded-aria", "One redesign changes the Save action's id, class, test id, and visible text together; only its accessible name survives, in an aria-label. No week 1 corpus row covers it yet."),
    repairableVariant,
    wrongActionVariant,
  ],
});
