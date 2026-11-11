// The chat's thread list changing Core's threads: a person's own name for a
// thread (`rename-conversation`), and deleting one (`delete-conversation`).
//
// Each message is one Core call, and Core's answer comes back as Core sent it:
// the renamed `conversation`, or `{ deleted, conversationId }`, or Core's
// refusal in its own words -- `conversation_run_active` while work still runs
// in the thread, an empty or too long name, a thread it cannot find.
//
// The project is the thread's own, as its list row named it. Left out, it stays
// out, and Core looks for the thread in every project this browser may change.
// The session's project is never put in its place: the list spans every
// project when none is open, so its thread may live in another one, and would
// then read as not found.
//
// Core takes a paired browser's change only with exactly these fields (its
// program route's `narrowThreadChange`): a rename carries `projectId`,
// `conversationId` and `title`; a delete `projectId` and `conversationId`. Any
// other field makes Core refuse the whole request, so each body is written key
// by key against its contract (`present`), never spread from the message.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import { present } from "../../shared/present";
import type { PanelConversationDeleteRequest, PanelConversationRenameRequest, PanelRelayResponse } from "../../shared/protocol";
import type { PanelRelayContext } from "./relay-context";
import { relayFailure } from "./relay-failure";

type ThreadChangeMessage = { readonly type?: string; readonly [key: string]: unknown };

/** Relays a rename or a delete of one thread. Undefined for any other message type. */
export async function relayThreadChange(message: ThreadChangeMessage, context: PanelRelayContext): Promise<PanelRelayResponse | undefined> {
  if (message.type === RUNTIME_MESSAGES.panelConversationRename) {
    const conversationId = text(message.conversationId);
    if (!conversationId) return relayFailure("invalid_request", "Say which conversation to rename.");
    // Core trims the name and judges it, empty or too long, in its own words.
    if (typeof message.title !== "string") return relayFailure("invalid_request", "Give the conversation a name.");
    return context.call("rename-conversation", present<PanelConversationRenameRequest>({ projectId: text(message.projectId), conversationId, title: message.title }));
  }
  if (message.type === RUNTIME_MESSAGES.panelConversationDelete) {
    const conversationId = text(message.conversationId);
    if (!conversationId) return relayFailure("invalid_request", "Say which conversation to delete.");
    return context.call("delete-conversation", present<PanelConversationDeleteRequest>({ projectId: text(message.projectId), conversationId }));
  }
  return undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
