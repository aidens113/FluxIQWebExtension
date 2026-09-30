// Which thread the chat reads and where its messages go, for each target.
// No DOM.
//
//   latest      the project's own open thread (`list-conversations`, open,
//               subject kind `project`, limit 1). Not the most recently touched
//               thread of any kind: that is an automation's thread just after
//               the person used it, or a run's, so "Latest chat" would show the
//               automation they just left. The relay fills in the subject id,
//               which is the project id. A first message opens the project's
//               thread (`open-conversation` with no subject is the project).
//   automation  the open thread whose subject is that Flow (Core's subject
//               kind `flow`, id the Flow's id); a first message opens it with
//               that subject and the automation's name as its title. Core's
//               `open-conversation` continues the subject's open thread when
//               there is one, so a thread opened elsewhere (FluxIQ's own chat)
//               is the same thread here. Every message also says the Flow is on
//               screen (`onScreen.flowId`), which is what makes Core read "run
//               it" or "change the price column" as about this automation.
//   question    the open thread a build or a run asked the person in: the
//               target's own subject (`flow` and the Flow's id for a build,
//               `run` and the run's id for a run), which is where Core's
//               parking port writes the ask. A message there says which Flow
//               or run is on screen.
//
// The background relay passes these fields to Core unchanged, apart from the
// project thread's subject id (`background/panel/conversation-relay.ts`).

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelMessage } from "../../state";
import type { ChatTarget } from "../target";

/** The thread on screen, when there is one. */
export type ShownThread = { conversationId: string; projectId: string };

/** Core's subject kind for a thread about one Flow. */
const FLOW_SUBJECT = "flow";
/** Core's subject kind for the project's own thread. */
const PROJECT_SUBJECT = "project";

/** The request that finds `target`'s thread. */
export function threadListRequest(target: ChatTarget): PanelMessage {
  const request: PanelMessage = { type: RUNTIME_MESSAGES.panelConversationRead, kind: "list", status: "open", limit: 1 };
  if (target.kind === "automation") {
    request.subjectKind = FLOW_SUBJECT;
    request.subjectId = target.flowId;
  } else if (target.kind === "question") {
    request.subjectKind = target.subjectKind;
    request.subjectId = target.subjectId;
  } else {
    request.subjectKind = PROJECT_SUBJECT;
  }
  return request;
}

/** The request that sends `text` to `target`: into `shown` when there is one, or into a thread opened for it. */
export function threadSendRequest(target: ChatTarget, shown: ShownThread | undefined, text: string): PanelMessage {
  const request: PanelMessage = { type: RUNTIME_MESSAGES.panelConversationSend, text, conversationId: shown?.conversationId, projectId: shown?.projectId };
  if (target.kind === "automation") {
    request.onScreen = { flowId: target.flowId };
    if (shown === undefined) {
      request.subjectKind = FLOW_SUBJECT;
      request.subjectId = target.flowId;
      request.title = target.name;
    }
  } else if (target.kind === "question") {
    request.onScreen = target.subjectKind === FLOW_SUBJECT ? { flowId: target.subjectId } : { runId: target.subjectId };
    if (shown === undefined) {
      request.subjectKind = target.subjectKind;
      request.subjectId = target.subjectId;
    }
  }
  return request;
}
