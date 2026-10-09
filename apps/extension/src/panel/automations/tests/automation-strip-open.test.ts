import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import { createOpenFluxIQButton } from "../../open-fluxiq";
import type { PanelStore } from "../../state";
import { createAutomationStrip } from "../automation-strip";
import type { AutomationsController } from "../controller";

test("Open in FluxIQ follows the currently selected automation, including its failure fallback", async () => {
  await withFakeDocument(async () => {
    const messages: unknown[] = [];
    const request = (async (message: unknown) => {
      messages.push(message);
      return { ok: true, value: undefined };
    }) as PanelStore["request"];
    const controller: AutomationsController = {
      state: () => ({ mode: "list", rows: [{ flowId: "flow.two", name: "Two", lines: [], datasets: [], running: false, stoppable: false, exporting: false, notice: { sentence: "Open its details", openFluxIQ: true } }], working: false, runInFlight: false, ownerRevision: 0 }),
      observe: () => false,
      setWorking: () => undefined,
      refresh: async () => undefined,
      focus: async () => undefined,
      run: async () => undefined,
      stop: async () => undefined,
      exportDataset: async () => undefined
    };
    const strip = createAutomationStrip(request, controller);
    const primary = fake(strip.element).byClass("open-fluxiq")[0]!.children[0]!;
    strip.show({ flowId: "flow.one", name: "One" });
    primary.dispatch("click");
    await Promise.resolve();
    strip.show({ flowId: "flow.two", name: "Two" });
    primary.dispatch("click");
    await Promise.resolve();
    const fallback = fake(strip.element).byClass("open-fluxiq")[1]!.children[0]!;
    fallback.dispatch("click");
    await Promise.resolve();
    assert.deepEqual(messages, [
      { type: RUNTIME_MESSAGES.panelOpenFluxIQ, flowId: "flow.one" },
      { type: RUNTIME_MESSAGES.panelOpenFluxIQ, flowId: "flow.two" },
      { type: RUNTIME_MESSAGES.panelOpenFluxIQ, flowId: "flow.two" }
    ]);
  });
});

test("generic Open FluxIQ buttons send no automation selection", async () => {
  await withFakeDocument(async () => {
    const messages: unknown[] = [];
    const request = (async (message: unknown) => {
      messages.push(message);
      return { ok: true, value: undefined };
    }) as PanelStore["request"];
    const open = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "small" });
    fake(open.element).children[0]!.dispatch("click");
    await Promise.resolve();
    assert.deepEqual(messages, [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ }]);
  });
});
