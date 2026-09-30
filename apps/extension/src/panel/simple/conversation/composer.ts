// The composer, as a chat has it: one rounded box at the bottom with the
// text and a round send button inside it.
//
//   - The box grows with what is typed, up to `MAX_LINES` lines, then scrolls.
//   - Enter sends, Shift+Enter adds a line, and nothing sends while an input
//     method is composing (`composerKeyAction`).
//   - Send is disabled while the box is empty or a message is on its way. The
//     box itself stays usable while sending, so typing and focus carry on;
//     the words leave it only once FluxIQ has them, and stay on failure.
//   - The unsent draft is kept (`draftStorage`), so a closed popup keeps it.
//   - Not connected, the box is disabled and says "Connect to FluxIQ first".
//
// Nothing here is rebuilt by `render`: it writes properties of the same
// nodes, so the caret and focus survive every update.

import { createElement } from "../../dom";
import { composerKeyAction } from "./composer-keys";
import type { ConversationState } from "./controller";
import { draftStorage } from "./draft-storage";

/** The mounted composer. */
export type Composer = {
  readonly element: HTMLElement;
  render(state: ConversationState): void;
  focus(): void;
};

const PLACEHOLDER = "Ask FluxIQ to do something...";
const OFFLINE_PLACEHOLDER = "Connect to FluxIQ first";
/** The most lines the box grows to before it scrolls. */
const MAX_LINES = 8;
const SVG = "http://www.w3.org/2000/svg";

/** Creates the composer; `send` answers true once the words went. */
export function createComposer(send: (text: string) => Promise<boolean>): Composer {
  const draft = draftStorage();
  const box = createElement("textarea", {
    id: "conversationInput",
    className: "composer-box",
    attrs: { rows: "1", placeholder: PLACEHOLDER, "aria-label": "Message to FluxIQ", enterkeyhint: "send" }
  });
  box.value = draft.read();
  const sendButton = createElement("button", {
    id: "conversationSendButton",
    className: "composer-send",
    attrs: { type: "button", "aria-label": "Send", title: "Send (Enter)" }
  }, [arrowIcon()]);
  const notice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const element = createElement("div", { className: "composer" }, [createElement("div", { className: "composer-field" }, [box, sendButton]), notice]);
  let enabled = false;
  let sending = false;
  let composing = false;

  function fit(): void {
    // A box not laid out (its view hidden) measures 0; it keeps its stylesheet height until it is.
    if (box.scrollHeight === 0) {
      box.style.height = "";
      return;
    }
    const style = globalThis.getComputedStyle?.(box);
    const line = Number.parseFloat(style?.lineHeight ?? "") || 20;
    const padding = (Number.parseFloat(style?.paddingTop ?? "") || 0) + (Number.parseFloat(style?.paddingBottom ?? "") || 0);
    const max = line * MAX_LINES + padding;
    box.style.height = "auto";
    const wanted = Math.min(box.scrollHeight, max);
    box.style.height = `${Math.ceil(wanted)}px`;
    box.style.overflowY = box.scrollHeight > max ? "auto" : "hidden";
  }

  function syncButton(): void {
    const disabled = !enabled || sending || box.value.trim() === "";
    if (sendButton.disabled !== disabled) sendButton.disabled = disabled;
    const label = sending ? "Sending" : "Send";
    if (sendButton.getAttribute("aria-label") !== label) sendButton.setAttribute("aria-label", label);
    sendButton.dataset.sending = sending ? "true" : "false";
  }

  function submit(): void {
    if (!enabled || sending || box.value.trim() === "") return;
    void send(box.value).then((sent) => {
      if (!sent) return;
      box.value = "";
      draft.write("");
      fit();
      syncButton();
    });
  }

  sendButton.addEventListener("click", () => {
    submit();
    box.focus();
  });
  box.addEventListener("input", () => {
    draft.write(box.value);
    fit();
    syncButton();
  });
  box.addEventListener("compositionstart", () => (composing = true));
  box.addEventListener("compositionend", () => (composing = false));
  box.addEventListener("keydown", (event) => {
    if (composerKeyAction(event, composing) !== "send") return;
    event.preventDefault();
    submit();
  });
  // The box has its size once it is on screen; until then the browser measures nothing.
  globalThis.requestAnimationFrame?.(fit);

  return {
    element,
    render(state) {
      enabled = state.mode !== "offline" && state.mode !== "fallback";
      sending = state.sending;
      if (box.disabled !== !enabled) box.disabled = !enabled;
      const placeholder = enabled ? PLACEHOLDER : OFFLINE_PLACEHOLDER;
      if (box.placeholder !== placeholder) box.placeholder = placeholder;
      syncButton();
      // A kept draft is sized once the box is on screen.
      if (box.style.height === "" && box.value !== "") fit();
      const error = state.sendError ?? "";
      if (notice.textContent !== error) notice.textContent = error;
      if (notice.hidden !== (state.sendError === undefined)) notice.hidden = state.sendError === undefined;
    },
    focus() {
      box.focus();
      fit();
    }
  };
}

function arrowIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  for (const [name, value] of [["viewBox", "0 0 24 24"], ["width", "18"], ["height", "18"], ["aria-hidden", "true"], ["focusable", "false"]]) svg.setAttribute(name!, value!);
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2.2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("d", "M12 19V5M5.5 11.5 12 5l6.5 6.5");
  svg.append(path);
  return svg;
}
