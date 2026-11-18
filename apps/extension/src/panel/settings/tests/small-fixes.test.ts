// Small Settings fixes from the extension audit: a stale "Saved." clears on leaving, the Forget question is brought
// into view, Disconnect hides once pressed, a request switch that does nothing is not drawn, and the problem report
// does not say "ids".

import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import type { ExtensionCaptureAllowed, ExtensionStatus } from "../../../shared/protocol";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelContext } from "../../shell";
import type { PanelResult } from "../../state";
import type { ModelKeyReading } from "../../getting-started";
import { createSettingsForm } from "../address-form";
import { createForgetConfirmation } from "../forget-confirmation";
import { PROBLEM_REPORT_COPIED } from "../problem-report-plan";
import { createSettingsView } from "../settings-view";
import { storeWith } from "./store-fixture";

const ALLOWED: ExtensionCaptureAllowed = { captureMutations: true, captureInputValues: true, captureSnapshots: true, directRequests: false };
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const status = (extra: Partial<ExtensionStatus> = {}): ExtensionStatus => ({ connectionState: "connected", recordingState: "idle", gatewayUrl: defaultSettings().gatewayUrl, settings: defaultSettings(), clientId: "fixture", paired: true, queueSize: 0, eventCount: 0, recentActivities: [], ...extra });

function modelDocument(): void {
  const doc = document as unknown as { createElement(tag: string): unknown; hasFocus(): boolean };
  const create = doc.createElement;
  doc.hasFocus = () => false;
  doc.createElement = (tag) => Object.defineProperty(create(tag) as object, "ownerDocument", { value: doc, enumerable: true });
}

async function withChrome(body: () => Promise<void>): Promise<void> {
  const scope = globalThis as unknown as { chrome?: unknown };
  const previous = scope.chrome;
  scope.chrome = { runtime: { lastError: undefined, onMessage: { addListener() {}, removeListener() {} }, sendMessage() {} }, storage: { local: { get: (_keys: unknown, done: (items: Record<string, unknown>) => void) => done({}), set: (_values: unknown, done?: () => void) => done?.(), remove: (_key: unknown, done?: () => void) => done?.() } } };
  try {
    await body();
  } finally {
    scope.chrome = previous;
  }
}

function view(current: ExtensionStatus) {
  const forgotten = async <T>(): Promise<PanelResult<T>> => ({ ok: true, value: { forgetReachedCore: true } as T });
  const readModelKey = async (): Promise<ModelKeyReading> => ({ kind: "no-key" });
  return createSettingsView({ store: storeWith(current, forgotten), surface: "popup" } as PanelContext, () => undefined, { setup: { readModelKey } });
}

test("a Saved outcome clears when settings are left, so a later visit never shows it as new", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    const settings = view(status());
    settings.shown();
    await tick();
    const root = fake(settings.element);
    root.descendants().find((node) => node.id === "forgetPairingButton")!.dispatch("click");
    root.descendants().find((node) => node.tagName === "BUTTON" && node.textContent === "Forget")!.dispatch("click");
    await tick();
    const outcome = root.byClass("success-line")[0]!;
    const bar = root.byClass("settings-save")[0]!;
    assert.equal(outcome.hidden, false);
    assert.equal(bar.hidden, false);
    settings.hidden();
    assert.equal(outcome.hidden, true);
    assert.equal(bar.hidden, true);
    settings.shown();
    assert.equal(bar.hidden, true, "and it is not back on the next visit");
  }));
});

test("the Forget question is scrolled into view when it opens", async () => {
  await withFakeDocument(async () => {
    modelDocument();
    const root = fake(createForgetConfirmation(async () => true).element);
    const confirm = root.descendants().find((node) => node.id === "forgetPairingConfirm")!;
    const scrolled: unknown[] = [];
    (confirm as unknown as { scrollIntoView: (options: unknown) => void }).scrollIntoView = (options) => void scrolled.push(options);
    root.descendants().find((node) => node.id === "forgetPairingButton")!.dispatch("click");
    assert.equal(confirm.hidden, false);
    assert.deepEqual(scrolled, [{ block: "nearest" }]);
  });
});

test("Disconnect is hidden once the browser is disconnected, and shown while it is not", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    for (const [connectionState, hidden] of [["connected", false], ["pairing", false], ["disconnected", true]] as const) {
      const settings = view(status({ connectionState }));
      settings.shown();
      await tick();
      assert.equal(fake(settings.element).descendants().find((node) => node.id === "disconnectButton")!.hidden, hidden, connectionState);
    }
  }));
});

test("Allow direct requests is not drawn while Core forbids it, and appears when Core allows it", async () => {
  await withFakeDocument(() => {
    const form = createSettingsForm();
    const root = fake(form.element);
    const row = () => root.descendants().find((node) => node.id === "requestsEnabled")!.parentNode!.parentNode as unknown as { hidden: boolean };
    assert.equal(row().hidden, true, "Core's default forbids it");
    form.allow({ ...ALLOWED, directRequests: true });
    assert.equal(row().hidden, false);
    form.allow({ ...ALLOWED, directRequests: false });
    assert.equal(row().hidden, true);
    const snapshots = root.descendants().find((node) => node.id === "captureSnapshots")!.parentNode!.parentNode as unknown as { hidden: boolean };
    assert.equal(snapshots.hidden, false, "a capture switch Core forbids stays, explained, rather than vanishing");
  });
});

test("the problem report line says versions and recent failures, with no ids", () => {
  assert.equal(PROBLEM_REPORT_COPIED, "Problem report copied. It holds versions and recent failures, never page data or your pairing.");
  assert.doesNotMatch(PROBLEM_REPORT_COPIED, /\bids\b/iu);
});
