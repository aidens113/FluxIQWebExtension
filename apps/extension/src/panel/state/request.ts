// One message to the background worker, answered as a PanelResult and never
// thrown.
//
// Every failure a view can meet arrives here as a sentence: a reply that says
// `ok: false`, a message this build does not handle, a rejected send, and a
// reply that is `undefined` because the service worker was torn down (audit
// defect E2, which used to surface as "Cannot read properties of undefined").

import { runtimeSendMessage } from "../../shared/browser";
import { errorSentence, EXTENSION_RESTARTED } from "../copy";
import type { PanelResult } from "./result";

/** What the background answers for a message type it does not know. */
export const UNKNOWN_MESSAGE_ERROR = "Unknown FluxIQ extension message.";

/** A message to the background worker: a `type` and its fields. */
export type PanelMessage = { type: string; [key: string]: unknown };

/** Sends `message` and answers its reply as a PanelResult. Never throws. */
export async function panelRequest<T>(message: PanelMessage): Promise<PanelResult<T>> {
  let reply: unknown;
  try {
    reply = await runtimeSendMessage<unknown>(message);
  } catch (error) {
    return { ok: false, sentence: EXTENSION_RESTARTED, detail: error instanceof Error ? error.message : String(error) };
  }
  if (reply === null || typeof reply !== "object") {
    return { ok: false, sentence: EXTENSION_RESTARTED, detail: "The extension's background worker gave no answer." };
  }
  const typed = reply as { ok?: unknown; error?: unknown };
  if (typed.ok === true) return { ok: true, value: reply as T };
  const raw = typeof typed.error === "string" ? typed.error : undefined;
  if (raw === UNKNOWN_MESSAGE_ERROR) {
    return { ok: false, sentence: "This extension doesn't support that yet.", detail: raw, unsupported: true };
  }
  return raw === undefined ? { ok: false, sentence: errorSentence("") } : { ok: false, sentence: errorSentence(raw), detail: raw };
}
