import type { ExpectedPersonHandOff } from "@fluxiq-web-extension/test-contracts";
import type { ChatPanelDriver } from "../../extension-chat-check/index.js";
import { LAB_PROJECT_DOMAIN_ID } from "../../flow-lane/index.js";
import { loadPersonChecks, startLabPerson, type LabPersonSnapshot, type PendingPersonAsk, type PermissionPlay, type PersonAskAnswer, type PersonAskControl, type PersonChatAnswerer, type PersonHandOff, type PersonPermissionAnswer } from "../../person-simulation/index.js";
import type { LiveAttemptPerson, LiveAttemptPersonRun } from "./live-driver.js";

/** Core's subject kind for the project's own thread, which is the extension's chat. */
const CHAT_SUBJECT = "project";
const PRESS_MS = 30_000;
const SETTLE_MS = 30_000;

export type AttemptPersonInput = {
  control: PersonAskControl;
  projectId: string;
  context: Parameters<typeof startLabPerson>[0]["context"];
  scenarioOrigin: string;
  runToken: string;
  scenarioId: string;
  scenarioLabDist: string;
  workflowId: string | undefined;
  variantId: string | undefined;
  /** The task's own declaration, which wins over the scenario's row (`LiveInstructionTask.personCheck`). */
  task: ExpectedPersonHandOff | undefined;
  /** The task's permission point, `undefined` for a task that declares none. */
  permissionPoint: PermissionPlay["point"];
  /** The chat the person answers in, where one is on screen; absent, every ask is answered through Core. */
  panel?: ChatPanelDriver | undefined;
  /** Puts a hand-off on the run's own log as it is answered. */
  log?: (line: string) => void;
};

/** What the Lab's person recorded for one attempt, by the attempt's ordinal. */
export type AttemptPersonRecords = { snapshotOf(ordinal: number): LabPersonSnapshot | undefined };

/**
 * The Lab playing the scenario's declared person for each attempt of a `lab attempt` run, as the legacy lane
 * plays it: the task's own declaration, the scenario's `PERSON_CHECKS`, and its answer pressed in the chat.
 * One person per attempt, started before the attempt's message and finished after the attempt stops, because
 * the Lab restarts Core between attempts and a person started before that would be reading a Core that is gone.
 * `playable` is whether the scenario declares a person at all: the watch follows a wait for a person on only then.
 */
export async function attemptPersonFor(input: AttemptPersonInput): Promise<LiveAttemptPerson & AttemptPersonRecords> {
  const module = await loadPersonChecks(input.scenarioLabDist, input.scenarioId);
  const snapshots = new Map<number, LabPersonSnapshot>();
  const scope = { projectId: input.projectId, domainId: LAB_PROJECT_DOMAIN_ID };
  const answerInChat = input.panel ? chatAnswerer(input.control, scope, input.panel) : undefined;
  return {
    playable: module !== null,
    snapshotOf: (ordinal) => snapshots.get(ordinal),
    start: async (ordinal): Promise<LiveAttemptPersonRun> => {
      const person = await startLabPerson({
        control: input.control, projectId: input.projectId, context: input.context, scenarioOrigin: input.scenarioOrigin, runToken: input.runToken,
        scenarioId: input.scenarioId, scenarioLabDist: input.scenarioLabDist, workflowId: input.workflowId, variantId: input.variantId,
        task: input.task, permissions: { point: input.permissionPoint }, ...(answerInChat ? { answerInChat } : {}),
        write: async (snapshot) => { snapshots.set(ordinal, snapshot); },
        publish: async (handOff: PersonHandOff) => { input.log?.(`[attempt] the Lab played the person at a check: ${handOff.check ?? "none showing"}, ${handOff.did}, answered ${handOff.answer ?? "nothing"}${handOff.via ? ` in the ${handOff.via}` : ""}`); },
        publishPermission: async (answer: PersonPermissionAnswer) => { input.log?.(`[attempt] the Lab answered a permission question as the person: ${JSON.stringify(answer)}`); },
      });
      return { finish: () => person.finish() };
    },
  };
}

/** Presses the answer where the person at the chat would, for a question on the chat's own thread; any other is Core's to answer. */
function chatAnswerer(core: PersonAskControl, scope: { projectId: string; domainId: string }, panel: ChatPanelDriver): PersonChatAnswerer {
  return async (ask, answer) => {
    if (ask.subject?.kind !== CHAT_SUBJECT) return false;
    await panel.press(await answerLabel(core, scope, ask, answer), PRESS_MS);
    await settled(core, scope, ask);
    return true;
  };
}

async function answerLabel(core: PersonAskControl, scope: { projectId: string; domainId: string }, ask: PendingPersonAsk, answer: PersonAskAnswer): Promise<string> {
  if (answer.kind !== "choice") {
    if (answer.kind === "grant") return ask.kind === "permission" ? "Allow" : "Yes";
    return ask.kind === "permission" ? "Don't allow" : "No";
  }
  const turn = await askTurn(core, scope, ask);
  const options = isRecord(turn?.ask) && Array.isArray(turn.ask.options) ? turn.ask.options.filter(isRecord) : [];
  const option = options.find((candidate) => candidate.id === answer.value);
  if (typeof option?.label !== "string") throw new Error(`The chat's question offers no option ${answer.value} to press (ask ${ask.askId})`);
  return option.label;
}

/** Waits until Core holds an answer to `ask`, so a press the panel lost fails here and does not leave the question waiting. */
async function settled(core: PersonAskControl, scope: { projectId: string; domainId: string }, ask: PendingPersonAsk): Promise<void> {
  const deadline = Date.now() + SETTLE_MS;
  for (;;) {
    const turn = await askTurn(core, scope, ask);
    if (isRecord(turn?.ask) && turn.ask.status !== "pending") return;
    if (Date.now() >= deadline) throw new Error(`The answer pressed in the extension's chat did not reach FluxIQ within ${SETTLE_MS / 1000} s (ask ${ask.askId})`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function askTurn(core: PersonAskControl, scope: { projectId: string; domainId: string }, ask: PendingPersonAsk): Promise<Record<string, unknown> | undefined> {
  const payload = await core.automationStudioCall("get-conversation", { projectId: scope.projectId, conversationId: ask.conversationId, limit: 200 }, { timeoutMs: 10_000 }, scope.domainId);
  const conversation = isRecord(payload) && isRecord(payload.conversation) ? payload.conversation : {};
  const turns = Array.isArray(conversation.turns) ? conversation.turns.filter(isRecord) : [];
  return turns.find((turn) => isRecord(turn.ask) && turn.ask.askId === ask.askId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
