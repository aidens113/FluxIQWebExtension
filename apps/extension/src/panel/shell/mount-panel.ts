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
// The empty latest chat's "Extract data from this page" shows the Automations
// tab and presses the extraction entry there (`#extractDataButton`, mounted by
// `panel/recording` inside New automation, or in the recording bar while a
// recording runs), so the sheet opens exactly as its own button opens it.
// When the entry cannot be pressed now, it gets the focus instead, beside the
// line saying why.
//
// Nothing here shows the steps of a run: what FluxIQ decides and does is the
// chat's to show, and internal page reads are never steps.
//
// A run that starts shows the Chat tab, from Automations or Settings alike,
// so each step is watched live (`run-follow.ts` says when). Builds never move
// the panel, a recording keeps it, and a field the person types in keeps it
// until they stop. The chat then shows that run's steps: a chat open on a
// thread that would not show them (another automation's, a question's) opens
// the run's automation, the latest chat, or the run's own thread
// (`chat/stream/run-target.ts`), waiting while the person types a message.
//
// Record, extract and Run wait while FluxIQ works. That is read from the
// shell's own activity feed (the paced display the chat shows), held steady
// by `working-hold.ts`, and handed to both screens, so a build's many page
// reads never make those controls flicker.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus, RecordingState } from "../../shared/protocol";
import { chooseAutomation, createAutomationsTab } from "../automations";
import { createActivityFeed, createChatOwnerContext, createChatPanel, type ActivityFeed, type ChatTarget } from "../chat";
import { createElement } from "../dom";
import { bindChatProjectNavigation } from "../chat/project-navigation";
import { createStartView, startGuide } from "../getting-started";
import { createOpenFluxIQButton } from "../open-fluxiq";
import { createRecordingControls, createRecordingReview } from "../recording";
import { createSettingsView } from "../settings";
import { createPanelStore } from "../state";
import type { PanelContext, PanelSurface } from "./contracts";
import { createRunFollow } from "./run-follow";
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
  let activatedRow: HTMLElement | undefined;
  const runFollow = createRunFollow();

  const recording = createRecordingControls(context);
  const review = createRecordingReview(context);
  const chat = createChatPanel(store.request, (style) => createOpenFluxIQButton(store.request, style), { onExtract: () => openExtraction() });
  const automations = createAutomationsTab(context, {
    choose: (row) => {
      const source = activatedRow;
      activatedRow = undefined;
      chooseAutomation(row, { open: openInChat, showChat: () => dispatch({ type: "tab", tab: "chat" }) });
      const doc = root.ownerDocument;
      if (!source || !doc.hasFocus() || doc.visibilityState !== "visible" || screen !== "chat") return;
      const box = chat.element.querySelector<HTMLTextAreaElement>("#conversationInput");
      if (box && !box.disabled && navigationVisible(box)) chat.focusComposer();
      else {
        const tab = topBar.element.querySelector<HTMLButtonElement>(`#${tabId("chat")}`);
        if (tab && !tab.disabled && tab.getAttribute("aria-selected") === "true" && navigationVisible(tab)) tab.focus({ preventScroll: true });
      }
    },
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
  const workingOwner = createChatOwnerContext(store.request);
  let activity: ActivityFeed | undefined;
  let activityCurrent = () => false;
  let activityUnsupported = false;
  replaceWorkingFeed();

  function replaceWorkingFeed(): void {
    const previous = activity;
    activity = undefined;
    previous?.stop();
    working.reset();
    const lease = workingOwner.capture();
    const next = createActivityFeed({
      request: <T>(message: Parameters<typeof store.request>[0]) => current()
        ? lease.request<T>(message)
        : Promise.resolve({ ok: false as const, sentence: "This context has changed. Try again." }),
      listen: listener => listenToPushes(message => { if (current()) listener(message); })
    }, () => {
      if (!current()) return;
      if (next.snapshot().reach === "unsupported") activityUnsupported = true;
      observeWorking();
      followRun();
    });
    function current(): boolean { return activity === next && lease.current(); }
    activity = next;
    activityCurrent = current;
    if (!activityUnsupported) { next.start(); void next.read(); }
    observeWorking();
  }

  function observeWorking(): void {
    working.observe(workingInput(store.current(), activityCurrent() ? activity?.snapshot() : undefined));
  }

  /** Shows the Chat tab when a run of the chosen project starts (`run-follow.ts`). */
  function followRun(): void {
    if (screen === undefined) return;
    const feed = activityCurrent() ? activity?.snapshot() : undefined;
    if (feed?.reach !== "ready") return;
    const status = store.current();
    const doc = root.ownerDocument;
    const focused = doc.hasFocus() ? doc.activeElement : null;
    const away = focused !== null && focused !== doc.body && !chatScreen.contains(focused) && main.contains(focused) ? focused as HTMLElement : undefined;
    const follow = runFollow.observe({
      current: feed.state.current,
      projectId: chat.target().projectId ?? (typeof status?.projectId === "string" ? status.projectId : undefined),
      recording: status?.recordingState === "recording" || status?.recordingState === "paused",
      typing: away !== undefined && typingIn(away)
    });
    if (!follow || feed.state.current === null) return;
    dispatch({ type: "tab", tab: "chat" });
    // The chat opens a thread that shows this run's steps when the one on screen would not (`chat/stream/run-target.ts`).
    chat.followRun(feed.state.current);
    // Focus left on a control the switch just hid goes to the Chat tab, never into a field.
    if (away !== undefined && !navigationVisible(away)) {
      const tab = topBar.element.querySelector<HTMLButtonElement>(`#${tabId("chat")}`);
      if (tab && !tab.disabled && navigationVisible(tab)) tab.focus({ preventScroll: true });
    }
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
  // Capture the actual activating row before its handler changes screens.
  automations.element.addEventListener("click", (event) => {
    const source = (event.target as Element).closest<HTMLElement>(".automation-row");
    const doc = root.ownerDocument;
    activatedRow = source && automations.element.contains(source) && source === doc.activeElement && navigationVisible(source) && doc.hasFocus() && doc.visibilityState === "visible" ? source : undefined;
    queueMicrotask(() => { activatedRow = undefined; });
  }, true);

  function openExtraction(): void {
    dispatch({ type: "tab", tab: "automations" });
    const entry = recording.newAutomation.querySelector<HTMLButtonElement>(`#${EXTRACTION_ENTRY_ID}`)
      ?? recording.bar.querySelector<HTMLButtonElement>(`#${EXTRACTION_ENTRY_ID}`);
    if (entry === null) return;
    if (!entry.disabled) entry.click();
    else entry.focus({ preventScroll: true });
  }

  function openInChat(target: ChatTarget): void {
    chat.open(target);
    showTarget(chat.target());
  }

  bindChatProjectNavigation(window, projectId => {
    openInChat({ kind: "project", projectId });
    dispatch({ type: "tab", tab: "chat" });
  });

  let passiveName: { readonly flowId: string; readonly name: string } | undefined;
  /** The strip follows navigation; passive names already came from its own drawn row. */
  function showTarget(target: ChatTarget): void {
    if (target.kind === "automation" && passiveName && target.flowId === passiveName.flowId && target.name === passiveName.name) return;
    automations.strip.show(target.kind === "automation" ? target : undefined);
    draw();
  }
  chat.onTargetChange(showTarget);
  automations.strip.onNameChange((automation) => {
    const target = chat.target();
    if (target.kind !== "automation" || target.flowId !== automation.flowId) return;
    const previous = passiveName;
    passiveName = automation;
    try { chat.updateAutomationName(automation); } finally { passiveName = previous; }
  });

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
    const owner = workingOwner.observe(status);
    const replaced = owner.changed || owner.initial;
    if (replaced) replaceWorkingFeed();
    else observeWorking();
    topBar.render(status);
    openIcon.observe(status);
    recording.render(status);
    review.render(status);
    chat.render(status);
    automations.render(status);
    // The relay forgets its state when the worker restarts; read it again on reconnecting.
    const nowConnected = status.connectionState === "connected";
    if (nowConnected && !connected && !replaced && !activityUnsupported) void activity?.read();
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

/** The extraction entry's id, kept from the single-file popup (`panel/extraction/panel-elements.ts`). */
const EXTRACTION_ENTRY_ID = "extractDataButton";

/** The background's broadcasts to this page, for the shell's activity feed. */
function listenToPushes(listener: (message: unknown) => void): () => void {
  const handler = (message: unknown): void => listener(message);
  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
}

/** A field that takes typing: a text-like input, a textarea, a select, or editable content. */
function typingIn(element: HTMLElement): boolean {
  const tag = element.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return !(element as HTMLTextAreaElement).disabled;
  if (tag === "input") {
    const input = element as HTMLInputElement;
    return !input.disabled && !NOT_TYPED.has((input.type || "text").toLowerCase());
  }
  return element.isContentEditable === true;
}

/** Input types a person presses rather than types in. */
const NOT_TYPED = new Set(["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "image"]);

function navigationVisible(element: HTMLElement): boolean {
  return element.isConnected && !element.closest("[hidden], [inert]") && element.getClientRects().length > 0;
}
