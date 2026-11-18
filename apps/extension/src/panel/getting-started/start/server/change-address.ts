// "Change" on step one: one field, the FluxIQ web address. Saving asks that address for its discovery document first
// and keeps it only when a FluxIQ answers there, then saves it together with the connection address the document
// names. It shows what happened in words and never leaves the field looking saved when it was not.

import type { ExtensionStatus } from "../../../../shared/protocol";
import { createElement } from "../../../dom";
import type { PanelStore } from "../../../state";
import type { ReachabilityProbe } from "../../reachability";
import { saveServerAddress } from "./save-server-address";

/** The mounted form. `open` shows it filled with `current`. */
export type ChangeAddress = { readonly element: HTMLElement; open(current: string | undefined): void; close(): void };

/** What the form needs: the request seam, the probe, and the latest status (read when saving). */
export type ChangeAddressHost = { request: PanelStore["request"]; probe: ReachabilityProbe; status(): ExtensionStatus | undefined };

/** Builds the form. */
export function createChangeAddress(host: ChangeAddressHost): ChangeAddress {
  let pending = false;
  const field = createElement("input", { id: "serverAddressField", className: "start-change-field", attrs: { type: "url", autocomplete: "off", spellcheck: "false", "aria-label": "FluxIQ web address", placeholder: "http://127.0.0.1:3100" } }) as HTMLInputElement;
  const save = createElement("button", { className: "small-button", text: "Check and save", attrs: { type: "button" } });
  const cancel = createElement("button", { className: "small-button", text: "Cancel", attrs: { type: "button" } });
  const notice = createElement("p", { className: "notice", hidden: true, attrs: { role: "status" } });
  const element = createElement("div", { className: "start-change start-keep", hidden: true }, [
    createElement("label", { className: "start-change-label", text: "FluxIQ web address" }, [field]),
    createElement("div", { className: "start-actions start-keep" }, [save, cancel]),
    notice
  ]);

  function say(text: string): void {
    notice.textContent = text;
    notice.hidden = text === "";
  }

  function close(): void {
    element.hidden = true;
    say("");
  }

  async function submit(): Promise<void> {
    if (pending) return;
    let origin: string;
    try {
      const url = new URL(field.value.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new TypeError("not http");
      origin = url.origin;
    } catch {
      say("Enter FluxIQ's web address, such as http://127.0.0.1:3100.");
      return;
    }
    pending = true;
    save.disabled = true;
    say("Checking...");
    try {
      const answer = await host.probe(origin);
      if (!answer.found) {
        say(`No FluxIQ answered at ${new URL(origin).host}. Check the address and that FluxIQ is running.`);
        return;
      }
      const saved = await saveServerAddress(host.request, host.status(), origin, answer.gatewayUrl);
      if (!saved.ok) {
        say(saved.sentence);
        return;
      }
      close();
    } catch {
      say("Couldn't save the address. Try again.");
    } finally {
      pending = false;
      save.disabled = false;
    }
  }

  save.addEventListener("click", () => void submit());
  cancel.addEventListener("click", close);
  field.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") void submit();
  });

  return {
    element,
    open(current) {
      field.value = current ?? "";
      say("");
      element.hidden = false;
      field.focus();
    },
    close
  };
}
