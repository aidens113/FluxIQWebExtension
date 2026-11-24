// The options that stand chosen on each page a build has looked at (t1023).
//
// **The defect this closes.** Paid run `run-mwuxd2v9-33928ea3` (bigbox) was
// asked to add an item "for pickup". Opening the store chooser showed
// `t332 clickable "Pickup" marked`; the chooser closed, and the add landed on
// the same page, where Pickup was no longer in view. Core counted a choice done
// only when a step said it made it, so it owed the pickup for 190 steps: no
// statement told it the page had that option chosen when the add ran.
//
// **What is remembered.** For each build and each page (its location), every
// control the view has shown chosen, by its handle and words, and whether it
// still stands chosen. Each look updates it: a line shown chosen stands chosen;
// a remembered control shown again without its chosen state no longer does; a
// control out of view keeps what it last showed -- a chooser closed again still
// holds what it showed. Handles name one control for the whole build
// (`../../stable-handles.ts`), so the same control is the same entry.
//
// **What is said.** `standing` answers, for the page a call found, the options
// that stand chosen there, those shown first. A press states them on its draft
// statement as `chosen` (`../run.ts`), and Core counts the person's option done
// by the act's step that ran with it standing
// (`AS/runtime/flow-authoring/bootstrap/instructed-acts/standing-option.ts`).
// The typed state is the fact; the words only name the option.
//
// Held per build in this process and written through to Core's store, as every
// build memory is (`../build-state/`); a fresh opening of a round forgets it.

import type { JsonValue } from "fluxiq/core";
import type { WebLlmPageEvidence } from "../../sanitize";
import { createWebNodeBuildMemory, type WebNodeBuildKey, type WebNodeBuildStatePersistence, type WebNodeOpening } from "../build-state";
import { webPageChoiceLines } from "./page-choices";

/** How many builds this process remembers at once, as the other build memories do. */
const REMEMBERED_BUILDS = 16;
/** How many pages one build remembers choices on; the oldest is let go first. */
const REMEMBERED_PAGES = 24;
/** How many controls one page remembers; the oldest is let go first. */
const REMEMBERED_CONTROLS = 48;
/** The most options said standing on one page, as Core reads at most sixteen. */
const MOST_SAID = 16;

/** One option standing chosen on the page a call found: its handle, its words, and whether that page shows it. */
export type WebStandingChoice = { handle: string; words: string; shown: boolean };

export type WebNodeStandingChoices = {
  /** Read this build's choices back from Core's store when this process holds none (`../build-state/memory.ts`). */
  restore(build: WebNodeBuildKey): Promise<void>;
  /** Forget this build's choices, when this call is Core's opening of a fresh round. */
  opening(build: WebNodeBuildKey, opening: WebNodeOpening | undefined): void;
  /** A look at `page` this build took: remember what it shows chosen and not chosen. */
  seen(build: WebNodeBuildKey, page: WebLlmPageEvidence): void;
  /** The options standing chosen on `page`, those it shows first, at most sixteen. */
  standing(build: WebNodeBuildKey, page: WebLlmPageEvidence): WebStandingChoice[];
};

/** Per page location, per handle: the control's words and whether it stands chosen. Maps keep insertion order, oldest first. */
type Remembered = Map<string, Map<string, { words: string; chosen: boolean }>>;

export function createWebNodeStandingChoices(persistence?: WebNodeBuildStatePersistence): WebNodeStandingChoices {
  const builds = createWebNodeBuildMemory<Remembered>({ name: "web.standing-choices", bound: REMEMBERED_BUILDS, encode, decode, persistence });
  return {
    restore: (build) => builds.restore(build),
    opening(build, opening) {
      if (opening === "fresh") builds.forget(build);
    },
    seen(build, page) {
      const lines = webPageChoiceLines(page);
      const known = builds.get(build)?.get(page.location);
      // Nothing to remember: no line shows chosen, and none this page remembers is shown.
      if (!lines.some((line) => line.chosen || known?.has(line.handle))) return;
      const remembered = builds.entry(build, () => new Map());
      const controls = remembered.get(page.location) ?? new Map<string, { words: string; chosen: boolean }>();
      remembered.delete(page.location);
      remembered.set(page.location, controls);
      let changed = false;
      for (const line of lines) {
        const was = controls.get(line.handle);
        if (!line.chosen && was === undefined) continue;
        if (was?.chosen === line.chosen && was.words === line.words) continue;
        controls.delete(line.handle);
        controls.set(line.handle, { words: line.words, chosen: line.chosen });
        changed = true;
      }
      trim(controls, REMEMBERED_CONTROLS);
      trim(remembered, REMEMBERED_PAGES);
      if (changed) builds.saved(build);
    },
    standing(build, page) {
      const controls = builds.get(build)?.get(page.location);
      if (!controls) return [];
      const shown = new Set(webPageChoiceLines(page).filter((line) => line.chosen).map((line) => line.handle));
      const standing = [...controls].filter(([, control]) => control.chosen).map(([handle, control]) => ({ handle, words: control.words, shown: shown.has(handle) }));
      // Those the page shows first, then the newest remembered.
      return [...standing.filter((each) => each.shown), ...standing.filter((each) => !each.shown).reverse()].slice(0, MOST_SAID);
    }
  };
}

/** Let the oldest entries go until at most `most` are left. */
function trim<V>(map: Map<string, V>, most: number): void {
  for (const oldest of map.keys()) {
    if (map.size <= most) break;
    map.delete(oldest);
  }
}

/** Each page as `[location, [[handle, words, chosen], ...]]`: page words already shown to the model, and nothing else. */
function encode(remembered: Remembered): JsonValue {
  return [...remembered].map(([location, controls]) => [location, [...controls].map(([handle, control]) => [handle, control.words, control.chosen])]);
}

function decode(stored: JsonValue): Remembered | undefined {
  if (!Array.isArray(stored)) return undefined;
  const remembered: Remembered = new Map();
  for (const page of stored) {
    if (!Array.isArray(page) || typeof page[0] !== "string" || !Array.isArray(page[1])) continue;
    const controls = new Map<string, { words: string; chosen: boolean }>();
    for (const control of page[1]) {
      if (Array.isArray(control) && typeof control[0] === "string" && typeof control[1] === "string" && typeof control[2] === "boolean") controls.set(control[0], { words: control[1], chosen: control[2] });
    }
    remembered.set(page[0], controls);
  }
  return remembered;
}
