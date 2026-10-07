// The created-Flow build as a person starts one: the task's instruction typed
// into the extension's chat window beside the page and sent, and the build
// followed through Core and the chat thread until it ends.
//
// Nothing here calls Core's build endpoints. The panel sends the message, the
// extension's relay hands it to Core with the page the person is on, and Core's
// chat decides what to do with it -- for a job described on a site, its
// `flow.createHere` command, which creates the Flow, saves the instruction,
// explores from the page, and approves and applies its own proposal on the new
// Flow (`runtime/conversations/commands/create-here.ts` in FluxIQ Core). This
// module only watches: the thread for the person's turn, FluxIQ's answer and
// the build's result, the project for the Flow that was not there before, and
// that Flow's proposal for what the build did and spent.
//
// A question the build asks lands in this same thread, and the Lab's person
// answers it in the chat (`person-simulation/`), by the task's permission
// point, as the person sitting at the panel would.

import type { AutomationStudioAuthoringMode } from "fluxiq/automation-studio";
import { RunnerFailure } from "../../../failure.js";
import { assertCreatedFlowVerificationReady } from "../readiness.js";
import { createdFlowBuildFromDiagnostic, failedCreatedFlowBuild, readCreatedFlowBuild, type CreatedFlowBuild, type CreatedFlowBuildControl } from "../build-proposal.js";
import type { CreatedFlowChatRecord } from "./chat-record.js";
import { chatConversationIds, chatThreadTurns, projectFlowIds, type CreatedFlowChatScope, type CreatedFlowChatTurn } from "./chat-thread.js";

/** The chat window the person types in, as the stage drives it. */
export type CreatedFlowChat = {
  /** How the panel is typed into: Playwright's trusted input, or script in the panel's own document. */
  panelInput: CreatedFlowChatRecord["panelInput"];
  /** Types `text` into the chat's composer and presses Send, as a person does. */
  type(text: string): Promise<void>;
  /** What the chat shows now, for a failure that has to say what the person saw. */
  shows(): Promise<string>;
  /** A picture of the chat at one of the stage's moments. It must not throw. */
  picture?(moment: "sent" | "answered" | "ended"): Promise<void>;
};

export type CreatedFlowChatControl = Pick<CreatedFlowBuildControl, "automationStudioCall" | "listFlowAdaptations" | "getFlowAdaptation">;

/**
 * Clocks and bounds. `sendMs`: from Send to the person's turn in Core.
 * `answerMs`: from there to FluxIQ's answer, which Core gives within its own
 * 24 s reading deadline. `startMs`: from the answer to the first sign of a
 * build -- a new Flow, which `create-here` makes before anything else, or the
 * command's result. `deadlineMs`: from Send to the build's result, the build's
 * own deadline (`GENERATION_DEADLINE_MS`) plus the chat's steps around it.
 */
export type CreatedFlowChatWait = { now?: () => number; sleep?: (ms: number) => Promise<void>; pollMs?: number; sendMs?: number; answerMs?: number; startMs?: number; deadlineMs?: number };

/**
 * What the chat built. `build` is the build record, carrying `chat`. `flowId`
 * is the Flow the chat made, `null` when it made none. `applied` is the change
 * the chat put into it, `null` unless it did. `said` is FluxIQ's own last word
 * about the instruction in the thread -- its answer when it built nothing, the
 * build's result otherwise -- whole, so a failure says why in all of FluxIQ's
 * words, and the build record's `chat.said` holds the same words on every
 * ending. It is not cut: live run `run-murzln6g-11debe1d` lost the end of its
 * ending ("...was not...") in every record, and the evidence bundle already
 * screens what it writes for secrets.
 */
export type CreatedFlowChatBuild = Readonly<{
  build: CreatedFlowBuild;
  flowId: string | null;
  applied: Readonly<{ adaptationId: string; appliedMutationCount: number }> | null;
  said: string | null;
}>;

/** The attachment Core puts on a chat command's result turn, with the command's capability id as its reference. */
const RESULT_ATTACHMENT = "panel-capability-result";
const CREATE_HERE = "flow.createHere";
/** Core's own note on an answer it gave without the model (`instructions/respond.ts`). */
const READ_WITHOUT_MODEL = /I read your message without the model/u;
const POLL_MS = 500;
const SEND_MS = 60_000;
const ANSWER_MS = 60_000;
const START_MS = 30_000;
const DEADLINE_MS = 60_000 + 600_000 + 15_000 + 120_000;

/**
 * Types the instruction into the chat, sends it, and follows what FluxIQ made
 * of it to the end. Throws only when the chat never carried the message to
 * FluxIQ or FluxIQ never answered it; every other ending -- nothing built,
 * something else run, a build that failed, ran out of time or waits on a
 * question -- is a build record, so the run can settle what was spent before
 * it fails on the ending.
 */
export async function buildCreatedFlowFromChat(
  control: CreatedFlowChatControl,
  chat: CreatedFlowChat,
  input: CreatedFlowChatScope & { instruction: string; authoringMode: AutomationStudioAuthoringMode },
  wait: CreatedFlowChatWait = {},
): Promise<CreatedFlowChatBuild> {
  // Only a legacy-mode Core builds a Flow the lane can run (`../readiness.ts`).
  assertCreatedFlowVerificationReady(input.authoringMode);
  const now = wait.now ?? Date.now;
  const sleep = wait.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const pollMs = wait.pollMs ?? POLL_MS;
  const until = async <T>(ms: number, look: () => Promise<T | undefined>): Promise<T | undefined> => {
    const deadline = now() + ms;
    for (;;) {
      const found = await look();
      if (found !== undefined) return found;
      if (now() >= deadline) return undefined;
      await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
    }
  };
  const scope: CreatedFlowChatScope = { projectId: input.projectId, domainId: input.domainId };
  const flowsBefore = new Set(await projectFlowIds(control, scope));
  const sentBefore = new Set((await allPersonTurns(control, scope, input.instruction)).map(({ turn }) => turn.turnId));

  const sentAt = now();
  await chat.type(input.instruction);
  const sent = await until(wait.sendMs ?? SEND_MS, async () => (await allPersonTurns(control, scope, input.instruction)).find(({ turn }) => !sentBefore.has(turn.turnId)));
  if (!sent) {
    const shown = await chat.shows().then((text) => text.slice(-300), (error: unknown) => `(the chat could not be read: ${firstLine(error)})`);
    throw new RunnerFailure("runtime.behavior", `The extension's chat did not carry the task's instruction to FluxIQ within ${seconds(wait.sendMs ?? SEND_MS)} s of Send; the chat showed: ${JSON.stringify(shown)}`, { details: { stage: "chat.send", panelInput: chat.panelInput } });
  }
  const { conversationId } = sent;
  const personTurn = sent.turn.ordinal;
  await chat.picture?.("sent");
  const after = (turns: readonly CreatedFlowChatTurn[]) => turns.filter((turn) => turn.ordinal > personTurn);
  const thread = () => chatThreadTurns(control, scope, conversationId);

  const answer = await until(wait.answerMs ?? ANSWER_MS, async () => after(await thread()).find((turn) => turn.author !== "person"));
  if (!answer) throw new RunnerFailure("runtime.behavior", `FluxIQ's chat never answered the task's instruction within ${seconds(wait.answerMs ?? ANSWER_MS)} s`, { details: { stage: "chat.answer", conversationId, personTurn } });
  await chat.picture?.("answered");
  const record = (turns: readonly CreatedFlowChatTurn[], fields: Pick<CreatedFlowChatRecord, "became" | "ending" | "resultTurn" | "secondsToEnding" | "said"> & { otherCapability?: string }): CreatedFlowChatRecord => Object.freeze({
    conversationId,
    panelInput: chat.panelInput,
    personTurn,
    answerTurn: answer.ordinal,
    readWithoutModel: READ_WITHOUT_MODEL.test(answer.text),
    asks: askCounts(after(turns)),
    ...fields,
  });

  // Did a build start? `create-here` makes the Flow first, in the same moment
  // the answer is written; a command that ended as quickly leaves its result.
  const newFlows = async () => (await projectFlowIds(control, scope)).filter((flowId) => !flowsBefore.has(flowId));
  const started = await until(wait.startMs ?? START_MS, async () => {
    const turns = await thread();
    const result = after(turns).find(isResult);
    if (result || (await newFlows()).length > 0) return { turns, result };
    return undefined;
  });
  if (!started || (started.result && started.result.attachment!.ref !== CREATE_HERE)) {
    const turns = started?.turns ?? await thread();
    const other = started?.result?.attachment?.ref;
    const said = (started?.result ?? answer).text;
    const chatRecord = record(turns, { became: other ? "other_capability" : "no_build", ...(other ? { otherCapability: other } : {}), ending: "failed", resultTurn: started?.result?.ordinal ?? null, secondsToEnding: null, said });
    await chat.picture?.("ended");
    const build = failedCreatedFlowBuild({ code: other ? "lab.chat_ran_other_capability" : "lab.chat_started_no_build", stage: "chat", httpStatus: null }, "not_attempted", now() - sentAt);
    return Object.freeze({ build: Object.freeze({ ...build, chat: chatRecord }), flowId: null, applied: null, said });
  }

  const ended = started.result ?? await until(Math.max(0, (wait.deadlineMs ?? DEADLINE_MS) - (now() - sentAt)), async () => after(await thread()).find((turn) => isResult(turn) && turn.attachment!.ref === CREATE_HERE));
  const durationMs = now() - sentAt;
  const turns = await thread();
  await chat.picture?.("ended");
  const made = await newFlows();
  if (made.length > 1) throw new RunnerFailure("runtime.behavior", `FluxIQ's chat made ${made.length} Flows for one instruction`, { details: { stage: "chat.flow", conversationId, flows: made.length } });
  const flowId = made[0] ?? null;
  const said = ended ? ended.text : null;
  // FluxIQ's ending words go on the record on every ending, a created one too (run-musp8nz1-dbd3905a, cause R1).
  const ending = (fields: Pick<CreatedFlowChatRecord, "ending">) => record(turns, { became: "build", resultTurn: ended?.ordinal ?? null, secondsToEnding: ended ? Math.round(durationMs / 100) / 10 : null, said, ...fields });
  if (!ended || flowId === null) {
    const code = !ended ? "lab.chat_build_unfinished" : "lab.chat_build_failed";
    const build = failedCreatedFlowBuild({ code, stage: "chat", httpStatus: null }, "unknown", durationMs);
    return Object.freeze({ build: Object.freeze({ ...build, chat: ending({ ending: ended ? "failed" : "no_result" }) }), flowId, applied: null, said });
  }

  // A Core that saved a candidate draft instead (candidate mode, refused above
  // before anything was typed): an unverified reference, never a created Flow.
  const draft = turns.find((turn) => turn.author === "automation" && turn.attachment?.kind === "candidate-draft" && typeof turn.attachment.ref === "string" && turn.attachment.ref.length > 0 && turn.attachment.ref.length <= 200);
  if (draft) {
    const build = failedCreatedFlowBuild({ code: "lab.verification_pending", stage: "verification", httpStatus: null }, "unknown", durationMs);
    return Object.freeze({ build: Object.freeze({ ...build, outcome: "draft" as const, failure: null, candidateReference: Object.freeze({ candidateId: draft.attachment!.ref, verification: "not_performed" as const }), chat: ending({ ending: "draft" }) }), flowId, applied: null, said });
  }

  const proposals = await control.listFlowAdaptations(input.projectId, flowId);
  if (proposals.length > 1) throw new RunnerFailure("runtime.behavior", `FluxIQ's chat left ${proposals.length} proposals on the Flow one instruction built`, { details: { stage: "chat.proposal", conversationId, flowId, proposals: proposals.length } });
  const proposal = proposals[0];
  if (!proposal) {
    // The build ended without leaving a change behind. Core told the person in
    // words, and keeps the build's diagnostic -- what it spent, how far it got --
    // for a reader that started it this way (`get-flow-bootstrap-failure`).
    const build = await failedBuildOf(control, scope, flowId, durationMs);
    return Object.freeze({ build: Object.freeze({ ...build, chat: ending({ ending: "failed" }) }), flowId, applied: null, said });
  }
  const read = await readCreatedFlowBuild(control, { projectId: input.projectId, flowId }, proposal.adaptationId, { recoveredAfterTimeout: false, durationMs, statuses: ["proposed", "validated", "applied"] });
  if (read.build.outcome === "permission_required") {
    return Object.freeze({ build: Object.freeze({ ...read.build, chat: ending({ ending: "awaiting_permission" }) }), flowId, applied: null, said });
  }
  if (read.build.outcome === "proposed" && read.status === "applied") {
    return Object.freeze({ build: Object.freeze({ ...read.build, chat: ending({ ending: "created" }) }), flowId, applied: Object.freeze({ adaptationId: proposal.adaptationId, appliedMutationCount: read.appliedMutationCount ?? 0 }), said });
  }
  // A well-formed proposal the chat did not put into the Flow: its own apply failed, and the thread says why.
  const failure = read.build.failure ?? { code: "lab.chat_not_applied", stage: "review", httpStatus: null };
  return Object.freeze({ build: Object.freeze({ ...read.build, outcome: "failed" as const, failure, chat: ending({ ending: "failed" }) }), flowId, applied: null, said });
}

/**
 * The chat's failed build of `flowId`, with what it spent when Core kept its
 * diagnostic. The failure stays the chat's (`lab.chat_build_failed`), with
 * Core's own code first among its causes. Live run `run-muq3ubys-4b4dbf5b`
 * spent $0.227 and the spend ledger recorded $0, because this read nothing.
 * A Core that keeps no diagnostic, or does not answer, leaves today's record:
 * a failure whose spend is unknown.
 */
async function failedBuildOf(control: CreatedFlowChatControl, scope: CreatedFlowChatScope, flowId: string, durationMs: number): Promise<CreatedFlowBuild> {
  const chatFailure = { code: "lab.chat_build_failed", stage: "chat" as const, httpStatus: null };
  let kept: unknown;
  try {
    const answer = await control.automationStudioCall("get-flow-bootstrap-failure", { projectId: scope.projectId, flowId }, {}, scope.domainId);
    kept = answer && typeof answer === "object" ? (answer as { failure?: unknown }).failure : undefined;
  } catch {
    kept = undefined;
  }
  const build = kept ? createdFlowBuildFromDiagnostic(kept, durationMs, null) : undefined;
  if (!build) return failedCreatedFlowBuild(chatFailure, "unknown", durationMs);
  const causes = [build.failure!.code, ...(build.failure!.issueCodes ?? [])];
  return Object.freeze({ ...build, outcome: "failed" as const, failure: { ...chatFailure, issueCodes: [...new Set(causes)] } });
}

/** Every person turn in the project's threads whose words are `text`, with its thread. */
async function allPersonTurns(control: CreatedFlowChatControl, scope: CreatedFlowChatScope, text: string): Promise<Array<{ conversationId: string; turn: CreatedFlowChatTurn }>> {
  const found: Array<{ conversationId: string; turn: CreatedFlowChatTurn }> = [];
  for (const conversationId of await chatConversationIds(control, scope)) {
    for (const turn of await chatThreadTurns(control, scope, conversationId)) {
      if (turn.author === "person" && turn.text.trim() === text.trim()) found.push({ conversationId, turn });
    }
  }
  return found;
}

function isResult(turn: CreatedFlowChatTurn): boolean {
  return turn.attachment?.kind === RESULT_ATTACHMENT;
}

/** The questions the thread carried after the instruction, by kind: a permission, a check only a person may pass, anything else. */
function askCounts(turns: readonly CreatedFlowChatTurn[]): CreatedFlowChatRecord["asks"] {
  const asks = turns.flatMap((turn) => (turn.ask ? [turn.ask] : []));
  const permission = asks.filter((ask) => ask.kind === "permission").length;
  const personCheck = asks.filter((ask) => ask.controlKind === "person_check").length;
  return Object.freeze({ permission, personCheck, other: asks.length - permission - personCheck });
}

function seconds(ms: number): number {
  return Math.round(ms / 1000);
}

function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n", 1)[0]!.slice(0, 160);
}
