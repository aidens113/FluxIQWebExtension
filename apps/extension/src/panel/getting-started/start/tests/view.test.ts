import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import type { ExtensionStatus } from "../../../../shared/protocol";
import { fake, withFakeDocument } from "../../../chat/tests/fake-dom";
import type { PanelContext } from "../../../shell";
import type { PanelResult, PanelStore } from "../../../state";
import { statusWith } from "../../../tests/status-fixture";
import type { DiscoveryAnswer } from "../../reachability";
import { startGuide } from "../steps";
import { createStartView } from "../view";

function pendingRequest() {
  let resolve!: (value: PanelResult<unknown>) => void;
  let reject!: (reason: unknown) => void;
  return { promise: new Promise<PanelResult<unknown>>((yes, no) => {
      resolve = yes;
      reject = no;
    }), resolve, reject };
}
async function flush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }

const FOUND = { origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100", found: true, gatewayUrl: "ws://127.0.0.1:4877/client" };
const buttonNamed = (root: ReturnType<typeof fake>, name: string) => root.descendants().find((node) => node.tagName === "BUTTON" && node.textContent === name);
const requestsOf = (calls: unknown[], type: string) => calls.filter((call) => (call as { type: string }).type === type) as Array<Record<string, unknown>>;
const SETTINGS = { gatewayUrl: "ws://127.0.0.1:4777/client", coreApiUrl: "http://127.0.0.1:3100", autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true, requestsEnabled: false };

test("three steps, the AI key last: each has a number and a title, and Open FluxIQ sits under Connect and approve", async () => {
  await withFakeDocument(async () => {
    const status = statusWith({ connectionState: "pairing", pairingReferenceCode: "482913", paired: false });
    const store = { request: async () => ({ ok: true, value: {} }) } as unknown as PanelStore;
    const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined);
    view.render(startGuide(status, false), status);
    const root = fake(view.element);
    const steps = root.byClass("start-step");
    assert.equal(steps.length, 3);
    assert.deepEqual(root.byClass("start-step-title").map((node) => node.textContent), ["Start FluxIQ", "Connect and approve", "Add your AI key"]);
    assert.ok(buttonNamed(fake(steps[1]), "Open in FluxIQ panel"), "Open in FluxIQ panel is under step two");
    assert.equal(buttonNamed(fake(steps[2]), "Open in FluxIQ panel"), undefined, "and the key step has its own link instead");
    assert.ok(buttonNamed(fake(steps[2]), "Add your AI key in the FluxIQ panel"), "the key step is a link into the FluxIQ panel");
    assert.ok(buttonNamed(fake(steps[1]), "Cancel approval request"), "Cancel says what it cancels");
    assert.equal(buttonNamed(fake(steps[1]), "Cancel"), undefined, "no bare Cancel under the approval");
    assert.equal(root.descendants().find((node) => node.id === "pairingReferenceCode")!.textContent, "482913", "the code shows at once");
    assert.doesNotMatch(root.textContent, /unlock|vault|seal|credential|token|scope|password|model key/iu);
  });
});

test("step one says where FluxIQ was found and Change checks the new address before saving it with the connection address the document names", async () => {
  await withFakeDocument(async () => {
    const status = statusWith({ settings: { ...SETTINGS, coreApiUrl: "http://127.0.0.1:3000" } });
    const calls: unknown[] = [];
    const store = { current: () => status, subscribe: () => () => undefined, request: async (message: unknown) => {
      calls.push(message);
      return { ok: true, value: {} };
    } } as unknown as PanelStore;
    const probed: string[] = [];
    let answer: DiscoveryAnswer = { found: false };
    const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined, async (address) => {
      probed.push(address);
      return answer;
    });
    view.render(startGuide(status, false, undefined, FOUND, { autoSent: true }), status);
    const root = fake(view.element);
    assert.equal(root.byClass("start-step-line")[0]!.textContent, "FluxIQ found at 127.0.0.1:3100");
    assert.equal(root.byClass("start-actions")[0]!.hidden, false, "Change shows although the step is done");
    buttonNamed(root, "Change")!.dispatch("click");
    const field = root.descendants().find((node) => node.id === "serverAddressField")!;
    assert.equal(field.value, "http://127.0.0.1:3100", "the field starts at the address that was found");
    const form = root.byClass("start-change")[0]!;
    assert.equal(form.hidden, false);
    // Nothing valid there: nothing is saved, and it says so.
    field.value = "http://127.0.0.1:9999/some/page";
    buttonNamed(root, "Check and save")!.dispatch("click");
    await flush();
    assert.deepEqual(probed, ["http://127.0.0.1:9999"], "only the origin is asked");
    assert.deepEqual(calls, []);
    assert.match(form.byClass("notice")[0]!.textContent, /No FluxIQ answered at 127\.0\.0\.1:9999/u);
    assert.equal(form.hidden, false);
    // A FluxIQ answers: the web address and its connection address are saved together.
    answer = { found: true, gatewayUrl: "ws://127.0.0.1:4877/client" };
    field.value = "http://127.0.0.1:3100";
    buttonNamed(root, "Check and save")!.dispatch("click");
    await flush();
    const saves = requestsOf(calls, RUNTIME_MESSAGES.panelSaveSettings);
    assert.equal(saves.length, 1);
    const saved = saves[0]!.settings as Record<string, unknown>;
    assert.deepEqual({ web: saved.coreApiUrl, gateway: saved.gatewayUrl, auto: saved.autoReconnect }, { web: "http://127.0.0.1:3100", gateway: "ws://127.0.0.1:4877/client", auto: true });
    assert.equal(form.hidden, true);
  });
});

test("an address that is not an http address is refused without asking anything", async () => {
  await withFakeDocument(async () => {
    const status = statusWith();
    const calls: unknown[] = [];
    const probed: string[] = [];
    const store = { current: () => status, subscribe: () => () => undefined, request: async (message: unknown) => {
      calls.push(message);
      return { ok: true, value: {} };
    } } as unknown as PanelStore;
    const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined, async (address) => {
      probed.push(address);
      return { found: false };
    });
    view.render(startGuide(status, false, undefined, FOUND, { autoSent: true }), status);
    const root = fake(view.element);
    buttonNamed(root, "Change")!.dispatch("click");
    root.descendants().find((node) => node.id === "serverAddressField")!.value = "ftp://flux.example";
    buttonNamed(root, "Check and save")!.dispatch("click");
    await flush();
    assert.deepEqual([probed, calls], [[], []]);
    assert.match(root.byClass("start-change")[0]!.byClass("notice")[0]!.textContent, /web address/u);
  });
});

test("FluxIQ found: the request goes out by itself, once, with the connection address the found FluxIQ names saved first", async () => {
  await withFakeDocument(async () => {
    const status = statusWith({ settings: SETTINGS });
    const calls: Array<{ type: string }> = [];
    const store = { current: () => status, subscribe: () => () => undefined, request: async (message: { type: string }) => {
      calls.push(message);
      return { ok: true, value: {} };
    } } as unknown as PanelStore;
    const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined);
    const connect = () => fake(view.element).descendants().find((node) => node.id === "connectButton")!;
    assert.equal(view.autoSent(), false);
    view.render(startGuide(status, false, undefined, FOUND), status);
    assert.equal(view.autoSent(), true);
    assert.equal(connect().hidden, true, "no Connect to press while the request is going out");
    await flush();
    assert.deepEqual(calls.map((call) => call.type), [RUNTIME_MESSAGES.panelSaveSettings, RUNTIME_MESSAGES.connect]);
    // Drawn again with the same finding: nothing is sent a second time, and Connect is the retry button.
    calls.length = 0;
    view.render(startGuide(status, false, undefined, FOUND, { autoSent: view.autoSent() }), status);
    await flush();
    assert.equal(calls.length, 0);
    assert.equal(connect().hidden, false);
    assert.equal(connect().textContent, "Connect");
    // Pressed, with nothing to save when the saved connection address is already the document's.
    const same = statusWith({ settings: { ...SETTINGS, gatewayUrl: FOUND.gatewayUrl } });
    view.render(startGuide(same, false, undefined, FOUND, { autoSent: true }), same);
    connect().dispatch("click");
    await flush();
    assert.deepEqual(calls.map((call) => call.type), [RUNTIME_MESSAGES.connect]);
  });
});

test("nothing is sent by itself when no FluxIQ was found, or after the panel saw the browser connected", async () => {
  await withFakeDocument(async () => {
    const status = statusWith({ settings: SETTINGS });
    const calls: Array<{ type: string }> = [];
    const store = { current: () => status, subscribe: () => () => undefined, request: async (message: { type: string }) => {
      calls.push(message);
      return { ok: true, value: {} };
    } } as unknown as PanelStore;
    const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined);
    view.render(startGuide(status, false, undefined, { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000", found: false }), status);
    view.render(startGuide(status, false, undefined, FOUND, { wasConnected: true }), status);
    await flush();
    assert.deepEqual(calls, []);
    assert.equal(view.autoSent(), false);
  });
});

test("a request that failed leaves Connect as the retry, with the failure in words", async () => {
  await withFakeDocument(async () => {
    const status = statusWith({ settings: { ...SETTINGS, gatewayUrl: FOUND.gatewayUrl } });
    let calls = 0;
    const store = { current: () => status, subscribe: () => () => undefined, request: async () => {
      calls++;
      return { ok: false, sentence: "Can't reach FluxIQ." };
    } } as unknown as PanelStore;
    const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined);
    view.render(startGuide(status, false, undefined, FOUND), status);
    await flush();
    const root = fake(view.element), connect = root.descendants().find((node) => node.id === "connectButton")!;
    assert.equal(calls, 1);
    assert.equal(connect.hidden, false, "Connect comes back as the retry");
    assert.equal(root.byClass("notice").at(-1)!.textContent, "Can't reach FluxIQ.");
    view.render(startGuide(status, false, undefined, FOUND, { autoSent: view.autoSent() }), status);
    assert.equal(calls, 1, "and nothing is sent again by itself");
  });
});

for (const action of ["connect", "disconnect"] as const) {
  test(`late ${action} refusal does not contradict an already observed goal`, async () => {
    await withFakeDocument(async () => {
      const pending = pendingRequest();
      let status = statusWith({ connectionState: action === "connect" ? "disconnected" : "connecting" });
      const calls: string[] = [];
      const store = { current: () => status, subscribe: () => () => undefined, request: async (message: { type: string }) => {
        calls.push(message.type);
        return pending.promise;
      } } as PanelStore;
      const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined);
      view.render(startGuide(status, false), status);
      const root = fake(view.element), connect = root.descendants().find((node) => node.id === "connectButton")!;
      connect.dispatch("click");
      assert.equal(connect.disabled, true);
      status = statusWith({ connectionState: action === "connect" ? "connected" : "disconnected", paired: true });
      view.render(startGuide(status, false), status);
      assert.equal(connect.disabled, true);
      pending.resolve({ ok: false, sentence: "Synthetic operation refused" });
      await flush();
      assert.equal(root.byClass("notice").at(-1)!.hidden, true);
      assert.equal(connect.disabled, false);
      assert.deepEqual(calls, [action === "connect" ? RUNTIME_MESSAGES.connect : RUNTIME_MESSAGES.disconnect]);
    });
  });
}

test("unmet goal retains refusal until retry or a later matching status", async () => {
  await withFakeDocument(async () => {
    let status: ExtensionStatus = statusWith();
    let calls = 0;
    const store = { current: () => status, subscribe: () => () => undefined, request: async () => {
      calls++;
      return { ok: false, sentence: "Synthetic operation refused" };
    } } as PanelStore;
    const view = createStartView({ store, surface: "sidepanel" } as PanelContext, () => undefined);
    view.render(startGuide(status, false), status);
    const root = fake(view.element), connect = root.descendants().find((node) => node.id === "connectButton")!, notice = root.byClass("notice").at(-1)!;
    connect.dispatch("click");
    await flush();
    assert.equal(notice.hidden, false);
    assert.equal(notice.textContent, "Synthetic operation refused");
    view.render(startGuide(status, false), status);
    assert.equal(notice.hidden, false);
    connect.dispatch("click");
    await flush();
    assert.equal(calls, 2);
    status = statusWith({ connectionState: "connected", paired: true });
    view.render(startGuide(status, false), status);
    assert.equal(notice.hidden, true);
  });
});

test("pending acknowledgement guards repeated activation across status redraw", async () => {
  await withFakeDocument(async () => {
    const pending = pendingRequest(), status = statusWith();
    let calls = 0;
    const store = { current: () => status, subscribe: () => () => undefined, request: async () => {
      calls++;
      return pending.promise;
    } } as PanelStore;
    const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined);
    view.render(startGuide(status, false), status);
    const connect = fake(view.element).descendants().find((node) => node.id === "connectButton")!;
    connect.dispatch("click");
    view.render(startGuide(status, false), status);
    connect.dispatch("click");
    assert.equal(calls, 1);
    pending.resolve({ ok: true, value: {} });
    await flush();
    assert.equal(connect.disabled, false);
  });
});

test("unexpected rejection releases controls with fixed retry feedback", async () => {
  await withFakeDocument(async () => {
    const status = statusWith();
    let calls = 0;
    const store = { current: () => status, subscribe: () => () => undefined, request: async () => {
      if (++calls === 1) throw new Error("synthetic-private-detail");
      return { ok: true, value: {} };
    } } as PanelStore;
    const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined);
    view.render(startGuide(status, false), status);
    const root = fake(view.element), connect = root.descendants().find((node) => node.id === "connectButton")!, notice = root.byClass("notice").at(-1)!;
    connect.dispatch("click");
    await flush();
    assert.equal(connect.disabled, false);
    assert.equal(notice.hidden, false);
    assert.equal(notice.textContent.includes("synthetic-private-detail"), false);
    connect.dispatch("click");
    await flush();
    assert.equal(calls, 2);
    assert.equal(notice.hidden, true);
  });
});

test("Open FluxIQ asks for the pairing page while approval is waited for, and the plain page otherwise", async () => {
  await withFakeDocument(async () => {
    const sent: Array<Record<string, unknown>> = [];
    const store = { request: async (message: Record<string, unknown>) => {
      sent.push(message);
      return { ok: true, value: {} };
    } } as unknown as PanelStore;
    const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined);
    const waiting = statusWith({ connectionState: "pairing", pairingReferenceCode: "482913", paired: false });
    view.render(startGuide(waiting, false), waiting);
    buttonNamed(fake(view.element), "Open in FluxIQ panel")!.dispatch("click");
    await flush();
    assert.deepEqual(requestsOf(sent, RUNTIME_MESSAGES.panelOpenFluxIQ), [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ, purpose: "pairing" }]);
  });
});

test("the key step is a link into the FluxIQ panel's keys page, never a key form", async () => {
  await withFakeDocument(async () => {
    const sent: Array<Record<string, unknown>> = [];
    const store = { request: async (message: Record<string, unknown>) => {
      sent.push(message);
      return { ok: true, value: {} };
    } } as unknown as PanelStore;
    const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined);
    const waiting = statusWith({ connectionState: "pairing", pairingReferenceCode: "482913", paired: false });
    view.render(startGuide(waiting, false), waiting);
    const keyStep = fake(view.element).byClass("start-step")[2]!;
    assert.match(keyStep.textContent, /Add your AI key in the FluxIQ panel/u);
    assert.equal(fake(keyStep).descendants().filter((node) => node.tagName === "input" || node.tagName === "INPUT").length, 0);
    buttonNamed(fake(keyStep), "Add your AI key in the FluxIQ panel")!.dispatch("click");
    await flush();
    assert.deepEqual(requestsOf(sent, RUNTIME_MESSAGES.panelOpenFluxIQ), [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ, purpose: "model-key" }]);
  });
});
