// Which layers this build opened itself, by its own act, for the life of the
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
// **What is remembered.** For each build Core names (`../build-state/`), the handle
// of every layer an act of this build opened: of the layers on the look after
// the act that were not layers on the look before it, on the same page, those
// `./opened-by.ts` says the act opened -- tied to its control, or, untied, after
// an act whose effect the page defines (a press), never after one that only set
// a value (t885: a timed card that rose as a field was typed in). A layer
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
// **Two new layers, and one stands over the other (t869).** A press opens one
// thing. Classifieds `run-mw3o6pgv-ffa1a04c`: a press opened a chooser, and a
// prompt the page raised in the same instant stood over it, covering the
// chooser's own controls. Both read as the press's, so pressing the prompt's way
// out answered nothing, its step was required, and a later run on a page that
// remembered declining stopped there. So where a new layer's own controls are
// covered by another new layer, the covered one is what the press opened, and
// what stands over it came from elsewhere (`./beneath.ts`). It reads as an
// interruption, which makes its step optional, and the run's defence may clear
// it. A dialog and the backdrop under it are not this: nothing covers the
// dialog's controls.
//
// **What it does not know.** An unmarked layer that opens on a timer in the
// instant between a press and the look after it, over nothing else new and tied
// to nothing, is read as opened by that press; and one a set value raised with
// no tie to its control is read as an interruption (`./opened-by.ts`). And a
// build Core starts anew to continue a Flow (a stopped build continued later,
// under a new build id) starts with nothing remembered, so a layer a held step
// opened is not known to be the Flow's own. Both read as an interruption,
// which is what every answered layer was before this memory.
//
// Forgotten when Core opens a fresh round, as arrival is (`../arrival.ts`); a
// round that continues a Flow forgets nothing. Bounded in this process like
// arrival, and for the same reason, and kept in Core's durable build state as
// well (`../build-state/`, t728), so a host restarted mid-build keeps it.

import type { JsonValue } from "fluxiq/core";
import type { WebLlmPageEvidence } from "../../sanitize";
import { createWebNodeBuildMemory, type WebNodeBuildKey, type WebNodeBuildStatePersistence, type WebNodeOpening } from "../build-state";
import { webIsLayer } from "../layer";
import type { WebNodeLayerAct } from "./act";
import { webLayersOpenedBy } from "./opened-by";

/** How many builds this process remembers at once, as arrival remembers them. */
const REMEMBERED_BUILDS = 16;

export type WebNodeOwnLayers = {
  /** Read this build's layers back from Core's store when this process holds none of them (`../build-state/memory.ts`). */
  restore(build: WebNodeBuildKey): Promise<void>;
  /** Forget the layers this build opened, when this call is Core's opening of a fresh round. */
  opening(build: WebNodeBuildKey, opening: WebNodeOpening | undefined): void;
  /** An act of this build on the page ran: remember each layer on `after`, not one on `before`, on the same page, that it opened (`./opened-by.ts`). */
  acted(build: WebNodeBuildKey, before: WebLlmPageEvidence | undefined, after: WebLlmPageEvidence | undefined, act: WebNodeLayerAct): void;
  /** Whether the layer with handle `layer` was opened by an act of this build. */
  owns(build: WebNodeBuildKey, layer: string): boolean;
};

export function createWebNodeOwnLayers(persistence?: WebNodeBuildStatePersistence): WebNodeOwnLayers {
  const builds = createWebNodeBuildMemory<Set<string>>({
    name: "web.own-layers",
    bound: REMEMBERED_BUILDS,
    // The layers' handles, and nothing else.
    encode: (held): JsonValue => [...held],
    decode: (stored) => (Array.isArray(stored) ? new Set(stored.filter((layer): layer is string => typeof layer === "string")) : undefined),
    persistence
  });
  return {
    restore: (build) => builds.restore(build),
    opening(build, opening) {
      if (opening === "fresh") builds.forget(build);
    },
    acted(build, before, after, act) {
      if (before === undefined || after === undefined || before.location !== after.location) return;
      const already = layersOn(before);
      const byHandle = new Map(after.elements.map((element) => [element.target, element] as const));
      const opened = webLayersOpenedBy(act, before, after, [...layersOn(after)].filter((layer) => !already.has(layer) && !recognisedByKind(byHandle.get(layer))));
      if (opened.length === 0) return;
      const held = builds.entry(build, () => new Set<string>());
      const count = held.size;
      for (const layer of opened) held.add(layer);
      if (held.size !== count) builds.saved(build);
    },
    owns: (build, layer) => builds.get(build)?.has(layer) === true
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
