// Provider-free capture of the panel's screens that no saved picture shows (getting started, the empty
// chat, Automations, the strip, Settings), on a realistic scenario, for a person to look at. The real
// panel (`mountPanel`) runs in a frame over the scenario page with a scripted background: its status,
// the automation list, one run's detail. Pictures go to the run's output folder, which is ignored.
import { build } from "esbuild";
import { expect, test } from "../../../index.js";

let script: string;
let css: string;

test.beforeAll(async () => {
  const bundled = await build({
    stdin: {
      resolveDir: process.cwd(), loader: "ts",
      contents: `
        import { mountPanel } from "./src/panel";
        import { targetCore } from "./src/panel/chat/conversation/tests/target-core";
        import { defaultSettings } from "./src/shared/browser";
        import "./src/panel/theme/tokens.css";
        const core = targetCore([{ conversationId: "conv-latest", subjectKind: "project", subjectId: "project-1", turns: [] }]);
        const settings = { ...defaultSettings(), coreApiUrl: "http://127.0.0.1:3000" };
        const base = { recordingState: "idle", gatewayUrl: "ws://127.0.0.1:4777/client", clientId: "client-1", queueSize: 0, eventCount: 0, recentActivities: [], settings };
        const screens = {
          start: { ...base, connectionState: "disconnected", paired: false },
          connected: { ...base, connectionState: "connected", paired: true, projectId: "project-1" }
        };
        let status = screens.start;
        const now = Date.now();
        const flows = [
          { flowId: "flow-1", name: "Team page contacts", updatedAt: now - 3600_000 },
          { flowId: "flow-2", name: "Branch opening hours", updatedAt: now - 86400_000 }
        ];
        const runs = [{ runId: "run-1", flowId: "flow-1", status: "completed", startedAt: now - 3700_000, finishedAt: now - 3686_000, updatedAt: now - 3686_000, interventionCount: 0, adaptationCount: 0, durableBehaviorChanged: false }];
        const answer = (message) => {
          switch (message.type) {
            case "fluxiq.getStatus": return Promise.resolve({ ok: true, status });
            case "fluxiq.panel.listAutomations": return Promise.resolve({ ok: true, payload: { flows, runs } });
            case "fluxiq.panel.runDetail": return Promise.resolve({ ok: true, payload: { runDetail: { runId: "run-1", flowId: "flow-1", status: "completed", datasets: [{ datasetId: "d1", label: "Team", recordCount: 10 }] }, adaptations: [] } });
            case "fluxiq.panel.modelReadiness": return Promise.resolve({ ok: true, payload: { keys: [{ kind: "llm", provider: "anthropic", enabled: true }] } });
            case "fluxiq.panel.activityRead": return Promise.resolve({ ok: true, state: { current: null, display: null, recent: [], history: [], overlay: "expanded", live: true } });
            default: return core.request(message).then((result) => (result.ok ? result.value : { ok: false, error: "scripted" }));
          }
        };
        const listeners = [];
        window.chrome = { runtime: { lastError: undefined, id: "extension-id", getURL: (p) => p, onMessage: { addListener: (fn) => listeners.push(fn), removeListener() {} },
          sendMessage: (message, callback) => { answer(message).then((reply) => callback && callback(reply)); } },
          storage: { local: { get: (k, cb) => cb && cb({}), set: (v, cb) => cb && cb() } } };
        window.__show = (name) => { status = screens[name]; listeners.forEach((fn) => fn({ type: "fluxiq.statusChanged", status })); };
        mountPanel(document.getElementById("app"), "sidepanel");
      `
    }, bundle: true, write: false, platform: "browser", format: "iife", outfile: "panel-preview.js", loader: { ".css": "css" }
  });
  script = bundled.outputFiles.find((file) => file.path.endsWith(".js"))!.text;
  css = bundled.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? "";
});


test("company-website: the panel's getting-started, empty chat, Automations, strip and Settings screens", async ({ openHarness, page }, testInfo) => {
  await openHarness("company-website");
  await page.evaluate(() => {
    const rail = document.createElement("iframe");
    rail.id = "panel-frame";
    rail.name = "panel-frame";
    rail.title = "FluxIQ panel";
    Object.assign(rail.style, { position: "fixed", right: "0", top: "0", width: "400px", height: "100vh", border: "0", zIndex: "2147483646", background: "white" });
    rail.srcdoc = '<!doctype html><html><body><div id="app" style="height:100vh"></div></body></html>';
    document.documentElement.append(rail);
  });
  const frame = page.frameLocator("#panel-frame");
  await expect(frame.locator("#app")).toBeVisible();
  const child = page.frame({ name: "panel-frame" })!;
  await child.addStyleTag({ content: css });
  await child.addScriptTag({ content: script });
  await page.waitForTimeout(1_500);
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("1-getting-started.png") });
  await child.evaluate(() => { (window as unknown as { __show(name: string): void }).__show("connected"); });
  await frame.locator("#settingsButton").click();
  await page.waitForTimeout(800);
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("5-settings.png") });
  await frame.locator("#settingsButton").click();
  await page.waitForTimeout(800);
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("2-empty-chat.png") });
  await frame.locator("#panelTab-automations").click();
  await page.waitForTimeout(1_000);
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("3-automations.png") });
  await frame.getByText("Team page contacts").first().click();
  await page.waitForTimeout(1_200);
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("4-strip.png") });
});
