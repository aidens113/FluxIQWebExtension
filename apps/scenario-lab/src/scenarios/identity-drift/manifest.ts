import type { ExpectedAction, ExpectedFact, ScenarioVariant } from "@fluxiq-web-extension/test-contracts";
import { createScenarioManifest } from "../../types.js";
import type { IdentityDriftMode } from "./modes.js";

const WORKSPACE_NAME = "Aurora Field Team";

/** The oracle every variant shares: the status line shows the save the fixture state recorded. */
const SAVED_FACT: ExpectedFact = { id: "settings-saved", subject: "save-status", predicate: "text", value: `Saved: ${WORKSPACE_NAME}` };
const SAVE_ACTIONS: ExpectedAction[] = [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }];

/**
 * One drift corpus row: arming renders the Save action in `mode`, and the run
 * must recover it without the harness and save exactly as recorded.
 */
function driftVariant(mode: Exclude<IdentityDriftMode, "baseline">, description: string): ScenarioVariant {
  return {
    id: mode,
    description,
    arm: { operation: "set-mode", payload: { mode } },
    expected: { actions: [...SAVE_ACTIONS], finalState: [{ ...SAVED_FACT }] },
  };
}

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
  ],
});
