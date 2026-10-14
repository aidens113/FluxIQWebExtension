// A build with several agents in the chat (automation-project-agents-plan,
// chat presentation; unit W2). No DOM.
//
// Each card of the project supervisor's work -- its plan, a brief it
// dispatched, the builder's return, a validator's receipt -- is a message of
// its own, a `project` message: a heading and one card in words
// (`project-words.ts`), keyed by the note row that carried it like any step
// message. A brief's card works until the return for that brief arrives, and
// then shows how the builder came back.
//
// Every other message keeps its author (`agent`). A builder's steps follow
// the brief that dispatched them, so the brief is their subflow header; a
// message whose agent's lane is not the lane of the message before it in its
// unit of work names its lane (`lane`: "Builder · Search", "Validator",
// "Supervisor"), so steps that come back to a lane, or interleave with
// another, still say whose they are. Right after a brief its builder's first
// step names no lane: the brief just did.

import { activityAgent, projectCard, type ActivityAgent, type ActivityProjectCard, type ClientGatewayActivity } from "../../../../shared/activity/index";
import type { StepMessage } from "./messages";
import { laneWords, projectWords, type ProjectNames } from "./project-words";

type Brief = Extract<ActivityProjectCard, { kind: "brief" }>;

/** Builds the build's project messages, remembering what each card named for the cards after it. */
export type ProjectMessages = {
  /** The message for `card`, carried by `event`'s note row, opened at `at`. */
  message(event: ClientGatewayActivity, card: ActivityProjectCard, at: number): StepMessage;
};

/** A fresh book of one stream's project cards. */
export function projectMessages(): ProjectMessages {
  const briefs = new Map<string, Pick<Brief, "brief" | "subflowName">>();
  const subflows = new Map<string, string>();
  const names: ProjectNames = { briefs, subflows };
  /** Each brief's message by the brief's id, so its return marks its card. */
  const dispatched = new Map<string, StepMessage>();

  return {
    message(event, card, at) {
      const words = projectWords(card, names, activityAgent(event));
      const message: StepMessage = {
        key: `step:${event.activityId}#${event.sequence}`,
        activityId: event.activityId,
        kind: "project",
        title: words.title,
        text: words.text,
        actions: [],
        at,
        sequence: event.sequence,
        latest: false,
        project: words
      };
      if (card.kind === "plan") for (const subflow of card.subflows) subflows.set(subflow.key, subflow.name);
      if (card.kind === "brief") {
        briefs.set(card.briefId, { brief: card.brief, subflowName: card.subflowName });
        dispatched.set(card.briefId, message);
      }
      if (card.kind === "return") {
        const brief = dispatched.get(card.briefId);
        if (brief?.project !== undefined) {
          brief.project = { ...brief.project, card: { ...brief.project.card, state: words.card.state } };
          brief.sequence = Math.max(brief.sequence, event.sequence);
        }
      }
      return message;
    }
  };
}

/**
 * `messages` with each one's author (`agent`) and, where its lane is not the
 * lane of the message before it in its unit of work, the lane's name
 * (`lane`). `events` are the events the messages were made from: each
 * message's key names the one that opened it.
 */
export function withAgents(messages: readonly StepMessage[], events: readonly ClientGatewayActivity[]): StepMessage[] {
  const opened = new Map<string, ClientGatewayActivity>();
  for (const event of events) opened.set(`step:${event.activityId}#${event.sequence}`, event);
  const last = new Map<string, string>();
  return messages.map((message) => {
    const event = opened.get(message.key);
    const agent = event === undefined ? undefined : activityAgent(event);
    const card = message.kind === "project" && event !== undefined ? projectCard(event) : undefined;
    // A brief is its builder's subflow header: the steps after it are in the builder's lane already.
    const lane = card?.kind === "brief" ? `${card.brief === "repair" ? "repair" : "builder"}:${card.briefId}` : laneOf(agent);
    const before = last.get(message.activityId);
    last.set(message.activityId, lane);
    if (agent === undefined) return message;
    const named = lane !== before && message.kind !== "project" ? laneWords(agent) : undefined;
    return { ...message, agent, ...(named === undefined ? {} : { lane: named }) };
  });
}

/** The lane an agent's steps run in: its role, and the brief it works on when it has one. */
function laneOf(agent: ActivityAgent | undefined): string {
  return agent === undefined ? "" : `${agent.role}:${agent.briefId ?? ""}`;
}
