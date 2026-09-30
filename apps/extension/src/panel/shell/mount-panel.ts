// The panel shell, mounted by both surfaces: `popup/index.ts` and
// `sidepanel/index.ts` each call `mountPanel` with the stub page's `#app` and
// their surface. There is one UI, laid out like a chat app:
//
//   top bar          FluxIQ, the Chat / Automations tabs, record, the
//                    connection dot, the gear, Open FluxIQ (`top-bar.ts`)
//   recording bar    only while a recording runs (`panel/recording`)
//   one screen       chosen by `screen-state.ts`:
//     chat             the whole panel: the chat (`panel/chat`), with a slim
//                      strip above it while it shows one automation
//     automations      the person's automations, and New automation
//     settings         the gear, in place of everything else
//     getting-started  numbered steps, in place of the chat, until the
//                      browser is connected and approved
//
//   panel/shell/          this: the store, the bar, which screen shows
//   panel/state/          PanelStore, panelRequest, PanelResult, sticky errors
//   panel/getting-started/ the steps, `startGuide`
//   panel/settings/       the connection, on-page status, report, forget pairing
//   panel/automations/    the list, the strip, Run and exports
//   panel/recording/      record, the recording bar, extraction's entry, review
//   panel/open-fluxiq/    the Open FluxIQ button
//   panel/copy/, dom/, theme/tokens.css, extraction/, chat/
//
// Nothing here shows the steps of a run: what FluxIQ decides and does is the
// chat's to show, and internal page reads are never steps.
//
// Record, extract and Run wait while FluxIQ works. That is read from the
// shell's own activity feed (the paced display the chat shows), held steady
// by `working-hold.ts`, and handed to both screens, so a build's many page
// reads never make those controls flicker.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus, RecordingState } from "../../shared/protocol";
import { chooseAutomation, createAutomationsTab } from "../automations";
import { createActivityFeed, createChatPanel, type ActivityFeed, type ChatTarget } from "../chat";
import { createElement } from "../dom";
import { createStartView, startGuide } from "../getting-started";
import { createOpenFluxIQButton } from "../open-fluxiq";
import { createRecordingControls, createRecordingReview } from "../recording";
import { createSettingsView } from "../settings";
import { createPanelStore } from "../state";
import type { PanelContext, PanelSurface } from "./contracts";
import { INITIAL_SHELL, reduceShell, shellScreen, type ShellEvent, type ShellScreen } from "./screen-state";
import { createTopBar, screenId, tabId } from "./top-bar";
import { createWorkingHold } from "./working-hold";
import { workingInput } from "./working-input";
import "../theme/tokens.css";
import "./shell.css";

/** Mounts the panel into `root` for `surface`. */
export function mountPanel(root: HTMLElement, surface: PanelSurface): void {
  document.documentElement.dataset.surface = surface;
  const store = createPanelStore();
  const context: PanelContext = { store, surface };
  let state = INITIAL_SHELL;
  let screen: ShellScreen | undefined;
  let noAnswer = false;
  let recordingWas: RecordingState | undefined;
  let visible = true;
  let connected = false;

  const recording = createRecordingControls(context);
  const review = createRecordingReview(context);
  const chat = createChatPanel(store.request, (style) => createOpenFluxIQButton(store.request, style));
  const automations = createAutomationsTab(context, {
    choose: (row) => void chooseAutomation(row, { open: openInChat, showChat: () => dispatch({ type: "tab", tab: "chat" }) }),
    review: review.element,
    newAutomation: recording.newAutomation
  });
  const working = createWorkingHold(
    { setTimeout: (run, ms) => window.setTimeout(run, ms), clearTimeout: (handle) => window.clearTimeout(handle as number) },
    (now) => {
      recording.setWorking(now);
      automations.setWorking(now);
    }
  );
  const activity: ActivityFeed = createActivityFeed({ request: store.request, listen: listenToPushes }, observeWorking);
  activity.start();
  void activity.read();

  function observeWorking(): void {
    working.observe(workingInput(store.current(), activity.snapshot()));
  }

  const start = createStartView(context, () => dispatch({ type: "gear" }));
  const settings = createSettingsView(context, () => dispatch({ type: "closeSettings" }));
  const openIcon = createOpenFluxIQButton(store.request, { label: "Open FluxIQ", look: "icon" });
  const topBar = createTopBar({
    onTab: (tab) => dispatch({ type: "tab", tab }),
    onGear: () => dispatch({ type: "gear" }),
    record: recording.recordButton,
    openFluxIQ: openIcon.element
  });

  const chatScreen = createElement("section", {
    id: screenId("chat"),
    className: "chat-screen",
    attrs: { role: "tabpanel", "aria-labelledby": tabId("chat") }
  }, [automations.strip.element, chat.element]);
  automations.element.id = screenId("automations");
  automations.element.setAttribute("role", "tabpanel");
  automations.element.setAttribute("aria-labelledby", tabId("automations"));
  const main = createElement("main", { className: "app-main" }, [recording.bar, start.element, settings.element, chatScreen, automations.element]);
  root.replaceChildren(createElement("div", { className: "shell" }, [topBar.element, main]));

  function openInChat(target: ChatTarget): void {
    chat.open(target);
    showTarget(chat.target());
  }

  /** The strip follows the chat's thread, whoever changed it (the chat has its own "Latest chat"). */
  function showTarget(target: ChatTarget): void {
    automations.strip.show(target.kind === "automation" ? target : undefined);
    draw();
  }
  chat.onTargetChange(showTarget);

  function dispatch(event: ShellEvent): void {
    const next = reduceShell(state, event);
    if (next === state) return;
    state = next;
    draw();
  }

  function draw(): void {
    const status = store.current();
    const guide = startGuide(status, noAnswer);
    const next = shellScreen(state, guide.gated);
    start.render(guide, status);
    if (next !== screen) {
      start.element.hidden = next !== "getting-started";
      settings.element.hidden = next !== "settings";
      chatScreen.hidden = next !== "chat";
      automations.element.hidden = next !== "automations";
      topBar.showScreen(next);
      if (next === "settings") settings.shown();
      else if (screen === "settings") settings.hidden();
      screen = next;
    }
    activate();
  }

  /** Reads run only for what is on screen, and only while the panel is. */
  function activate(): void {
    chat.setActive(visible && screen === "chat");
    automations.setActive(visible && (screen === "automations" || (screen === "chat" && chat.target().kind === "automation")));
  }

  store.subscribe((status: ExtensionStatus) => {
    noAnswer = false;
    topBar.render(status);
    openIcon.observe(status);
    recording.render(status);
    review.render(status);
    chat.render(status);
    automations.render(status);
    observeWorking();
    // The relay forgets its state when the worker restarts; read it again on reconnecting.
    const nowConnected = status.connectionState === "connected";
    if (nowConnected && !connected) void activity.read();
    connected = nowConnected;
    const ended = (recordingWas === "recording" || recordingWas === "paused") && status.recordingState === "idle";
    recordingWas = status.recordingState;
    // A recording that just ended is reviewed on the automations tab.
    if (ended) dispatch({ type: "tab", tab: "automations" });
    draw();
  });
  // The store asks once on creation; asking here too is what lets the panel
  // say so when the background never answers (audit defect E2).
  void store.request({ type: RUNTIME_MESSAGES.getStatus }).then((result) => {
    if (result.ok || store.current() !== undefined) return;
    noAnswer = true;
    draw();
  });

  window.addEventListener("pagehide", () => {
    visible = false;
    activate();
  });
  window.addEventListener("pageshow", () => {
    visible = true;
    activate();
  });
  draw();
}

/** The background's broadcasts to this page, for the shell's activity feed. */
function listenToPushes(listener: (message: unknown) => void): () => void {
  const handler = (message: unknown): void => listener(message);
  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
}
