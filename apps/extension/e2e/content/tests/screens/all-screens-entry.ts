// The scripted background every screen of the brand capture shares: one thread, a run's step cards (one already done), an ask,
// five chats for the drawer, two automations, a recording and an extraction. Both the harness capture
// (tests/all-screens-capture-company-website.spec.ts) and the real-browser capture bundle it with `bundlePanel`.
// `window.parent.__mode` ("thread" or "empty") picks the chat shown on mount.

export const allScreensEntry = (surface: string): string => `
  import { startScriptedPanel } from "./e2e/content/tests/screens/scripted-panel";
  import { defaultSettings } from "./src/shared/browser";
  import { automationStudioTaskAttemptNoLoopsCaught } from "@fluxiq/contracts/automation";
  import { proposalFixture } from "./src/panel/extraction/tests/proposal-fixture";
  const scope = window as any;
  const now = Date.now();
  const settings = { ...defaultSettings(), coreApiUrl: "http://127.0.0.1:3000" };
  const base = { gatewayUrl: "ws://127.0.0.1:4777/client", clientId: "client-1", queueSize: 0, recentActivities: [], settings, connectionState: "connected", paired: true, projectId: "project-1" };
  const subject = { kind: "run", id: "r1", projectId: "project-1" };
  const ev = (sequence: number, fields: any) => ({ activityId: "run:r1", sequence, subject, conversationId: "conv-latest", at: new Date(now - 60000 + sequence * 1000).toISOString(), ...fields });
  const steps = [
    ev(1, { phase: "running", label: "Running step 1 of 4: Opening the team page", step: { index: 1, count: 4, nodeId: "n1.open", label: "Open the team page" }, detail: { kind: "step", title: "Opening the team page", status: "started", ref: "n1.open", text: "Node: web.navigate" } }),
    ev(2, { phase: "running", label: "Running step 2 of 4: Clicking “Accept cookies”", step: { index: 2, count: 4, nodeId: "n2.cookies", label: "Accept cookies" }, detail: { kind: "step", title: "Clicking “Accept cookies”", status: "started", ref: "n2.cookies", text: "Node: web.click" } }),
    ev(3, { phase: "running", label: "Already done: Accept cookies", detail: { kind: "step", title: "Already done: Accept cookies", status: "succeeded", ref: "n2.cookies", skipped: { reason: "already_done", subject: "Accept cookies" } } }),
    ev(4, { phase: "running", label: "Running step 3 of 4: Reading the team list", step: { index: 3, count: 4, nodeId: "n3.read", label: "Read the team list" }, detail: { kind: "step", title: "Reading the team list", status: "started", ref: "n3.read", text: "Node: web.dom.extract" } }),
    ev(5, { phase: "running", label: "Running step 4 of 4: Clicking “Save table”", step: { index: 4, count: 4, nodeId: "n4.save", label: "Save the table" }, detail: { kind: "step", title: "Clicking “Save table”", status: "started", ref: "n4.save", text: "Node: web.click" } }),
    ev(6, { phase: "done", final: true, label: "Run finished", detail: { kind: "step", title: "Run finished", status: "succeeded" } })
  ];
  const full: any = { current: steps[steps.length - 1], display: null, recent: steps, history: steps, overlay: "expanded", live: true };
  let activity: any = full;
  const ask = { askId: "ask.1", kind: "choice", status: "pending", parks: true, answer: null, consequences: [], missing: null, options: [{ id: "all", label: "All 12 people" }, { id: "managers", label: "Only managers" }], control: null };
  const threads: any[] = [{ conversationId: "conv-latest", subjectKind: "project", subjectId: "project-1", turns: [] }];
  let mode = "thread";
  const turnsFor = (name: string) => name === "empty" ? [] : [
    { turnId: "t1", author: "person", text: "Get the names and job titles from the team page", createdAt: now - 120000 },
    { turnId: "t2", author: "automation", text: "Done. I read 12 people from the Team page and saved them as a table: name and job title. I pressed nothing on the page that needed your permission.", createdAt: now - 60000 },
    { turnId: "t3", author: "person", text: "Now do the same for the leadership page", createdAt: now - 30000 },
    { turnId: "t4", author: "automation", text: "Which people should I include?", createdAt: now - 5000, ask }
  ];
  scope.__thread = (name: string) => {
    mode = name;
    activity = name === "empty" ? { current: null, display: null, recent: [], history: [], overlay: "expanded", live: true } : full;
  };
  const ago = (minutes: number) => now - minutes * 60000;
  const listing: any[] = [
    { conversationId: "conv-latest", projectId: "project-1", revision: 4, status: "open", updatedAt: ago(2), pendingAskCount: 1, title: "Team page contacts", subject: { kind: "project" } },
    { conversationId: "conv-2", projectId: "project-1", revision: 2, status: "open", updatedAt: ago(95), pendingAskCount: 0, title: "Branch opening hours", subject: { kind: "flow" } },
    { conversationId: "conv-3", projectId: "project-1", revision: 2, status: "resolved", updatedAt: ago(60 * 26), pendingAskCount: 0, title: "Nightly listings run", subject: { kind: "run" } },
    { conversationId: "conv-4", projectId: "project-1", revision: 1, status: "open", updatedAt: ago(60 * 24 * 4), pendingAskCount: 0, title: null, subject: { kind: "panel" } },
    { conversationId: "conv-5", projectId: "project-1", revision: 1, status: "resolved", updatedAt: ago(60 * 24 * 21), pendingAskCount: 0, title: "Price check on lamps", subject: { kind: "build" } }
  ];
  const flows = [
    { flowId: "flow-1", name: "Team page contacts", updatedAt: now - 3600000 },
    { flowId: "flow-2", name: "Branch opening hours", updatedAt: now - 86400000 }
  ];
  const runs = [{ runId: "run-1", flowId: "flow-1", status: "completed", startedAt: now - 3700000, finishedAt: now - 3686000, updatedAt: now - 3686000, interventionCount: 0, adaptationCount: 0, durableBehaviorChanged: false }];
  const recStore = { description: "", stopped: false, lists: 0 };
  let picking = false;
  const attempt = (taskId: string, startedAtMs: number) => ({ taskId, attemptId: taskId + ".a1", ordinal: 1, projectId: "project-1", flowId: "flow-" + taskId, path: "explore", status: "working",
    spend: { calls: 3, inputTokens: 10, outputTokens: 5, usd: 0.04, ms: 900 }, budget: { usd: 5 }, liveSteps: 2, loopsCaught: automationStudioTaskAttemptNoLoopsCaught(), startedAtMs });
  const taskRow = (taskId: string, title: string, startedAtMs: number) => ({ taskId, flowId: "flow-" + taskId, title, attemptCount: 1, latest: { attempt: attempt(taskId, startedAtMs) } });
  scope.__sent = [];
  startScriptedPanel({
    surface: "${surface}" as any,
    start: "connected",
    threads,
    screens: {
      start: { ...base, connectionState: "disconnected", paired: false, recordingState: "idle", eventCount: 0 },
      connected: { ...base, recordingState: "idle", eventCount: 0 },
      recording: { ...base, recordingState: "recording", eventCount: 3 }
    },
    answer: (message: any, core: any) => {
      scope.__sent.push(message.type);
      core.threads[0].turns = turnsFor(mode);
      switch (message.type) {
        case "fluxiq.panel.activityRead": return Promise.resolve({ ok: true, state: activity });
        case "fluxiq.panel.listTasks": return Promise.resolve({ ok: true, payload: { tasks: [taskRow("task.1", "Get names and job titles from the team page", now - 7200000), taskRow("task.2", "Branch opening hours", now - 90000000)], nextCursor: null } });
        case "fluxiq.panel.listAutomations": return Promise.resolve({ ok: true, payload: { flows, runs } });
        case "fluxiq.panel.runDetail": return Promise.resolve({ ok: true, payload: { runDetail: { runId: "run-1", flowId: "flow-1", status: "completed", datasets: [{ datasetId: "d1", label: "Team", recordCount: 12 }] }, adaptations: [] } });
        case "fluxiq.panel.conversationRead":
          if (message.kind === "list-all") return Promise.resolve({ ok: true, payload: { conversations: listing } });
          return undefined;
        case "fluxiq.panel.conversationRename": return Promise.resolve({ ok: true, payload: { conversation: listing[1] } });
        case "fluxiq.panel.conversationDelete": return Promise.resolve({ ok: true, payload: { deleted: true } });
        case "fluxiq.startRecording": recStore.description = String(message.description); setTimeout(() => scope.__show("recording"), 30); return Promise.resolve({ ok: true });
        case "fluxiq.stopRecording": recStore.stopped = true; recStore.lists = 0; setTimeout(() => scope.__show("connected"), 30); return Promise.resolve({ ok: true });
        case "fluxiq.listRecordings": {
          recStore.lists += 1;
          const earlier = { id: "rec-1", description: "Something recorded before", status: "completed", projectId: "project-1", startedAt: 1, endedAt: 2 };
          const fresh = recStore.stopped && recStore.lists >= 3 ? [{ id: "rec-9", description: recStore.description, status: "completed", projectId: "project-1", startedAt: 5, endedAt: 9 }] : [];
          return Promise.resolve({ ok: true, recordings: { items: [...fresh, earlier] } });
        }
        case "fluxiq.extractionStart": picking = true; return Promise.resolve({ ok: true, sessionId: "s1", tabId: 1, form: "list" });
        case "fluxiq.getExtractionSession": if (!picking) return Promise.resolve({ ok: true, session: null }); return Promise.resolve({ ok: true, session: { sessionId: "s1", tabId: 1, form: "list", state: "picked", proposal: proposalFixture(),
          preview: [{ name: "Ada Lovelace", detail: "/team/ada", price: "Engineer", sku: "e-1" }, { name: "Grace Hopper", detail: "/team/grace", price: "Director", sku: "e-2" }, { name: "Alan Turing", detail: "/team/alan", price: "Researcher", sku: "e-3" }] } });
        case "fluxiq.extractionCancel": picking = false; return Promise.resolve({ ok: true });
        default: return undefined;
      }
    },
    ports: { setup: { readModelKey: async () => "ready" } }
  });
  scope.__thread((window.parent as any).__mode ?? (location.hash.slice(1) || "thread"));
`;
