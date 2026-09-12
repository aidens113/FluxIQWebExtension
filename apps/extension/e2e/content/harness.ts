// The T2 content-script harness: the real content-script bundle in a real
// Chromium page on a Scenario Lab fixture, with the extension replaced by a
// `chrome.runtime` stub (runtime-stub.ts). A spec talks to the content script
// as the background worker does -- `executeAction`, `captureSnapshot`,
// `recording` -- and reads back every message the content script sent.
//
// The page-world bundle (src/page-world/) is injected too, before the content
// script, as the manifests' `world: "MAIN"` entry does -- otherwise the
// native-dialog override would be missing and `web.dom.dialog` would correctly
// refuse to arm.
//
// Fidelity: the bundle runs at document start in every frame, as the
// manifest's `run_at: document_start, all_frames: true` does, but in the
// page's main world rather than an isolated one, and with no background
// worker, tab, or frame routing. Messages go to and come from the top frame
// only. A spec proves the content script's own behaviour against a live DOM;
// it proves nothing about delivery between extension contexts. One consequence
// of the single world: the page-world script is injected before the
// `chrome.runtime` stub, because it refuses to install where it can see an
// extension runtime -- which is how it detects having landed in an isolated
// world on a browser too old for `world: "MAIN"`.
//
// The wire names below are written out rather than imported from
// src/content/messages.ts on purpose: a harness that shared the constants
// could not notice them changing.

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { getScenario } from "../../../scenario-lab/src/registry.js";
import { startScenarioLab, type RunningScenarioLab } from "../../../scenario-lab/src/server.js";
import type { ScenarioSnapshot } from "../../../scenario-lab/src/types.js";
import type { BrowserActionCommand, BrowserActionResult, DomSnapshot, RecordingEventPayload } from "../../src/shared/protocol.js";
import { CONTENT_HARNESS_BUNDLE_ENV, CONTENT_HARNESS_PAGE_WORLD_BUNDLE_ENV } from "./bundle-env.js";
import { installRuntimeStub, type HarnessDelivery } from "./runtime-stub.js";

/** The page global the runtime stub installs; `deliver` and `sent` live on it. */
const HARNESS_GLOBAL = "__fluxiqContentHarness";

export type ContentHarnessOptions = {
  scenarioId: string;
  /** Scenario Lab seed. Defaults to the scenario's own, so fixture state matches its manifest. */
  seed?: number;
};

/** The capture settings the background worker sends with a `recording` message. */
export type HarnessRecordingSettings = { captureMutations?: boolean; captureInputValues?: boolean; captureSnapshots?: boolean };

/** One message the content script sent through `chrome.runtime.sendMessage`. */
export type SentMessage = { type?: string; payload?: unknown } & Record<string, unknown>;

export type ContentHarness = {
  page: Page;
  lab: RunningScenarioLab;
  scenarioId: string;
  /** The fixture page the content script was loaded into. */
  url: string;
  /** Hands any message to the content script's `onMessage` listeners. */
  deliver(message: unknown): Promise<HarnessDelivery>;
  /** Sends the `executeAction` message the background worker sends and returns the content script's reply. */
  runAction(command: BrowserActionCommand): Promise<BrowserActionResult>;
  /** Sends the `captureSnapshot` request and returns the snapshot it answers with. */
  capture(): Promise<DomSnapshot>;
  /** Starts or stops recording as the background worker does. Stopping flushes the debounced `dom.input`. */
  setRecording(recording: boolean, settings?: HarnessRecordingSettings): Promise<void>;
  /** Every message the content script sent, oldest first. */
  messages(): Promise<SentMessage[]>;
  /** The recorded events it sent (`fluxiq.contentEvent` payloads), optionally only one kind. */
  recordedEvents(kind?: RecordingEventPayload["kind"]): Promise<RecordingEventPayload[]>;
  /** The Scenario Lab oracle: this scenario's state as the fixture last recorded it. */
  finalState(): Promise<ScenarioSnapshot>;
  close(): Promise<void>;
};

let bundleSource: Promise<string> | undefined;
let pageWorldBundle: Promise<string> | undefined;
const pagesWithContentScript = new WeakSet<Page>();

/** Starts a Scenario Lab, opens `scenarioId` in `page` with the content script loaded, and waits for it to announce itself. */
export async function openContentHarness(page: Page, options: ContentHarnessOptions): Promise<ContentHarness> {
  const scenario = getScenario(options.scenarioId);
  if (!scenario) throw new Error(`Scenario "${options.scenarioId}" is not registered in the Scenario Lab.`);
  const source = await contentBundleSource();
  const pageWorld = await pageWorldBundleSource();
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: options.seed ?? scenario.seed });
  const url = new URL(scenario.startPath, lab.origin).href;

  const deliver = (message: unknown): Promise<HarnessDelivery> => page.evaluate(([name, value]) => {
    const stub = (window as unknown as Record<string, { deliver(message: unknown): Promise<HarnessDelivery> } | undefined>)[name];
    if (!stub) throw new Error("The content-harness runtime stub is not installed in this page.");
    return stub.deliver(value);
  }, [HARNESS_GLOBAL, message] as const);
  const messages = async (): Promise<SentMessage[]> => {
    const sent = await page.evaluate(
      (name) => (window as unknown as Record<string, { sent: SentMessage[] } | undefined>)[name]?.sent ?? null,
      HARNESS_GLOBAL
    );
    if (!sent) throw new Error(`The content-harness runtime stub is not installed in ${page.url()}.`);
    return sent;
  };
  const answer = async (message: { type: string } & Record<string, unknown>, what: string): Promise<unknown> => {
    const delivery = await deliver(message);
    if (!delivery.responded) throw new Error(`The content script did not answer ${what}.`);
    return delivery.response;
  };

  try {
    if (!pagesWithContentScript.has(page)) {
      // The page world first, and before the runtime stub: the override
      // refuses to install where it can see an extension runtime.
      await page.addInitScript({ content: pageWorldInitScript(pageWorld) });
      await page.addInitScript({ content: initScript(source) });
      pagesWithContentScript.add(page);
    }
    await page.goto(url);
    const ready = (await messages()).some((message) => message.type === "fluxiq.contentReady");
    if (!ready) throw new Error(`The content script did not announce itself on ${url}: no fluxiq.contentReady was sent.`);
  } catch (error) {
    await lab.close();
    throw error;
  }

  let closing: Promise<void> | undefined;
  return {
    page,
    lab,
    scenarioId: scenario.id,
    url,
    deliver,
    // As runtime/action-runner.ts sends it for an action with no frame id.
    runAction: async (command) => await answer({ type: "executeAction", action: command, topFrameOnly: true }, `executeAction for ${command.actionType} (${command.commandId})`) as BrowserActionResult,
    capture: async () => await answer({ type: "captureSnapshot" }, "captureSnapshot") as DomSnapshot,
    setRecording: async (recording, settings) => {
      await answer({ type: "recording", recording, ...(settings ? { settings } : {}) }, "the recording message");
    },
    messages,
    recordedEvents: async (kind) => {
      const events = (await messages())
        .filter((message) => message.type === "fluxiq.contentEvent")
        .map((message) => message.payload as RecordingEventPayload);
      return kind ? events.filter((event) => event.kind === kind) : events;
    },
    finalState: async () => {
      const response = await fetch(`${lab.origin}/__control/final-state?scenario=${encodeURIComponent(scenario.id)}`, {
        headers: { authorization: `Bearer ${lab.runToken}` }
      });
      if (!response.ok) throw new Error(`The Scenario Lab answered ${response.status} for the final state of ${scenario.id}.`);
      return await response.json() as ScenarioSnapshot;
    },
    close: () => (closing ??= lab.close())
  };
}

function contentBundleSource(): Promise<string> {
  const bundlePath = process.env[CONTENT_HARNESS_BUNDLE_ENV];
  if (!bundlePath) {
    return Promise.reject(new Error(`${CONTENT_HARNESS_BUNDLE_ENV} is not set. e2e/content/global-setup.ts builds the content-script bundle; run the specs with "pnpm test:content".`));
  }
  bundleSource ??= readFile(bundlePath, "utf8");
  return bundleSource;
}

function pageWorldBundleSource(): Promise<string> {
  const bundlePath = process.env[CONTENT_HARNESS_PAGE_WORLD_BUNDLE_ENV];
  if (!bundlePath) {
    return Promise.reject(new Error(`${CONTENT_HARNESS_PAGE_WORLD_BUNDLE_ENV} is not set. e2e/content/global-setup.ts builds the page-world bundle; run the specs with "pnpm test:content".`));
  }
  pageWorldBundle ??= readFile(bundlePath, "utf8");
  return pageWorldBundle;
}

/** The runtime stub first, then the bundle, in one script so their order is fixed. */
function initScript(bundle: string): string {
  return `(${installRuntimeStub.toString()})(${JSON.stringify(HARNESS_GLOBAL)});\n${bundle}\n//# sourceURL=fluxiq-content-harness.js\n`;
}

/** The page-world bundle alone, as the manifests' `world: "MAIN"` entry injects it. */
function pageWorldInitScript(bundle: string): string {
  return `${bundle}\n//# sourceURL=fluxiq-page-world-harness.js\n`;
}
