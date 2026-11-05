// The whole journey's panel, for `whole-journey-social-network-feed.spec.ts` and `popup-closing-social-network-feed.spec.ts`:
// the real `mountPanel` over a scripted background and every port faked. This file runs in the browser, bundled by
// `panel-frame.ts`. Everything a background or Core would keep lives in `world`, a JSON string on the page that holds
// the frame, so a popup that closes (the frame is torn down) and opens again reads what the first one left. Nothing
// reaches FluxIQ, a provider, a key or a real site.
import { createFakeSubflowLibraryPort, createFakeTasksMemory, createFakeTasksPort, fakeTasks } from "@fluxiq/ui-components/testing";
import type { PanelSurface } from "../../../../src/panel";
import type { PanelMessage } from "../../../../src/panel/state";
import type { TargetCore } from "../../../../src/panel/chat/conversation/tests/target-core";
import { defaultSettings } from "../../../../src/shared/browser";
import { startScriptedPanel } from "./scripted-panel";

type Turn = TargetCore["threads"][number]["turns"][number];
type World = {
  key: "missing" | "locked" | "ready";
  rec: { description: string; stopped: boolean; lists: number };
  turns: Turn[];
  activity: unknown;
  sent: Array<Record<string, unknown>>;
  openTask?: { projectId: string; taskId: string };
  /** The background's own status name (a key of the screens below) so a reopened popup lands where the first one was. */
  status: string;
  /** What happened while no panel was open: `scene:<name>` for what Core did, `recording-stopped`. A spec adds to it. */
  pending: string[];
};
type Holder = { world?: string; memory?: Record<string, unknown> };

const IDLE = { current: null, display: null, recent: [], history: [], overlay: "expanded", live: true };
const QUESTION_WORDS = "Waiting for you: a question in the FluxIQ panel";
const CHECK_WORDS = "Waiting for you: finish the check on the page, then press Continue";
const PLACE_BID = 'FluxIQ needs to press "Follow" (button) to build this Flow. That would create something new on the site, and that always needs your permission, even when your instruction asks for it.';
const CHECK = "FluxIQ needs you: complete the check on this page, then press Continue.";

const permissionAsk = { askId: "request.1", kind: "permission", status: "pending", parks: true, options: null, answer: null, missing: ["create_new"], consequences: ["create_new"],
  control: { name: "Follow", kind: "button" }, permissionRequest: { action: { kind: "exploration", verb: "press" }, control: { name: "Follow", kind: "button" }, missing: ["create_new"] } };
const personAsk = { askId: "person-needed.1", kind: "choice", status: "pending", parks: true, answer: null, consequences: [], missing: null,
  options: [{ id: "person_done", label: "Continue", route: null }, { id: "person_stop", label: "Stop", route: "failed" }], control: { name: "robot check", kind: "person_check" } };

function activityOf(kind: "work" | "permission" | "check" | "done"): unknown {
  if (kind === "done") {
    const subject = { kind: "run", id: "run-feed-1", projectId: "project-1", flowId: "flow-feed" };
    const event = { activityId: "run:run-feed-1", sequence: 9, subject, conversationId: "conv-latest", phase: "done", label: "Finished", at: new Date().toISOString(), final: true, detail: { kind: "step", title: "Finished", status: "succeeded", ref: "n9" } };
    return { current: event, display: null, recent: [event], history: [event], overlay: "expanded", live: true };
  }
  const waiting = kind !== "work";
  const subject = { kind: "build", id: "b1", projectId: "project-1", flowId: "flow-7" };
  const event = { activityId: "build:b1", sequence: 1, subject, conversationId: "conv-latest", phase: waiting ? "waiting_permission" : "exploring",
    label: waiting ? "Waiting for an answer before going on" : "Opening the feed", at: new Date().toISOString(),
    detail: waiting ? { kind: "ask", title: kind === "check" ? "Asked the person to complete a check" : "Asked a question (permission)", status: "started", ref: kind === "check" ? "person-needed.1" : "request.1" }
      : { kind: "thought", title: "Opening the feed", text: "The posts are on the home page, so I am reading them there.", status: "succeeded", ref: "t1" } };
  const display = { activityId: "build:b1", subjectKind: "build", phase: event.phase, headline: waiting ? (kind === "check" ? CHECK_WORDS : QUESTION_WORDS) : "Working on your task",
    detail: kind === "check" ? CHECK : null, step: null, working: !waiting, outcome: waiting ? "waiting" : null, sequence: 1 };
  return { current: event, display, recent: [event], history: [event], overlay: "expanded", live: true };
}

/** Mounts the journey's panel for `surface`, starting on the status the world was left on (or `disconnected`). */
export function startJourneyPanel(surface: PanelSurface): void {
  const holder = (window.parent as unknown as { __holder?: Holder }).__holder ?? ((window.parent as unknown as { __holder: Holder }).__holder = {});
  const memory = (holder.memory ??= {});
  const fresh: World = { status: "disconnected", pending: [], key: "missing", rec: { description: "", stopped: false, lists: 0 }, turns: [], activity: IDLE, sent: [] };
  const load = (): World => (holder.world === undefined ? structuredClone(fresh) : (JSON.parse(holder.world) as World));
  const save = (world: World): void => { holder.world = JSON.stringify(world); };
  if (holder.world === undefined) save(fresh);
  const scope = window as unknown as Record<string, unknown> & { __push(message: unknown): void; __show(name: string): void };
  const settings = { ...defaultSettings(), coreApiUrl: "http://127.0.0.1:3000" };
  const base = { gatewayUrl: "ws://127.0.0.1:4777/client", clientId: "client-1", queueSize: 0, recentActivities: [], settings };
  const tasks = createFakeTasksPort({ tasks: Object.values(fakeTasks(Date.now())) });
  const taskMemory = createFakeTasksMemory(load().openTask);
  const original = taskMemory.write;
  taskMemory.write = async (open) => {
    await original(open);
    const world = load();
    if (open === undefined) delete world.openTask;
    else world.openTask = open;
    save(world);
  };
  const library = createFakeSubflowLibraryPort();
  scope.__library = library;
  scope.__tasks = tasks;
  scope.__world = () => load();
  scope.__setKey = (key: World["key"]) => {
    const world = load();
    world.key = key;
    save(world);
  };
  /** What the work did next: a scene Core and the background would have pushed (`announce`), or that happened with no panel to hear it. */
  const scene = (name: "work" | "permission" | "check" | "done" | "idle", core: TargetCore, announce = true): void => {
    const world = load();
    const thread = core.threads[0]!;
    if (name === "permission") thread.turns.push({ turnId: `t${thread.turns.length + 1}`, author: "automation", text: PLACE_BID, createdAt: Date.now(), ask: permissionAsk as unknown as NonNullable<Turn["ask"]> });
    if (name === "check") thread.turns.push({ turnId: `t${thread.turns.length + 1}`, author: "automation", text: CHECK, createdAt: Date.now(), ask: personAsk as unknown as NonNullable<Turn["ask"]> });
    thread.revision += 1;
    world.turns = thread.turns.map((turn) => ({ ...turn }));
    world.activity = name === "idle" ? IDLE : activityOf(name);
    save(world);
    if (announce) scope.__push({ type: "fluxiq.activity.changed", state: world.activity });
  };
  scope.__scene = (name: "work" | "permission" | "check" | "done" | "idle") => scene(name, scope.__core as TargetCore);
  const early = load();
  if (early.pending.includes("recording-stopped")) {
    early.rec.stopped = true;
    early.rec.lists = 0;
    early.status = "idle";
    early.pending = early.pending.filter((name) => name !== "recording-stopped");
    save(early);
  }
  const world0 = load();
  startScriptedPanel({
    surface,
    start: world0.status,
    memory,
    screens: {
      pairing: { ...base, recordingState: "idle", eventCount: 0, connectionState: "pairing", paired: false, pairingReferenceCode: "482913" },
      idle: { ...base, recordingState: "idle", eventCount: 0, connectionState: "connected", paired: true, projectId: "project-1" },
      recording: { ...base, recordingState: "recording", eventCount: 3, connectionState: "connected", paired: true, projectId: "project-1" }
    },
    threads: [{ conversationId: "conv-latest", subjectKind: "project", subjectId: "project-1", turns: world0.turns }],
    answer: (message, core) => {
      scope.__core = core;
      const world = load();
      const keys = () => (world.key === "missing" ? [] : [{ kind: "llm", provider: "scripted", enabled: true, ...(world.key === "locked" ? { unlocked: false, lockedBecause: "signed_out" } : {}) }]);
      switch (message.type) {
        case "fluxiq.connect":
          world.sent.push({ type: message.type });
          save(world);
          setTimeout(() => scope.__show("pairing"), 30);
          return Promise.resolve({ ok: true });
        case "fluxiq.panel.openFluxIQ":
          world.sent.push({ type: message.type, purpose: message.purpose });
          save(world);
          return Promise.resolve({ ok: true, payload: {} });
        case "fluxiq.panel.modelReadiness": return Promise.resolve({ ok: true, payload: { keys: keys() } });
        case "fluxiq.panel.activityRead": {
          for (const name of world.pending.filter((pending) => pending.startsWith("scene:"))) scene(name.slice(6) as "work", core, false);
          const settled = load();
          settled.pending = settled.pending.filter((pending) => !pending.startsWith("scene:"));
          save(settled);
          return Promise.resolve({ ok: true, state: settled.activity });
        }
        case "fluxiq.panel.stopRun":
          world.sent.push({ type: message.type });
          world.activity = IDLE;
          save(world);
          scope.__push({ type: "fluxiq.activity.changed", state: IDLE });
          return Promise.resolve({ ok: true, payload: {} });
        case "fluxiq.startRecording":
          world.rec = { description: String(message.description), stopped: false, lists: 0 };
          save(world);
          setTimeout(() => scope.__show("recording"), 30);
          return Promise.resolve({ ok: true });
        case "fluxiq.stopRecording":
          world.rec.stopped = true;
          world.rec.lists = 0;
          save(world);
          setTimeout(() => scope.__show("idle"), 30);
          return Promise.resolve({ ok: true });
        case "fluxiq.listRecordings": {
          world.rec.lists += 1;
          save(world);
          const earlier = { id: "rec-1", description: "Something recorded before", status: "completed", projectId: "project-1", startedAt: 1, endedAt: 2 };
          const saved = world.rec.stopped && world.rec.lists >= 3 ? [{ id: "rec-9", description: world.rec.description, status: "completed", projectId: "project-1", startedAt: 5, endedAt: 9 }] : [];
          return Promise.resolve({ ok: true, recordings: { items: [...saved, earlier] } });
        }
        case "fluxiq.panel.runDetail":
          return Promise.resolve({ ok: true, payload: { runDetail: { summary: { runId: "run-feed-1", flowId: "flow-feed", status: "succeeded", startedAt: Date.now() - 41_000, finishedAt: Date.now() - 2_000 },
            datasets: [{ datasetId: "feed_posts", label: "feed_posts", recordCount: 3 }] }, adaptations: [] } });
        case "fluxiq.panel.exportDataset": {
          const rows = [{ author: "Maya Chen", post: "Sunrise from the ridge", likes: "214" }, { author: "Tomas Rivera", post: "New bike day", likes: "98" }, { author: "Priya Nair", post: "Pasta, finally", likes: "143" }];
          return Promise.resolve({ ok: true, payload: { export: { tooLarge: false, fileName: "feed_posts.json", contentType: "application/json", body: JSON.stringify(rows) } } });
        }
        case "fluxiq.panel.conversationSend":
          world.sent.push({ type: message.type, text: message.text, attachment: message.recordingId ?? message.attachment ?? null });
          save(world);
          return core.request(message as PanelMessage).then((result: { ok: boolean; value?: unknown }) => {
            const thread = core.threads[0]!;
            const sentTurn = thread.turns.at(-1);
            if (sentTurn !== undefined && sentTurn.createdAt === undefined) sentTurn.createdAt = Date.now() - 1_000;
            if (world.sent.filter((sent) => sent.type === message.type).length === 1) {
              thread.turns.push({ turnId: `t${thread.turns.length + 1}`, author: "automation", text: "Got it. I'll open your feed and list what the people you follow posted.", createdAt: Date.now() });
              scene("work", core);
            }
            return result.ok ? result.value : { ok: false, error: "scripted" };
          });
        default: return undefined;
      }
    },
    ports: { setup: { readModelKey: async () => load().key }, tasks: { port: tasks, results: tasks.results }, taskMemory, library }
  });
  // The status the background holds survives the popup closing: remember each move, as the background would.
  const show = scope.__show;
  scope.__show = (name: string) => {
    const kept = load();
    kept.status = name;
    save(kept);
    show(name);
  };
}
