// Core's asks for a person, read and answered the way a person's panel does:
// through the conversation endpoints (`list-conversations`, `get-conversation`,
// `answer-ask`). Two kinds are the Lab person's. A person-needed ask, raised
// when FluxIQ meets a check only a person may pass
// (`AS/runtime/parking/person-needed-ask.ts` in FluxIQ Core). And a permission
// ask, raised when a build or a repair reaches an act with a lasting
// consequence the work was not permitted, keyed by the request's own id
// (`AS/runtime/parking/permission-ask.ts`). Both come on the Flow's thread
// during a build and on the run's thread during a run, and Core waits in place
// for the answer.

import type { FluxIQHttpOptions } from "../http-control/index.js";
import { permissionQuestionOf } from "../flow-lane/index.js";
import type { PersonHandOffStage } from "./hand-off-record.js";

/** `control.kind` on every person-needed ask, and on nothing else: Core's marker, so no ask is recognised by its words. */
export const PERSON_CHECK_CONTROL_KIND = "person_check";
/** The option a person presses once they have completed the check. */
export const PERSON_DONE = "person_done";
/** The option a person presses to stop the work instead. */
export const PERSON_STOP = "person_stop";

/** The one Core call the Lab's person makes; `ExistingFluxIQControlClient` satisfies it. */
export type PersonAskControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
};

export type PendingPersonAsk = Readonly<{
  askId: string;
  conversationId: string;
  subject: Readonly<{ kind: string; id: string }> | null;
  stage: PersonHandOffStage;
  /** When Core raised the ask, in milliseconds since the epoch. */
  createdAt: number;
}> & (
  | Readonly<{ kind: "person_check" }>
  /** `missing` is the classes the work was not permitted; `controlName` the control Core named, as Core bounded it, or `null` when it named none. */
  | Readonly<{ kind: "permission"; missing: readonly string[]; controlName: string | null }>
);

/** How a person answers a permission ask: allow the act, or refuse it. */
export type PermissionAskAnswer = "grant" | "deny";

/** Where the asks are read: the project, and the domain it belongs to, which Core holds every call to. */
export type PersonAskScope = { projectId: string; domainId: string };

const READ_BOUNDS: FluxIQHttpOptions = { timeoutMs: 10_000 };
/** A thread's turns are read a page at a time. */
const TURN_PAGE = 200;
/** No thread in a Lab run is longer than this many pages; a reader past it is reading a loop. */
const MAX_PAGES = 20;

/**
 * Every ask for a person still waiting in the project, oldest first.
 *
 * Only threads Core says have a pending ask are opened, and within them only
 * a pending ask of the two kinds above is returned: a choice carrying
 * `control.kind: "person_check"`, and a `permission`. Every other ask -- a
 * question about the Flow, a confirmation -- is someone else's to answer and
 * is left alone.
 */
export async function pendingPersonAsks(control: PersonAskControl, scope: PersonAskScope): Promise<PendingPersonAsk[]> {
  const listed = record(await control.automationStudioCall("list-conversations", { projectId: scope.projectId }, READ_BOUNDS, scope.domainId));
  const threads = Array.isArray(listed.conversations) ? listed.conversations.filter(isRecord) : [];
  const asks: PendingPersonAsk[] = [];
  for (const thread of threads) {
    if (typeof thread.conversationId !== "string" || !(Number(thread.pendingAskCount) > 0)) continue;
    const subject = subjectOf(thread.subject);
    for (const turn of await turnsOf(control, scope, thread.conversationId)) {
      const ask = isRecord(turn.ask) ? turn.ask : undefined;
      if (!ask || ask.status !== "pending" || typeof ask.askId !== "string") continue;
      const raised = { askId: ask.askId, conversationId: thread.conversationId, subject, stage: stageOf(subject), createdAt: typeof ask.createdAt === "number" ? ask.createdAt : Date.now() };
      if (ask.kind === "permission") {
        const question = permissionQuestionOf(ask);
        asks.push(Object.freeze({ ...raised, kind: "permission" as const, missing: Object.freeze([...question.missing]), controlName: question.controlName }));
        continue;
      }
      if (ask.kind !== "choice" || !isRecord(ask.control) || ask.control.kind !== PERSON_CHECK_CONTROL_KIND) continue;
      asks.push(Object.freeze({ ...raised, kind: "person_check" as const }));
    }
  }
  return asks.sort((left, right) => left.createdAt - right.createdAt);
}

/** Answers one person-needed ask with the option the person pressed. Flat, as Core's `answer-ask` takes it. */
export async function answerPersonAsk(control: PersonAskControl, scope: PersonAskScope, askId: string, option: typeof PERSON_DONE | typeof PERSON_STOP): Promise<void> {
  await control.automationStudioCall("answer-ask", { projectId: scope.projectId, askId, kind: "choice", value: option }, READ_BOUNDS, scope.domainId);
}

/** Answers one permission ask: `grant` allows the act and releases the waiting work, `deny` refuses it. Flat, as Core's `answer-ask` takes it. */
export async function answerPermissionAsk(control: PersonAskControl, scope: PersonAskScope, askId: string, answer: PermissionAskAnswer): Promise<void> {
  await control.automationStudioCall("answer-ask", { projectId: scope.projectId, askId, kind: answer }, READ_BOUNDS, scope.domainId);
}

/** Every turn of one thread, a page at a time. */
async function turnsOf(control: PersonAskControl, scope: PersonAskScope, conversationId: string): Promise<Record<string, unknown>[]> {
  const turns: Record<string, unknown>[] = [];
  let sinceTurnId: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const payload = record(await control.automationStudioCall("get-conversation", { projectId: scope.projectId, conversationId, limit: TURN_PAGE, ...(sinceTurnId ? { sinceTurnId } : {}) }, READ_BOUNDS, scope.domainId));
    const thread = isRecord(payload.conversation) ? payload.conversation : {};
    const read = Array.isArray(thread.turns) ? thread.turns.filter(isRecord) : [];
    turns.push(...read);
    const last = read.at(-1)?.turnId;
    if (thread.hasMore !== true || typeof last !== "string") break;
    sinceTurnId = last;
  }
  return turns;
}

/** The build asks on the Flow's thread (`flow`, or `build`), a run on its own (`run`). */
function stageOf(subject: PendingPersonAsk["subject"]): PersonHandOffStage {
  if (subject?.kind === "run") return "run";
  if (subject?.kind === "flow" || subject?.kind === "build") return "build";
  return "unknown";
}

function subjectOf(value: unknown): PendingPersonAsk["subject"] {
  return isRecord(value) && typeof value.kind === "string" && typeof value.id === "string" ? Object.freeze({ kind: value.kind, id: value.id }) : null;
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
