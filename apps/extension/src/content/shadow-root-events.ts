// The events an open shadow root keeps to itself, heard where they happen.
//
// `change` and `submit` are not composed. Fired inside a widget's open shadow
// root they stop at that root, so the document-level listeners in
// `dom-events.ts` never heard them: on local-classifieds, choosing the radius
// in `<kf-location>` recorded no selection at all, only an arrow key aimed at
// the widget's host (t063). So every open shadow root an interaction passes
// through is given the same listeners, once, before the interaction can change
// anything inside it: a pointer press, a focus or a key arrives before the
// `change` it leads to.
//
// A closed root never appears on a composed path seen from outside it, so
// nothing inside one is heard, as nothing inside one is described anywhere else.

type RecordingListener = (event: Event) => void;

const listening = new WeakSet<ShadowRoot>();

/** Adds `listeners`, in the capture phase, to each open shadow root on the event's path that does not have them yet. */
export function listenInOpenShadowRoots(event: Event, listeners: Readonly<Record<string, RecordingListener>>): void {
  for (const entry of event.composedPath()) {
    if (!(entry instanceof ShadowRoot) || listening.has(entry)) continue;
    listening.add(entry);
    for (const [type, listener] of Object.entries(listeners)) entry.addEventListener(type, listener, true);
  }
}
