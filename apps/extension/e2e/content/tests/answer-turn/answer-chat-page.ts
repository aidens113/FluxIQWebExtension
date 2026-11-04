// Support for the answer-turn browser specs: bundles the real chat (`@fluxiq/ui-components`' widget over the
// extension's own transport, with a scripted background and a scripted results port) and mounts it in a
// frame laid over a realistic scenario page, so a person can look at the pictures. Nothing here talks to a
// provider or to Core. `window.__mount(config)` draws one thread; the spec drives and reads it.
import { build } from "esbuild";
import type { Frame, FrameLocator, Page } from "@playwright/test";

export type AnswerBundle = { script: string; css: string };

/** The in-page side: a chat over `targetCore`, with the results port and the activity state the spec scripts. */
const PAGE_SOURCE = `
  import { createChatWidget } from "@fluxiq/ui-components";
  import "@fluxiq/ui-components/styles/chat.css";
  import { createFakeChatResultsPort, fakeTaskOutcomes } from "@fluxiq/ui-components/testing";
  import { createExtensionChatTransport } from "./src/panel/chat/transport";
  import { hostStatusOf } from "./src/panel/chat/host-status";
  import { createChatOwnerContext } from "./src/panel/chat/owner-context";
  import { targetCore } from "./src/panel/chat/conversation/tests/target-core";
  import { ACTIVITY_MESSAGES } from "./src/shared/activity";
  import { AUTOMATION_PANEL_MESSAGES } from "./src/shared/protocol";
  import "./src/panel/theme/tokens.css";
  import "./src/panel/shell/shell.css";

  const IDLE = { current: null, display: null, recent: [], history: [], overlay: "expanded", live: true };
  let active = null;
  window.chrome = { runtime: { onMessage: { addListener() {}, removeListener() {} } } };
  // Named outcomes from Core's fakes, told on the scenario's own site rather than a made-up one.
  window.__outcomes = (names, site) => names.map((name) => JSON.parse(JSON.stringify(fakeTaskOutcomes()[name]).replaceAll("shop.example", site).replaceAll("homes.example", site)));
  // An activity state for work that began \`agoMs\` ago: a build or run, working or waiting, with its step messages.
  window.__work = (o) => {
    const now = Date.now();
    const subject = { kind: o.kind ?? "build", id: "b1", projectId: "project-1", flowId: o.flowId ?? "flow-7" };
    const phase = o.phase ?? "exploring";
    const events = (o.steps ?? [{ kind: "thought", title: "Starting", text: "Looking at the page." }]).map((step, index) => ({
      activityId: "act-1", sequence: index + 1, subject, ...(o.conversationId === null ? {} : { conversationId: o.conversationId ?? "conv-latest" }),
      phase, label: step.title, at: new Date(now - o.agoMs + index * 1000).toISOString(),
      detail: { kind: step.kind ?? "thought", title: step.title, text: step.text, status: step.status ?? "succeeded", ref: "n" + (index + 1) }
    }));
    const display = { activityId: "act-1", subjectKind: subject.kind, phase, headline: o.headline ?? "Working on your task", detail: o.detail ?? null, step: null,
      working: !o.waiting, outcome: o.waiting ? "waiting" : null, sequence: events.length };
    return { current: events.at(-1), display, recent: events, history: events, overlay: "expanded", live: true };
  };
  window.__mount = async (config) => {
    if (active) active.setActive(false);
    document.querySelector("#app").replaceChildren();
    const core = targetCore([{ conversationId: "conv-latest", subjectKind: "project", subjectId: "project-1",
      turns: config.turns ?? [{ turnId: "t1", author: "person", text: config.request ?? "Find the information", createdAt: Date.now() - 600000 }] }]);
    const listeners = [];
    window.__core = core;
    window.__settle = () => new Promise((resolve) => setTimeout(resolve, 50));
    window.__push = (message) => listeners.forEach((listener) => listener(message));
    window.__downloads = [];
    window.__activity = config.activity ?? IDLE;
    // config.real: the extension's own results adapter reads a finished run (its detail and its exported rows)
    // from the scripted background, instead of a scripted port.
    const real = config.real;
    const port = real || config.noPort ? undefined : createFakeChatResultsPort({
      threads: [{ conversationId: "conv-latest", outcomes: config.outcomes ?? [] }],
      ...(config.reportsSpend === false ? { reportsSpend: false } : {}),
      download: (fileName, contentType, body) => window.__downloads.push({ fileName, contentType, body })
    });
    window.__port = port;
    window.__exportsAsked = [];
    const request = async (message) => {
      if (message.type === ACTIVITY_MESSAGES.read) return { ok: true, value: { ok: true, state: window.__activity } };
      if (real && message.type === AUTOMATION_PANEL_MESSAGES.runDetail) {
        return { ok: true, value: { ok: true, payload: { runDetail: { summary: { runId: real.runId, flowId: real.flowId, status: "succeeded", startedAt: real.startedAt, finishedAt: real.finishedAt },
          datasets: [{ datasetId: real.datasetId, label: real.datasetId, recordCount: real.rows.length }] }, adaptations: [] } } };
      }
      if (real && message.type === AUTOMATION_PANEL_MESSAGES.exportDataset) {
        window.__exportsAsked.push({ runId: message.runId, datasetId: message.datasetId, format: message.format });
        const cell = (value) => (/[",\\n]/.test(String(value)) ? '"' + String(value).replaceAll('"', '""') + '"' : String(value));
        const body = message.format === "json" ? JSON.stringify(real.rows)
          : [Object.keys(real.rows[0]).join(","), ...real.rows.map((row) => Object.values(row).map(cell).join(","))].join("\\n");
        return { ok: true, value: { ok: true, payload: { export: { tooLarge: false, fileName: real.datasetId + "." + message.format, contentType: message.format === "json" ? "application/json" : "text/csv", body } } } };
      }
      return core.request(message);
    };
    const transport = createExtensionChatTransport(request, (listener) => { listeners.push(listener); return () => undefined; },
      (fileName, contentType, body) => window.__downloads.push({ fileName, contentType, body }));
    if (port) transport.results = port; else if (!real) delete transport.results;
    const owners = createChatOwnerContext(request);
    const chat = createChatWidget(transport, { openControl: () => ({ element: document.createElement("a"), observe() {} }), ownerKey: owners.capture().identity });
    const status = { connectionState: "connected", projectId: "project-1", paired: true, recordingState: "idle" };
    const shell = document.createElement("div");
    shell.className = "shell";
    shell.append(chat.element);
    document.querySelector("#app").append(shell);
    owners.observe(status);
    chat.render(hostStatusOf(status, owners.capture().identity));
    chat.setActive(true);
    active = chat;
    if (real) {
      // The activity feed tells the panel the run is done, as it does when a run ends.
      const current = { activityId: "run:" + real.runId, sequence: 9, subject: { kind: "run", id: real.runId, projectId: "project-1", flowId: real.flowId }, phase: "done",
        label: "Done", final: true, conversationId: "conv-latest", at: new Date().toISOString() };
      await window.__settle();
      window.__push({ type: ACTIVITY_MESSAGES.changed, state: { current, display: null, recent: [current], history: [current], overlay: "expanded", live: true } });
    }
    await window.__settle();
  };
`;

export async function buildAnswerChatBundle(): Promise<AnswerBundle> {
  const bundled = await build({
    stdin: { resolveDir: process.cwd(), loader: "ts", contents: PAGE_SOURCE },
    bundle: true, write: false, platform: "browser", format: "iife", outfile: "answer-chat.js", loader: { ".css": "css" }
  });
  return {
    script: bundled.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
    css: bundled.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? ""
  };
}

/** A frame `width` by `height` laid over the page's right edge, with the chat's styles and code loaded. */
export async function openChatRail(page: Page, bundle: AnswerBundle, size: { width: number; height: number }, name = "answer-chat"): Promise<{ frame: Frame; locator: FrameLocator }> {
  await page.evaluate(({ width, height, name }) => {
    document.getElementById(name)?.remove();
    const rail = document.createElement("iframe");
    rail.id = name;
    rail.name = name;
    rail.title = "FluxIQ chat rendering";
    Object.assign(rail.style, { position: "fixed", right: "0", top: "0", width: `${width}px`, height: `${height}px`, border: "0", zIndex: "2147483646", background: "white" });
    rail.srcdoc = '<!doctype html><html><body style="margin:0"><div id="app" style="height:100vh"></div></body></html>';
    document.documentElement.append(rail);
  }, { ...size, name });
  const locator = page.frameLocator(`#${name}`);
  await locator.locator("#app").waitFor();
  const frame = page.frame({ name })!;
  await frame.addStyleTag({ content: bundle.css });
  await frame.addScriptTag({ content: bundle.script });
  return { frame, locator };
}

/** The sent messages of one kind, read from the scripted background. */
export function sentOf(frame: Frame, type: string): Promise<Array<Record<string, unknown>>> {
  return frame.evaluate((kind) => (window as unknown as { __core: { sent: Array<Record<string, unknown>> } }).__core.sent.filter((message) => message.type === kind), type);
}

/** Draws a thread holding the named outcomes from Core's fakes, told on `site`. */
export async function mountNamed(frame: Frame, site: string, name: string, config: Record<string, unknown> = {}): Promise<void> {
  await frame.evaluate(async (args) => {
    const win = window as unknown as { __mount(config: unknown): Promise<void>; __outcomes(names: string[], site: string): unknown[] };
    await win.__mount({ outcomes: win.__outcomes([args.name], args.site), ...args.config });
  }, { name, site, config });
}

/** Tells the chat the scripted activity changed, as the background's broadcast does. */
export async function pushActivity(frame: Frame): Promise<void> {
  await frame.evaluate(() => {
    const win = window as unknown as { __push(message: unknown): void; __activity: unknown };
    win.__push({ type: "fluxiq.activity.changed", state: win.__activity });
  });
}
