import type { ChatOwner } from "../owner-context";
import type { PanelStore } from "../../state";

/** Keeps composer ownership aligned with selected chat scope, retaining remote lease validity. */
export function createProjectDraftOwner(): { capture(remote: ChatOwner, projectId: string | undefined, remoteProjectId?: string): ChatOwner } {
  let lastRemote: ChatOwner | undefined, lastProject: string | undefined, current: ChatOwner | undefined;
  return {
    capture(remote, projectId, remoteProjectId) {
      if (projectId !== undefined && projectId === remoteProjectId) projectId = undefined;
      if (current !== undefined && lastRemote?.token === remote.token && lastProject === projectId) return current;
      lastRemote = remote; lastProject = projectId;
      if (projectId === undefined) return current = remote;
      const token = {};
      const valid = () => current?.token === token && remote.current();
      return current = {
        token, identity: JSON.stringify([remote.identity, "chat-project", projectId]), current: valid,
        request: <T>(message: Parameters<PanelStore["request"]>[0]) => valid()
          ? remote.request<T>(message)
          : Promise.resolve({ ok: false as const, sentence: "This chat context has changed. Try again." }),
      };
    }
  };
}
