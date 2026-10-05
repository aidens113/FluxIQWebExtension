// Which layers this build opened itself, by its own press, for the life of the
// build (t193, C17).
//
// **The problem this closes.** A press inside a layer that the press then
// closed is the Flow's answer to an interruption, and Core makes such a step
// optional (`../press-effect/answered-layer.ts`). On every lane B run from
// round 1002 (`run-musp4h2f-72e8ed99`) the build pressed "Pickup or delivery?
// Carden Falls Supercenter", which opened the store chooser, then pressed "Set
// as my store" on Millbrook inside it; the page reloaded at the same location
// with the chooser gone, and the store switch was marked `interruption: true`.
// An optional store switch is passed over silently whenever its control is not
// found, and the towels go to the wrong store. A layer the Flow opened itself
// is a step of the Flow, not an interruption: an interruption is a layer that
// stood in front of the page without this build's own press opening it -- a
// consent wall, a chat card, an email offer.
//
// **What is remembered.** For each build (session, project, flow), the handle
// of every layer a press of this build opened: a layer on the look after the
// press that was not a layer on the look before it, on the same page. A layer
// is what `../layer/element.ts` says it is, or a dialog an element was captured
// inside (`inDialog`), as `../press-effect/answered-layer.ts` reads one.
//
// **Why a handle is a sound key.** A handle keeps naming the same element
// across every capture of one Flow (`../../stable-handles.ts`): it is issued per
// (project, flow), keyed by the page's location, frame, selector and record,
// and rebound by what does not move when a positional selector shifts. A
// reload at the same location -- what "Set as my store" does -- recaptures the
// same location, so the chooser opened again after it is given the handle it
// had before (`../tests/draft-control.test.ts` checks that). A layer on
// another location is another page's layer with another handle, which is
// right: it is not the layer this build opened.
//
// **A layer recognised by kind is never the build's own.** A consent wall, a
// promotion, a robot check, a rate limit or an assistant (`../../layer-marks.ts`)
// is an interruption by what it is, and such layers are the ones that open on a
// timer: bigbox's email offer can open in the instant after any press, and
// remembered as that press's own it would make its "No thanks" a required step
// that fails whenever the offer does not show.
//
// **What it does not know.** An unmarked layer that opens on a timer in the
// instant between a press and the look after it is read as opened by that press. And a
// new process continuing a Flow starts with nothing remembered, so a layer a
// held step opened is not known to be the Flow's own. Both read as an
// interruption, which is what every answered layer was before this memory.
//
// Forgotten when a build opens, as arrival is (`../arrival.ts`); a round that
// continues a Flow forgets nothing. Bounded like arrival, and for the same
// reason.

import type { WebLlmPageEvidence } from "../../sanitize";
import { webNodeOpensBuild, type WebNodeBuildKey } from "../arrival";
import { webIsLayer } from "../layer";

/** How many builds are remembered at once, as arrival remembers them. */
const REMEMBERED_BUILDS = 16;

export type WebNodeOwnLayers = {
  /** Forget the layers the last build of this flow opened, when this call opens a new one. */
  opening(build: WebNodeBuildKey, callId: string): void;
  /** A press of this build ran: remember each layer on `after` that was not one on `before`, on the same page. */
  pressed(build: WebNodeBuildKey, before: WebLlmPageEvidence | undefined, after: WebLlmPageEvidence | undefined): void;
  /** Whether the layer with handle `layer` was opened by a press of this build. */
  owns(build: WebNodeBuildKey, layer: string): boolean;
};

export function createWebNodeOwnLayers(): WebNodeOwnLayers {
  const builds = new Map<string, Set<string>>();
  const key = (build: WebNodeBuildKey): string => `${build.sessionId}\u0000${build.projectId}\u0000${build.flowId}`;
  return {
    opening(build, callId) {
      if (webNodeOpensBuild(callId)) builds.delete(key(build));
    },
    pressed(build, before, after) {
      if (before === undefined || after === undefined || before.location !== after.location) return;
      const already = layersOn(before);
      const byHandle = new Map(after.elements.map((element) => [element.target, element] as const));
      const opened = [...layersOn(after)].filter((layer) => !already.has(layer) && !recognisedByKind(byHandle.get(layer)));
      if (opened.length === 0) return;
      const slot = key(build);
      const held = builds.get(slot) ?? new Set<string>();
      for (const layer of opened) held.add(layer);
      builds.delete(slot);
      builds.set(slot, held);
      for (const oldest of builds.keys()) {
        if (builds.size <= REMEMBERED_BUILDS) break;
        builds.delete(oldest);
      }
    },
    owns: (build, layer) => builds.get(key(build))?.has(layer) === true
  };
}

/** Whether the capture recognised this layer by kind (consent, promotion, robot check, rate limit, assistant). */
function recognisedByKind(layer: WebLlmPageEvidence["elements"][number] | undefined): boolean {
  return layer !== undefined && (layer.kind !== undefined || layer.isDialog?.kind !== undefined);
}

/** The handles of every layer standing on `page`: each element that is one, and each dialog an element lies in. */
function layersOn(page: WebLlmPageEvidence): Set<string> {
  const layers = new Set<string>();
  for (const element of page.elements) {
    if (webIsLayer(element)) layers.add(element.target);
    if (element.inDialog !== undefined) layers.add(element.inDialog);
  }
  return layers;
}
