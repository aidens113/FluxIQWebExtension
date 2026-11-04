// The real panel (`mountPanel`) over a scripted background, for the screens specs. This
// file runs in the browser, bundled by `panel-frame.ts` with the spec's own entry. It has
// no gateway, no Core and no model behind it: every answer is written here or by the spec.
import { mountPanel, type PanelPorts, type PanelSurface } from "../../../../src/panel";
import { targetCore } from "../../../../src/panel/chat/conversation/tests/target-core";
import { defaultSettings } from "../../../../src/shared/browser";
import type { PanelMessage } from "../../../../src/panel/state";

type Status = Record<string, unknown>;
type Answer = (message: { type: string } & Record<string, unknown>) => Promise<unknown> | undefined;

export type ScriptedPanelOptions = {
  surface?: PanelSurface;
  /** The status to start on: a key of `screens`. */
  start?: string;
  /** More statuses, on top of `disconnected`, `connected`. */
  screens?: Record<string, Status>;
  /** Answers a message before the defaults do; undefined falls through. */
  answer?: Answer;
  /** The threads the chat reads. */
  threads?: Parameters<typeof targetCore>[0];
  ports?: PanelPorts;
};

const settings = { ...defaultSettings(), coreApiUrl: "http://127.0.0.1:3000" };
const base = { recordingState: "idle", gatewayUrl: "ws://127.0.0.1:4777/client", clientId: "client-1", queueSize: 0, eventCount: 0, recentActivities: [], settings };

/** Mounts the panel into `#app`. `window.__show(name)` moves to another status; `window.__push(message)` broadcasts to the panel. */
export function startScriptedPanel(options: ScriptedPanelOptions = {}): void {
  const screens: Record<string, Status> = {
    disconnected: { ...base, connectionState: "disconnected", paired: false },
    connected: { ...base, connectionState: "connected", paired: true, projectId: "project-1" },
    ...options.screens
  };
  let status = screens[options.start ?? "connected"];
  const core = targetCore(options.threads ?? [{ conversationId: "conv-latest", subjectKind: "project", subjectId: "project-1", turns: [] }]);
  const answer = (message: { type: string } & Record<string, unknown>): Promise<unknown> => {
    const scripted = options.answer?.(message);
    if (scripted !== undefined) return scripted;
    switch (message.type) {
      case "fluxiq.getStatus": return Promise.resolve({ ok: true, status });
      case "fluxiq.panel.listAutomations": return Promise.resolve({ ok: true, payload: { flows: [], runs: [] } });
      case "fluxiq.panel.modelReadiness": return Promise.resolve({ ok: true, payload: { keys: [{ kind: "llm", provider: "scripted", enabled: true }] } });
      case "fluxiq.panel.activityRead": return Promise.resolve({ ok: true, state: { current: null, display: null, recent: [], history: [], overlay: "expanded", live: true } });
      default: return core.request(message as PanelMessage).then((result: { ok: boolean; value?: unknown }) => (result.ok ? result.value : { ok: false, error: "scripted" }));
    }
  };
  const listeners: Array<(message: unknown) => void> = [];
  const memory: Record<string, unknown> = {};
  const scope = window as unknown as Record<string, unknown>;
  scope.chrome = {
    runtime: {
      lastError: undefined, id: "extension-id", getURL: (path: string) => path,
      onMessage: { addListener: (fn: (message: unknown) => void) => listeners.push(fn), removeListener() {} },
      sendMessage: (message: { type: string }, callback?: (reply: unknown) => void) => { void answer(message).then((reply) => callback?.(reply)); }
    },
    storage: { local: {
      get: (keys: unknown, callback?: (items: Record<string, unknown>) => void) => callback?.({ ...memory }),
      set: (values: Record<string, unknown>, callback?: () => void) => {
        Object.assign(memory, values);
        callback?.();
      }
    } }
  };
  scope.__show = (name: string) => {
    status = screens[name];
    listeners.forEach((fn) => fn({ type: "fluxiq.statusChanged", status }));
  };
  scope.__push = (message: unknown) => listeners.forEach((fn) => fn(message));
  mountPanel(document.getElementById("app")!, options.surface ?? "sidepanel", options.ports ?? {});
}
