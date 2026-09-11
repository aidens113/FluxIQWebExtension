/**
 * The recording-domain event type each recorded client event kind is stored
 * as: the vocabulary `expected.recordingEvents` is written in. It mirrors
 * `webAutomationEventTypeForClientKind` (`domain/src/io/input-model.ts`); the
 * runner does not depend on the domain package, and a test fails when the two
 * disagree.
 */
export const recordingEventTypesByKind: Readonly<Record<string, string>> = Object.freeze({
  "content.ready": "web.client.ready",
  "browser.tab": "web.tab.state_changed",
  "browser.navigation": "web.page.navigated",
  "dom.click": "web.element.clicked",
  "dom.input": "web.element.input_changed",
  "dom.change": "web.element.changed",
  "dom.submit": "web.form.submitted",
  "dom.focus": "web.element.focused",
  "dom.blur": "web.element.blurred",
  "dom.keydown": "web.keyboard.pressed",
  "dom.wheel": "web.mouse.wheel",
  "dom.scroll": "web.scroll.changed",
  "dom.mutation": "web.dom.mutated",
  "dom.snapshot": "web.snapshot.captured",
  "action.result": "web.action.executed",
});

/** A kind the domain does not know is stored as `web.client.error`, as the domain does. */
export const UNKNOWN_KIND_EVENT_TYPE = "web.client.error";

export function recordingEventTypeForKind(kind: string): string {
  return recordingEventTypesByKind[kind] ?? UNKNOWN_KIND_EVENT_TYPE;
}
