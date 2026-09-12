// The page-world half of dialog control: `alert`, `confirm`, and `prompt`
// replaced in the page's own JavaScript world.
//
// It has to run here, and at `document_start`, for two reasons. A native dialog
// blocks the page's script while it is open, so an isolated content script
// cannot answer one after the fact -- by then nothing else runs. And a page
// that captures `window.confirm` into a local before we do would keep calling
// the original, so the replacement has to be in place before any page script.
//
// Unarmed dialogs are left alone: the original is called and the page behaves
// exactly as it would without the extension, and what the user answered is
// recorded as evidence. Only an armed dialog is answered without opening, which
// is what makes `web.dom.dialog` an explicit automation step rather than a
// standing change to the page.

import {
  DIALOG_ARM_ATTRIBUTE,
  DIALOG_ARM_EVENT,
  DIALOG_OBSERVED_ATTRIBUTE,
  decodeDialogArm,
  encodeDialogObserved,
  type DialogArm,
  type DialogKind,
  type DialogResponse
} from "../shared/dialog-channel";

type OverrideHost = Window & { __fluxiqDialogOverrideInstalled?: boolean };

/**
 * Installs the override in this window, and reports whether it did.
 *
 * False means this bundle is running somewhere it cannot help: in an
 * extension's isolated world, where replacing `window.confirm` changes nothing
 * the page sees. The isolated half detects that through the handshake -- an
 * unacknowledged arming -- and the verb reports the capability as missing
 * rather than arming a dialog that will never be answered.
 */
export function installDialogOverride(): boolean {
  if (inExtensionWorld()) return false;
  const host = window as OverrideHost;
  if (host.__fluxiqDialogOverrideInstalled === true) return true;
  host.__fluxiqDialogOverrideInstalled = true;

  let armed: DialogArm | undefined;

  // Removing the attribute is the acknowledgement the isolated half reads back
  // on this same call stack, so the handshake needs no reply message.
  document.addEventListener(DIALOG_ARM_EVENT, () => {
    const root = document.documentElement;
    const raw = root?.getAttribute(DIALOG_ARM_ATTRIBUTE);
    if (!root || raw === null || raw === undefined) return;
    root.removeAttribute(DIALOG_ARM_ATTRIBUTE);
    armed = decodeDialogArm(raw);
  });

  /** An arming answers one dialog: `web.dom.dialog` arms the next response, not every later one. */
  const takeArmed = (): DialogArm | undefined => {
    const next = armed;
    armed = undefined;
    return next;
  };

  const record = (kind: DialogKind, message: string, response: DialogResponse, promptText?: string): void => {
    const root = document.documentElement;
    if (!root) return;
    try {
      root.setAttribute(DIALOG_OBSERVED_ATTRIBUTE, encodeDialogObserved({
        kind,
        message,
        response,
        at: Date.now(),
        ...(promptText === undefined ? {} : { promptText })
      }));
    } catch {
      // Recording evidence must never break the page's own dialog.
    }
  };

  const nativeAlert = window.alert;
  const nativeConfirm = window.confirm;
  const nativePrompt = window.prompt;

  window.alert = (message?: unknown): void => {
    const text = asText(message);
    const arm = takeArmed();
    if (!arm) nativeAlert.call(window, text);
    record("alert", text, arm?.response ?? "accept");
  };

  window.confirm = (message?: unknown): boolean => {
    const text = asText(message);
    const arm = takeArmed();
    const accepted = arm ? arm.response === "accept" : nativeConfirm.call(window, text);
    record("confirm", text, accepted ? "accept" : "dismiss");
    return accepted;
  };

  window.prompt = (message?: unknown, defaultValue?: unknown): string | null => {
    const text = asText(message);
    const fallback = defaultValue === undefined ? undefined : asText(defaultValue);
    const arm = takeArmed();
    if (!arm) {
      const answer = nativePrompt.call(window, text, fallback);
      record("prompt", text, answer === null ? "dismiss" : "accept", answer ?? undefined);
      return answer;
    }
    if (arm.response === "dismiss") {
      record("prompt", text, "dismiss");
      return null;
    }
    const answer = arm.promptText ?? fallback ?? "";
    record("prompt", text, "accept", answer);
    return answer;
  };

  return true;
}

/**
 * Whether this bundle landed in an extension's isolated world instead of the
 * page's. A content script there can reach `chrome.runtime.id`; a script in the
 * page world cannot, because a page has no extension API. It matters because
 * `world: "MAIN"` is honoured only from Chrome 111 and Firefox 128: on an older
 * browser the entry is ignored and this script runs isolated, where the
 * override would be installed on a `window` no page script ever sees.
 */
function inExtensionWorld(): boolean {
  const runtime = (globalThis as unknown as { chrome?: { runtime?: { id?: string } } }).chrome?.runtime;
  return typeof runtime?.id === "string";
}

function asText(value: unknown): string {
  return value === undefined ? "" : String(value);
}
