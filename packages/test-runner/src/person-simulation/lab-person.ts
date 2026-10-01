import type { BrowserContext } from "@playwright/test";
import type { ExpectedPersonHandOff } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import { LAB_PROJECT_DOMAIN_ID } from "../flow-lane/index.js";
import { expectedPersonHandOff } from "./expected-hand-off.js";
import type { LabPersonSnapshot, PersonHandOff } from "./hand-off-record.js";
import type { PersonAskControl, PersonChatAnswerer } from "./asks.js";
import type { PermissionPlay, PersonPermissionAnswer } from "./permission-answer.js";
import { loadPersonChecks } from "./check-module.js";
import { startPersonSimulation } from "./simulation.js";
import { scenarioTabs } from "./tab.js";

export type LabPersonInput = {
  control: PersonAskControl;
  projectId: string;
  /** The project's domain; the Lab's own by default, as the Flow lane's (`LAB_PROJECT_DOMAIN_ID`). */
  domainId?: string;
  context: BrowserContext;
  scenarioOrigin: string;
  /** The Lab's controller token, which `/__control/final-state` takes. */
  runToken: string;
  scenarioId: string;
  scenarioLabDist: string;
  workflowId: string | undefined;
  variantId: string | undefined;
  /** A live task's own declaration (`LiveInstructionTask.personCheck`), which wins over the row's. */
  task?: ExpectedPersonHandOff | undefined;
  /**
   * A created-Flow task's permission point (`LiveInstructionTask.permissionPoint`,
   * `undefined` for a task that declares none): the person then answers
   * permission asks, allowing the act at the point and refusing it elsewhere.
   * Absent, permission asks are left alone.
   */
  permissions?: PermissionPlay | undefined;
  /** Writes the record into the run's bundle (`PERSON_HAND_OFFS_SNAPSHOT`). */
  write: (snapshot: LabPersonSnapshot) => Promise<unknown>;
  /** Puts each hand-off on the run's timeline as it is answered. */
  publish: (handOff: PersonHandOff) => Promise<unknown>;
  /** Puts each permission answer on the run's timeline as it is given. */
  publishPermission?: (answer: PersonPermissionAnswer) => Promise<unknown>;
  /**
   * Answers an ask on the extension's chat thread in the chat window itself:
   * a build started from the chat asks there, and the person sitting at the
   * panel answers there. Absent, every ask is answered through Core.
   */
  answerInChat?: PersonChatAnswerer;
};

/** The person a run is playing, until the run is done with it. */
export type LabPerson = {
  /**
   * Stops the person, waits for a hand-off in progress, and writes the record.
   * It never throws: it runs while the run is being cleaned up, where a
   * failure would leave the browser and Core running. A record that could not
   * be written is kept in `writeFailure` and leaves the evaluation reading no
   * hand-offs.
   */
  finish(): Promise<void>;
  readonly writeFailure: unknown;
};

/**
 * Starts the Lab playing the person for one run: loads the scenario's person
 * module from the scenario lab build the run uses, resolves the hand-off the
 * row or task declares, and reads Core's threads for person-needed asks, and
 * for permission asks when given the task's point, until `finish`. Started before the build or the run it covers, because either may
 * ask the moment it starts.
 */
export async function startLabPerson(input: LabPersonInput): Promise<LabPerson> {
  const module = await loadPersonChecks(input.scenarioLabDist, input.scenarioId);
  const expected = expectedPersonHandOff({ module, workflowId: input.workflowId, variantId: input.variantId, task: input.task });
  const origin = new URL(input.scenarioOrigin).origin;
  const simulation = startPersonSimulation({
    control: input.control,
    scope: { projectId: input.projectId, domainId: input.domainId ?? LAB_PROJECT_DOMAIN_ID },
    scenarioId: input.scenarioId,
    module,
    expected,
    tabs: () => scenarioTabs(input.context, origin),
    readState: () => readFixtureState(origin, input.runToken, input.scenarioId),
    onHandOff: async (handOff) => { await input.publish(handOff); },
    ...(input.permissions ? { permissions: input.permissions } : {}),
    ...(input.publishPermission ? { onPermissionAnswer: async (answer: PersonPermissionAnswer) => { await input.publishPermission?.(answer); } } : {}),
    ...(input.answerInChat ? { answerInChat: input.answerInChat } : {}),
  });
  let writeFailure: unknown;
  let finished: Promise<void> | undefined;
  return {
    finish: () => finished ??= (async () => {
      const snapshot = await simulation.stop();
      try {
        await input.write(snapshot);
      } catch (error) {
        writeFailure = error;
      }
    })(),
    get writeFailure() { return writeFailure; },
  };
}

/** The fixture's state as the Lab's oracle endpoint returns it: what a person module reads an answer from. */
async function readFixtureState(origin: string, runToken: string, scenarioId: string): Promise<unknown> {
  const response = await fetch(`${origin}/__control/final-state?scenario=${encodeURIComponent(scenarioId)}`, { headers: { authorization: `Bearer ${runToken}` }, signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new RunnerFailure("fixture.invalid", `The Scenario Lab has no state for the scenario (${response.status})`);
  const snapshot: unknown = await response.json();
  return snapshot !== null && typeof snapshot === "object" ? (snapshot as { state?: unknown }).state : undefined;
}
