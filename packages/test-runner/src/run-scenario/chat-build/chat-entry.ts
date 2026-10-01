// What a created-Flow run hands the lane so its build starts from the
// extension's chat window: the chat as the person sees it beside the scenario
// page, the key install that lets the chat's build reach the provider, and the
// Lab person's way of answering a question in that same chat.
//
// The chat is the panel the run already shows beside the page
// (`openLivePanel`): Chrome's real side panel, or the docked popup when the
// side panel was refused. Both are views of the extension's panel page, driven
// from the run's control tab (`extensionViewPanelDriver`), so this is the
// panel's own composer, controller and background relay to Core. A run whose
// panel is not on screen has no chat to type in, and is refused.

import type { Page } from "@playwright/test";
import type { CreatedFlowLaneEntry } from "../../flow-lane/index.js";
import { extensionViewPanelDriver } from "../../extension-chat-check/index.js";
import { RunnerFailure } from "../../failure.js";
import type { PersonAskAnswer, PersonChatAnswerer, PendingPersonAsk } from "../../person-simulation/index.js";
import type { LivePanelOutcome } from "../browser-session/index.js";

/** The panel page every live panel shows, side panel or popup. */
const PANEL_PATH = "sidepanel/index.html";
/** Core's subject kind for the project's own thread, which is the extension's chat. */
const CHAT_SUBJECT = "project";
const PRESS_MS = 30_000;
const SETTLE_MS = 30_000;

export type ChatEntryCore = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: { timeoutMs?: number }, domainId?: string): Promise<unknown>;
};

export type ChatEntryInput = {
  /** The run's extension control tab: an extension page, from which the panel's own document is reached. */
  extensionControl: Page;
  /** How the run showed its panel; the chat exists only when it is on screen. */
  livePanel: LivePanelOutcome;
  core: ChatEntryCore;
  scope: Readonly<{ projectId: string; domainId: string }>;
  /** Installs the run's model key for the person (`LiveLlmRun.chatBuildAuthorizer`). */
  authorizeChat: () => Promise<void>;
  /** Puts a moment of the chat on the run's timeline, with the window's picture. Must not throw. */
  picture: (moment: "sent" | "answered" | "ended") => Promise<void>;
};

/**
 * The lane's chat entry and the person's chat answerer, both on the panel the
 * run shows. Refuses when no panel is on screen, naming why it is not.
 */
export function createdFlowChatEntry(input: ChatEntryInput): { entry: Extract<CreatedFlowLaneEntry, { kind: "chat" }>; answerInChat: PersonChatAnswerer } {
  if (input.livePanel.mode !== "side-panel" && input.livePanel.mode !== "popup") {
    const why = input.livePanel.mode === "skipped" ? input.livePanel.reason : input.livePanel.reason;
    throw new RunnerFailure("environment.missing", `A created-Flow run starts its build from the extension's chat window, and the chat was not on screen (${input.livePanel.mode}: ${why}). Run it headed without --no-live-panel, or pass --direct-api-build for a test-only run that is never counted as a pass`);
  }
  const panel = extensionViewPanelDriver(input.extensionControl, PANEL_PATH);
  const entry: Extract<CreatedFlowLaneEntry, { kind: "chat" }> = Object.freeze({
    kind: "chat" as const,
    authorizeChat: input.authorizeChat,
    chat: {
      panelInput: panel.input,
      type: (text: string) => panel.send(text),
      shows: () => panel.text(),
      picture: input.picture,
    },
  });
  const answerInChat: PersonChatAnswerer = async (ask, answer) => {
    if (ask.subject?.kind !== CHAT_SUBJECT) return false;
    const label = await answerLabel(input.core, input.scope, ask, answer);
    await panel.press(label, PRESS_MS);
    await settled(input.core, input.scope, ask);
    return true;
  };
  return { entry, answerInChat };
}

/**
 * The words on the button that gives `answer` under the question, as the
 * panel shows them (`panel/chat/conversation/ask-copy.ts`): Allow and Don't
 * allow for a permission, Yes and No for a confirmation, the option's own
 * label for a choice, read from the question Core holds.
 */
async function answerLabel(core: ChatEntryCore, scope: ChatEntryInput["scope"], ask: PendingPersonAsk, answer: PersonAskAnswer): Promise<string> {
  if (answer.kind !== "choice") {
    if (answer.kind === "grant") return ask.kind === "permission" ? "Allow" : "Yes";
    return ask.kind === "permission" ? "Don't allow" : "No";
  }
  const turn = await askTurn(core, scope, ask);
  const options = isRecord(turn?.ask) && Array.isArray(turn.ask.options) ? turn.ask.options.filter(isRecord) : [];
  const option = options.find((candidate) => candidate.id === answer.value);
  if (typeof option?.label !== "string") throw new RunnerFailure("runtime.behavior", `The chat's question offers no option ${answer.value} to press`, { details: { askId: ask.askId } });
  return option.label;
}

/** Waits until Core holds an answer to `ask`, so a press the panel lost is a failure here and not a question left waiting. */
async function settled(core: ChatEntryCore, scope: ChatEntryInput["scope"], ask: PendingPersonAsk): Promise<void> {
  const deadline = Date.now() + SETTLE_MS;
  for (;;) {
    const turn = await askTurn(core, scope, ask);
    if (isRecord(turn?.ask) && turn.ask.status !== "pending") return;
    if (Date.now() >= deadline) throw new RunnerFailure("runtime.behavior", `The answer pressed in the extension's chat did not reach FluxIQ within ${SETTLE_MS / 1000} s`, { details: { askId: ask.askId } });
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function askTurn(core: ChatEntryCore, scope: ChatEntryInput["scope"], ask: PendingPersonAsk): Promise<Record<string, unknown> | undefined> {
  const payload = await core.automationStudioCall("get-conversation", { projectId: scope.projectId, conversationId: ask.conversationId, limit: 200 }, { timeoutMs: 10_000 }, scope.domainId);
  const conversation = isRecord(payload) && isRecord(payload.conversation) ? payload.conversation : {};
  const turns = Array.isArray(conversation.turns) ? conversation.turns.filter(isRecord) : [];
  return turns.find((turn) => isRecord(turn.ask) && turn.ask.askId === ask.askId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
