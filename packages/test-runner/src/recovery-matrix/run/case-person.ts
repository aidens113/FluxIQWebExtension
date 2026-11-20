// The Lab playing the person for a matrix case that meets a check only a person
// may pass (case 15, t972): it reads the run's person-needed asks through Core,
// passes the check in the visible browser the way a person does, and answers
// Continue once it has gone (`../../person-simulation/`). A case that names no
// person-cleared steps gets no person, so an ask in any other case is answered
// by nobody, as before.
//
// What it did is kept in the case's result rather than a file of its own: the
// hand-offs by check, act and answer, closed words only.

import type { BrowserContext } from "@playwright/test";
import { startLabPerson, type LabPersonSnapshot, type PersonAskControl } from "../../person-simulation/index.js";
import type { RecoveryMatrixCase } from "../matrix-row.js";

export type MatrixCasePerson = {
  /** Stops the person, waits for a hand-off in progress, and answers what it did. Never throws. */
  finish(): Promise<MatrixCaseHandOffs>;
};

/** Each hand-off in the order answered, and the Lab's own failures to read Core's threads. */
export type MatrixCaseHandOffs = Readonly<{
  handOffs: readonly Readonly<{ check: string | null; did: string; answer: string | null }>[];
  pollFailures: number;
}>;

export type MatrixCasePersonInput = {
  matrixCase: RecoveryMatrixCase;
  control: PersonAskControl;
  projectId: string;
  context: BrowserContext;
  scenarioOrigin: string;
  runToken: string;
  scenarioLabDist: string;
  workflowId: string | undefined;
  variantId: string | undefined;
};

/** The person for a case that names person-cleared steps; nothing for any other. */
export async function startMatrixCasePerson(input: MatrixCasePersonInput): Promise<MatrixCasePerson | undefined> {
  if (!input.matrixCase.personCleared) return undefined;
  let snapshot: LabPersonSnapshot | undefined;
  const person = await startLabPerson({
    control: input.control, projectId: input.projectId, context: input.context,
    scenarioOrigin: input.scenarioOrigin, runToken: input.runToken, scenarioId: input.matrixCase.scenarioId,
    scenarioLabDist: input.scenarioLabDist, workflowId: input.workflowId, variantId: input.variantId,
    write: async written => { snapshot = written; },
    publish: async () => undefined,
  });
  return {
    finish: async () => {
      await person.finish();
      return {
        handOffs: (snapshot?.handOffs ?? []).map(handOff => ({ check: handOff.check, did: handOff.did, answer: handOff.answer })),
        pollFailures: snapshot?.pollFailures ?? 0,
      };
    },
  };
}
