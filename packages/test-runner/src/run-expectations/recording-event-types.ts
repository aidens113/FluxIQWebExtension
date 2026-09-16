/**
 * The recording-domain event type each recorded client event kind is stored
 * as: the vocabulary `expected.recordingEvents` is written in. It mirrors
 * `webAutomationEventTypeForClientKind` (`domain/src/io/input-model.ts`), and
 * a test fails when the two disagree -- by reading the domain's source, so the
 * mirror drifts silently until that test is next run. It drifted exactly that
 * way once: X4.1 added `data.extract` to the domain and this table kept its
 * old shape.
 *
 * The runner *can* import the domain (`@fluxiq-web-extension/domain/node` is a
 * dependency, and `run-evaluation/evidence-budget-invariant.ts` derives from it
 * already), so this table is a hand-copy by habit rather than by necessity.
 * Whether to delegate to the domain function instead is the supervisor's call.
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
  "data.extract": "web.data.extraction_defined",
  "action.result": "web.action.executed",
});

/** A kind the domain does not know is stored as `web.client.error`, as the domain does. */
export const UNKNOWN_KIND_EVENT_TYPE = "web.client.error";

export function recordingEventTypeForKind(kind: string): string {
  return recordingEventTypesByKind[kind] ?? UNKNOWN_KIND_EVENT_TYPE;
}
