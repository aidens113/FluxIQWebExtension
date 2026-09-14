// Shared deterministic harness for active-recording facade tests.

import type { TestContext } from "node:test";
import type {
  ActivityEntry,
  ConnectionState,
  FluxIQSession,
  FluxIQSettings,
  RecordingEventPayload,
  TabDescriptor,
  UnsupportedPageState
} from "../../../shared/protocol";
import type { ActivePage } from "../active-page";
import { ActiveRecording, type ActiveRecordingDeps } from "../active-recording";
import { ActivityLog } from "../activity-log";
import type { ContentAttachment } from "../content-attachment";
import { EventSequence } from "../event-sequence";
import { NavigationRecorder } from "../navigation-recorder";
import { PointerClickFilter } from "../pointer-click-filter";
import type { ProjectContext } from "../project-context";
import type { RecordingEvidenceReporter } from "../recording-evidence";
import { classifyRecordingStartRefusal } from "../recording-start/index";

// Hand-driven timers, on the pattern handshake.test.ts uses.
export function fakeTimers(t: TestContext) {
  const pending = new Map<number, { callback: () => void; delay: number }>();
  let nextId = 1;
  t.mock.method(globalThis, "setTimeout", (callback: () => void, delay = 0) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, { callback, delay });
    return id;
  });
  t.mock.method(globalThis, "clearTimeout", (id: number) => {
    pending.delete(id);
  });
  return {
    delays: () => [...pending.values()].map((timer) => timer.delay),
    count: () => pending.size,
    fire: (delay: number) => {
      const due = [...pending].filter(([, timer]) => timer.delay === delay);
      for (const [id] of due) pending.delete(id);
      for (const [, timer] of due) timer.callback();
    },
    fireAll: () => {
      const due = [...pending.values()];
      pending.clear();
      for (const timer of due) timer.callback();
    }
  };
}

// The start manifest describes the browser, which reads the extension manifest.
// Installed for one test and removed after it, so no other test sees a chrome.
export function stubManifest(t: TestContext): void {
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  holder.chrome = { runtime: { getManifest: () => ({ version: "0.0.0-test" }) } };
  t.after(() => {
    holder.chrome = previous;
  });
}

// Lets every promise chain the last call started run to completion.
export async function settle(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setImmediate(resolve));
}

type Sent = { type: string; payload: Record<string, unknown> };
type Activity = { kind: string; label: string; detail: string | undefined; tone: ActivityEntry["tone"] | undefined };

export const STALE = classifyRecordingStartRefusal({
  code: "recording.project_required",
  message: "",
  metadata: { activeProjectId: "project-1" }
});
export const NO_PROJECT = classifyRecordingStartRefusal({ code: "recording.project_required", message: "" });

export function harness(options: {
  gatewayState?: ConnectionState;
  unsupported?: UnsupportedPageState;
  projectId?: string;
  navigation?: NavigationRecorder;
  send?: (type: string, payload: Record<string, unknown>) => Promise<void>;
  // Replaces the project lookup's answer, so a row can hold it open.
  lookup?: () => Promise<string | undefined>;
  // Holds the UI-only evidence preflight so a server start can reach the final
  // lifecycle gate in a controlled order.
  initialState?: (timestamp: number) => Promise<{ timestamp: number }>;
  persist?: (session: FluxIQSession) => Promise<void>;
  allTabs?: () => Promise<TabDescriptor[]>;
} = {}) {
  const settings = { gatewayUrl: "ws://gateway.test" } as FluxIQSettings;
  let session = { clientId: "client-1" } as FluxIQSession;
  let lastError: string | undefined;
  let activeProject: string | null | undefined;
  const sent: Sent[] = [];
  const activities: Activity[] = [];
  const recorded: Array<{ payload: RecordingEventPayload; tabId: number | undefined }> = [];
  const resolveReasons: string[] = [];
  const snapshots: string[] = [];
  const broadcasts: unknown[] = [];
  const attached: number[] = [];
  const scriptedNavigationCancellations: string[] = [];
  const tabs: TabDescriptor[] = [{ tabId: 7, url: "https://shop.test/cart" }];
  let activeRecording: ActiveRecording | undefined;

  const page = {
    refresh: async () => undefined,
    unsupported: () => options.unsupported,
    url: () => "https://shop.test/cart",
    tabId: () => 7,
    sendBrowserState: async () => undefined
  } as unknown as ActivePage;
  const projects = {
    resolve: async (reason: string) => {
      resolveReasons.push(reason);
      return options.lookup ? options.lookup() : options.projectId;
    },
    current: () => options.projectId,
    activeRecordingProject: () => activeProject,
    setActiveRecordingProject: (projectId: string | null | undefined) => {
      activeProject = projectId;
    }
  } as unknown as ProjectContext;
  const evidence = {
    buildInitialRecordingState: async (timestamp: number) => options.initialState ? options.initialState(timestamp) : { timestamp },
    captureActiveSnapshot: async (label: string) => {
      snapshots.push(label);
    }
  } as unknown as RecordingEvidenceReporter;
  const attachment = {
    attachTabForRecording: async (tabId: number) => {
      attached.push(tabId);
    },
    broadcast: async (message: unknown) => {
      broadcasts.push(message);
    }
  } as unknown as ContentAttachment;

  const deps: ActiveRecordingDeps = {
    send: (async (type: string, payload: Record<string, unknown>) => {
      sent.push({ type, payload });
      await options.send?.(type, payload);
    }) as ActiveRecordingDeps["send"],
    gatewayState: () => options.gatewayState ?? "connected",
    session: () => session,
    settings: () => settings,
    persistSession: async (next) => {
      await options.persist?.(next);
      session = next;
    },
    page,
    projects,
    evidence,
    attachment,
    navigation: options.navigation ?? new NavigationRecorder(),
    scriptedNavigation: {
      cancelAll: (code: string) => { scriptedNavigationCancellations.push(code); }
    } as never,
    clicks: new PointerClickFilter(),
    sequence: new EventSequence(),
    activityLog: new ActivityLog(),
    allTabs: options.allTabs ?? (async () => tabs),
    recordEvent: async (payload, tabId) => {
      if (!activeRecording?.acceptsEvents()) return;
      recorded.push({ payload, tabId });
    },
    onActivity: (kind, label, detail, tone) => {
      activities.push({ kind, label, detail, tone });
    },
    emitStatus: () => undefined,
    lastError: () => lastError,
    setLastError: (message) => {
      lastError = message;
    }
  };

  activeRecording = new ActiveRecording(deps);
  return {
    recording: activeRecording,
    settings,
    sent,
    activities,
    recorded,
    resolveReasons,
    snapshots,
    broadcasts,
    attached,
    scriptedNavigationCancellations,
    lastError: () => lastError,
    setLastError: deps.setLastError,
    session: () => session,
    activeProject: () => activeProject,
    labels: () => activities.map((activity) => activity.label)
  };
}
