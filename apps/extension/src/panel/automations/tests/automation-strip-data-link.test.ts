// The strip's "Open data in FluxIQ panel": the data page when the last run collected rows, the run's page when it
// did not, nothing while it runs, and never an address that is not http(s).

import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import type { ExtensionStatus } from "../../../shared/protocol";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import { statusWith } from "../../tests/status-fixture";
import type { PanelStore } from "../../state";
import { createAutomationStrip } from "../automation-strip";
import type { AutomationRowView, AutomationsController } from "../controller";

function row(extra: Partial<AutomationRowView>): AutomationRowView {
  return { flowId: "flow.one", name: "One", lines: [], datasets: [], running: false, stoppable: false, exporting: false, runId: "run-7", ...extra } as AutomationRowView;
}

function controllerOf(current: () => AutomationRowView): AutomationsController {
  return {
    state: () => ({ mode: "list", rows: [current()], working: false, runInFlight: false, ownerRevision: 0 }),
    observe: () => false, setWorking: () => undefined, refresh: async () => undefined, focus: async () => undefined,
    run: async () => undefined, stop: async () => undefined, exportDataset: async () => undefined
  };
}

const settingsAt = (coreApiUrl: string): ExtensionStatus["settings"] => ({ ...defaultSettings(), coreApiUrl });
const settle = async (): Promise<void> => { for (let i = 0; i < 25; i++) await Promise.resolve(); };

const request = (async () => ({ ok: true, value: undefined })) as unknown as PanelStore["request"];

test("rows collected: the data page; none: the run's page; running or never run: no link", async () => {
  await withFakeDocument(async () => {
    let shown = row({ datasets: [{ datasetId: "d1", recordCount: 2 }] as AutomationRowView["datasets"] });
    const opened: string[] = [];
    const strip = createAutomationStrip(request, controllerOf(() => shown), (url) => opened.push(url));
    strip.render(statusWith({ settings: settingsAt("https://flux.example/app?x=1") }));
    strip.show({ flowId: "flow.one", name: "One" });
    const link = fake(strip.element).byClass("strip-data-link")[0]!;
    assert.equal(link.hidden, false);
    assert.equal(link.textContent, "Open data in FluxIQ panel");
    link.dispatch("click");
    shown = row({});
    strip.draw();
    assert.equal(link.textContent, "Open run in FluxIQ panel");
    link.dispatch("click");
    assert.deepEqual(opened, ["https://flux.example/data", "https://flux.example/runs/run-7"]);
    shown = row({ running: true });
    strip.draw();
    assert.equal(link.hidden, true);
    shown = row({ runId: undefined });
    strip.draw();
    assert.equal(link.hidden, true);
    await settle();
  });
});

test("an address that is not http(s) opens nothing", async () => {
  await withFakeDocument(async () => {
    const opened: string[] = [];
    const strip = createAutomationStrip(request, controllerOf(() => row({})), (url) => opened.push(url));
    strip.render(statusWith({ settings: settingsAt("javascript:alert(1)") }));
    strip.show({ flowId: "flow.one", name: "One" });
    fake(strip.element).byClass("strip-data-link")[0]!.dispatch("click");
    assert.deepEqual(opened, []);
    await settle();
  });
});
