// The worker half of the panel's own requests: saving settings, opening
// FluxIQ, the conversation, Stop, and FluxIQ's live activity.
//
// Shaped like `extraction/control.ts`: one `handled` / `response` answer per
// message, so `background/index.ts` gains two lines.
//
// **Only the panel may ask.** Every one of these is accepted from the side
// panel or the popup and from nothing else (`control-page.ts`). Four of them
// spend the pairing token, and a page under test that could send them would be
// able to talk to FluxIQ as the person who paired this browser, read their
// threads, answer a question FluxIQ asked them, or stop their run. Saving
// settings is no less sharp: whoever sets the FluxIQ address decides where the
// token is sent next. `tests/panel-control.test.ts` proves each refusal happens
// before anything is touched. The activity requests spend no token, but the
// overlay preference is the panel's control over what is drawn on the page
// under test, so the page does not get to set it.

import { ACTIVITY_MESSAGES, type ActivityOverlayPreference, type ExtensionActivityState } from "../../shared/activity/index";
import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus, FluxIQSettings, PanelStopRunRequest } from "../../shared/protocol";
import { isActivityOverlayPreference } from "../activity/index";
import { isControlPage } from "../control-page";
import { relayConversation } from "./conversation-relay";
import { fluxIQWebAddress } from "./open-fluxiq";
import type { PanelRelayContext } from "./relay-context";
import { relayFailure } from "./relay-failure";
import { stopRun } from "./run-control";
import { mergeSettings } from "./settings-save";

type ControlResult = { readonly handled: false } | { readonly handled: true; readonly response: unknown };

type ControlMessage = { readonly type?: string; readonly [key: string]: unknown };

/** What the panel's requests reach the rest of the worker and the browser through. */
export type PanelControlDeps = {
  readonly relay: PanelRelayContext;
  readonly readSettings: () => Promise<FluxIQSettings>;
  readonly writeSettings: (settings: FluxIQSettings) => Promise<void>;
  /** Hands stored settings to the live connection without connecting. */
  readonly applySettings: (settings: FluxIQSettings) => void;
  readonly status: () => Promise<ExtensionStatus>;
  readonly openTab: (url: string) => Promise<void>;
  readonly activity: {
    readonly read: () => Promise<ExtensionActivityState>;
    readonly setOverlay: (overlay: ActivityOverlayPreference) => Promise<ExtensionActivityState>;
  };
};

const PANEL_MESSAGES: ReadonlySet<string> = new Set([
  RUNTIME_MESSAGES.panelSaveSettings,
  RUNTIME_MESSAGES.panelOpenFluxIQ,
  RUNTIME_MESSAGES.panelConversationRead,
  RUNTIME_MESSAGES.panelConversationSend,
  RUNTIME_MESSAGES.panelConversationAnswer,
  RUNTIME_MESSAGES.panelStopRun,
  ACTIVITY_MESSAGES.read,
  ACTIVITY_MESSAGES.setOverlay
]);

export async function handlePanelControl(message: ControlMessage, sender: chrome.runtime.MessageSender, deps: PanelControlDeps): Promise<ControlResult> {
  if (typeof message.type !== "string" || !PANEL_MESSAGES.has(message.type)) return { handled: false };
  if (!isControlPage(sender)) return { handled: true, response: relayFailure("forbidden") };
  return { handled: true, response: await respond(message, deps) };
}

async function respond(message: ControlMessage, deps: PanelControlDeps): Promise<unknown> {
  if (message.type === RUNTIME_MESSAGES.panelSaveSettings) {
    await deps.writeSettings(mergeSettings(await deps.readSettings(), message.settings));
    deps.applySettings(await deps.readSettings());
    return { ok: true, status: await deps.status() };
  }
  if (message.type === RUNTIME_MESSAGES.panelOpenFluxIQ) {
    const url = fluxIQWebAddress((await deps.readSettings()).coreApiUrl);
    if (!url) return relayFailure("invalid_request", "The FluxIQ address in settings is not a web address.");
    await deps.openTab(url);
    return { ok: true, url };
  }
  if (message.type === ACTIVITY_MESSAGES.read) return { ok: true, state: await deps.activity.read() };
  if (message.type === ACTIVITY_MESSAGES.setOverlay) {
    if (!isActivityOverlayPreference(message.overlay)) return relayFailure("invalid_request", "The overlay must be expanded, collapsed or hidden.");
    return { ok: true, state: await deps.activity.setOverlay(message.overlay) };
  }
  if (message.type === RUNTIME_MESSAGES.panelStopRun) return stopRun(message as Partial<PanelStopRunRequest>, deps.relay);
  return relayConversation(message, deps.relay);
}
