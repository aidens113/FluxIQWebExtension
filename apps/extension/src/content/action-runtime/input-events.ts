// The events a user's edit fires, so page scripts see a programmatic change.

export function dispatchInputEvents(element: Element): void {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
