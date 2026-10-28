import type { ScenarioStep, ScenarioStepOperation } from "../scenario.js";

/**
 * What a Flow node would carry if it copied a detour: the operation, the
 * control's visible label, and the value typed or chosen. Test data for a
 * later check that a built Flow did not copy the detour; never model guidance.
 */
export type DemonstrationDetourAct = {
  operation: ScenarioStepOperation;
  /** The control's visible label. */
  target?: string;
  value?: string;
};

/** A deliberate side trip in a demonstration: applied, then undone before the first extract step. */
export type ScenarioDemonstrationDetour = {
  /** Ids of the steps that make up the detour (apply, wait and undo), all present in `steps`. */
  stepIds: readonly string[];
  why: string;
  acts: readonly DemonstrationDetourAct[];
};

/**
 * A scripted demonstration a Lab person records before asking the chat to
 * build a task: the honest browser path plus deliberate detours. With
 * `conflictsWithInstruction` the demonstration shows something other than the
 * written task, to probe that the written instruction wins.
 */
export type ScenarioDemonstration = {
  id: string;
  scenarioId: string;
  taskId: string;
  /** A person's first-person words about what they show; never the task instruction nor an expected record value. */
  description: string;
  steps: readonly ScenarioStep[];
  detours: readonly ScenarioDemonstrationDetour[];
  conflictsWithInstruction?: true;
};
