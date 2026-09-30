import type { BrowserContext, Page } from "@playwright/test";
import type { DeterministicNetworkGuard } from "../network-guard.js";
import type { ObservedCoreCall } from "./core-recording-proxy.js";
import type { EvidenceWriter } from "./evidence-writer.js";
import type { ChatPanelDriver } from "./panel-driver.js";
import type { WorkerRequest } from "./open-chrome-session.js";
import type { ThreadReader } from "./thread-reader.js";

/** Which browser, and how the chat was shown in it. */
export type ChatBrowser = "chrome" | "firefox";

/**
 * - `side-panel`: Chrome's real side panel, verified open by a `SIDE_PANEL` context.
 * - `action-popup`: Firefox's real toolbar popup, opened by `action.openPopup()`.
 * - `popup-window`: the popup page in an unfocused popup-type window beside the browser window.
 */
export type ChatPanelMode = "side-panel" | "action-popup" | "popup-window";

/** One headed browser with the extension loaded, the scenario page open, and the chat shown. */
export type ChatBrowserSession = {
  browser: ChatBrowser;
  context: BrowserContext;
  /** The route-level network guard, installed before any page was opened. */
  guard: DeterministicNetworkGuard;
  /** An extension page kept open to send runtime messages from; never the page the person types in. */
  control: Page;
  scenario: Page;
  /** The chat the person types in: the side panel, or the popup. Undefined until `openPanel` ran. */
  panel?: ChatPanelDriver;
  panelMode?: ChatPanelMode;
  /** What the way the panel was shown does and does not stand for. */
  panelNote?: string;
  /** The extension's own origin (`chrome-extension://<id>` or `moz-extension://<uuid>`). */
  extensionOrigin: string;
  /** The profile directory the browser was launched on, which names its process for a window capture. */
  profileDir: string;
  browserVersion: string;
  /** Shows the chat beside the scenario page, and sets `panel`, `panelMode` and `panelNote`. */
  openPanel(): Promise<void>;
  close(): Promise<void>;
};

/** Everything a claim needs: the browser, what reached Core, Core's own record, and where evidence goes. */
export type ChatCheckContext = {
  session: ChatBrowserSession;
  projectId: string;
  /** The extension's program calls as the recording proxy in front of Core received them. */
  coreCalls: () => readonly ObservedCoreCall[];
  /** Chrome only: the program calls Playwright saw leave the extension's service worker. */
  workerRequests?: () => readonly WorkerRequest[];
  reader: ThreadReader;
  evidence: EvidenceWriter;
  log: (line: string) => void;
};
