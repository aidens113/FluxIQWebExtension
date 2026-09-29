// The composer: "Ask FluxIQ to do something..." and Send (UI audit, section 4,
// "3. Conversation card"). Enter sends; Shift+Enter adds a line. While sending
// the button reads "Sending..." and is disabled, and the words stay in the box
// until FluxIQ has them; on failure they stay too. Not connected, the box is
// disabled and says "Connect to FluxIQ first".

import { createElement } from "../../dom";
import type { ConversationState } from "./controller";
import { draftStorage } from "./draft-storage";

/** The mounted composer. */
export type Composer = {
  readonly element: HTMLElement;
  render(state: ConversationState): void;
};

const PLACEHOLDER = "Ask FluxIQ to do something...";
const OFFLINE_PLACEHOLDER = "Connect to FluxIQ first";

/** Creates the composer; `send` answers true once the words went. */
export function createComposer(send: (text: string) => Promise<boolean>): Composer {
  const draft = draftStorage();
  const box = createElement("textarea", {
    id: "conversationInput",
    className: "composer-box",
    attrs: { rows: "2", placeholder: PLACEHOLDER, "aria-label": "Message to FluxIQ" }
  });
  box.value = draft.read();
  const sendButton = createElement("button", { id: "conversationSendButton", className: "primary-button", text: "Send", attrs: { type: "button" } });
  const notice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const element = createElement("div", { className: "composer" }, [createElement("div", { className: "composer-row" }, [box, sendButton]), notice]);
  let enabled = false;
  let sending = false;

  function submit(): void {
    if (!enabled || sending || box.value.trim() === "") return;
    void send(box.value).then((sent) => {
      if (!sent) return;
      box.value = "";
      draft.write("");
    });
  }

  sendButton.addEventListener("click", submit);
  box.addEventListener("input", () => draft.write(box.value));
  box.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submit();
  });

  return {
    element,
    render(state) {
      enabled = state.mode !== "offline" && state.mode !== "fallback";
      sending = state.sending;
      box.disabled = !enabled;
      box.placeholder = enabled ? PLACEHOLDER : OFFLINE_PLACEHOLDER;
      sendButton.disabled = !enabled || sending;
      sendButton.textContent = sending ? "Sending..." : "Send";
      notice.textContent = state.sendError ?? "";
      notice.hidden = state.sendError === undefined;
    }
  };
}
