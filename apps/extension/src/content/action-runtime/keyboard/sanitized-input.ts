import { setElementValue } from "../set-element-value";
import { dispatchKeyEvent } from "./key-event";

/** Native structured fields discard partial prefixes; commit an admitted whole value. */
export function typeSanitizedInput(element: HTMLInputElement, text: string): void {
  if (element.disabled || element.readOnly) return;
  const probe = document.createElement("input");
  probe.type = element.type;
  setElementValue(probe, text);
  // Let this browser validate its native format, preserving exact caller text.
  // A malformed value must not clear or partially replace the original field.
  if (probe.value !== text) return;

  let admitted = true;
  for (const character of text) {
    if (!dispatchKeyEvent(element, "keydown", character)) admitted = false;
    dispatchKeyEvent(element, "keyup", character);
  }
  if (!admitted || element.disabled || element.readOnly) return;
  if (!element.dispatchEvent(new InputEvent("beforeinput", {
    bubbles: true, cancelable: true, composed: true, inputType: "insertReplacementText", data: text
  }))) return;
  setElementValue(element, text);
  element.dispatchEvent(new InputEvent("input", {
    bubbles: true, cancelable: false, composed: true, inputType: "insertReplacementText", data: text
  }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
