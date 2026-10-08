// The created-Flow lane's chat entry against a fake Core, for the lane's tests:
// the typed instruction makes, builds and applies the Flow, as Core's chat
// command does. Shared by `lane.test.ts` and `lane-candidate.test.ts`.

import type { CreatedFlowLaneEntry } from "../lane.js";
import { ADAPTATION_ID, FLOW_ID, PROJECT_ID, fakeCreationCore, type FakeCreationCoreOptions } from "./fake-creation-core.js";

/** A fake Core with a chat in front of it: the typed instruction makes, builds and applies the Flow, as Core's chat command does. */
export function chatCore(options: FakeCreationCoreOptions = {}): { core: ReturnType<typeof fakeCreationCore>; entry: CreatedFlowLaneEntry; typed: string[] } {
  const core = fakeCreationCore({ adaptationStatus: "applied", ...options });
  const base = core.control;
  const turns: Array<Record<string, unknown>> = [];
  let made = false;
  const typed: string[] = [];
  core.control = {
    ...base,
    automationStudioCall: async (endpoint, payload, bounds, domainId) => {
      if (endpoint === "list-flows") { core.calls.push(endpoint); return { flows: made ? [{ flow: { flowId: FLOW_ID, metadata: {} } }] : [] }; }
      if (endpoint === "list-conversations") return { conversations: [{ conversationId: "conversation.chat", pendingAskCount: 0, subject: { kind: "project", id: PROJECT_ID } }] };
      if (endpoint === "get-conversation") return { conversation: { turns, hasMore: false } };
      return base.automationStudioCall(endpoint, payload, bounds, domainId);
    },
    listFlowAdaptations: async (projectId, flowId) => (made ? [{ adaptationId: ADAPTATION_ID, projectId, flowId, status: "applied" }] : []),
    getFlowAdaptation: async (projectId, flowId, adaptationId) => ({ ...await base.getFlowAdaptation(projectId, flowId, adaptationId), appliedMutationCount: 2 }),
  };
  const entry: CreatedFlowLaneEntry = {
    kind: "chat",
    authorizeChat: async () => { core.calls.push("authorize-chat"); },
    chat: {
      panelInput: "view-dom",
      type: async (text) => {
        typed.push(text);
        turns.push({ turnId: "t1", ordinal: 1, author: "person", text, ask: null, attachment: null });
        turns.push({ turnId: "t2", ordinal: 2, author: "automation", text: 'Doing "Create an automation here".', ask: null, attachment: null });
        // Core's own apply, made inside the chat's command, which the fake records as a call; it is not one the lane made.
        await base.applyFlowAdaptation({ projectId: PROJECT_ID, flowId: FLOW_ID, adaptationId: ADAPTATION_ID, authorizationPin: "" });
        core.calls.splice(core.calls.lastIndexOf("apply"), 1);
        made = true;
        turns.push({ turnId: "t3", ordinal: 3, author: "automation", text: 'Created the Flow "x".', ask: null, attachment: { kind: "panel-capability-result", ref: "flow.createHere" } });
      },
      shows: async () => "",
    },
    wait: { pollMs: 1 },
  };
  return { core, entry, typed };
}
