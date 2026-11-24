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
// **Where it is found again (t1030).** A control shown chosen is kept with
// `at`, what finds it again on a later visit (`./at.ts`): its address and
// identity as the look that showed it resolved them. The press says it beside
// the option, and Core writes it onto a saved act's node as the option that
// act requires chosen, which the page checks before the act runs
// (`AS/runtime/flow-authoring/bootstrap/instructed-acts/chosen-precondition.ts`).
// A later look that shows the control chosen again refreshes it; one that
// cannot resolve it keeps the last.
//
// Held per build in this process and written through to Core's store, as every
// build memory is (`../build-state/`); a fresh opening of a round forgets it.

import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebLlmPageEvidence } from "../../sanitize";
import { createWebNodeBuildMemory, type WebNodeBuildKey, type WebNodeBuildStatePersistence, type WebNodeOpening } from "../build-state";
import { present } from "../../present";
import { webPageChoiceLines } from "./page-choices";

/** How many builds this process remembers at once, as the other build memories do. */
const REMEMBERED_BUILDS = 16;
/** How many pages one build remembers choices on; the oldest is let go first. */
const REMEMBERED_PAGES = 24;
/** How many controls one page remembers; the oldest is let go first. */
const REMEMBERED_CONTROLS = 48;
/** The most options said standing on one page, as Core reads at most sixteen. */
const MOST_SAID = 16;

/** One option standing chosen on the page a call found: its handle, its words, whether that page shows it, and what finds it again. */
export type WebStandingChoice = { handle: string; words: string; shown: boolean; at?: JsonObject };

/** What finds a control of the look being remembered again, by its handle, or nothing (`./at.ts`). */
export type WebStandingChoiceFinder = (handle: string) => JsonObject | undefined;

/** One remembered control. */
type Control = { words: string; chosen: boolean; at?: JsonObject };

export type WebNodeStandingChoices = {
  /** Read this build's choices back from Core's store when this process holds none (`../build-state/memory.ts`). */
  restore(build: WebNodeBuildKey): Promise<void>;
  /** Forget this build's choices, when this call is Core's opening of a fresh round. */
  opening(build: WebNodeBuildKey, opening: WebNodeOpening | undefined): void;
  /** A look at `page` this build took: remember what it shows chosen and not chosen, and where each shown chosen is found again. */
  seen(build: WebNodeBuildKey, page: WebLlmPageEvidence, at?: WebStandingChoiceFinder): void;
  /** The options standing chosen on `page`, those it shows first, at most sixteen. */
  standing(build: WebNodeBuildKey, page: WebLlmPageEvidence): WebStandingChoice[];
};

/** Per page location, per handle: the control's words and whether it stands chosen. Maps keep insertion order, oldest first. */
type Remembered = Map<string, Map<string, Control>>;

export function createWebNodeStandingChoices(persistence?: WebNodeBuildStatePersistence): WebNodeStandingChoices {
  const builds = createWebNodeBuildMemory<Remembered>({ name: "web.standing-choices", bound: REMEMBERED_BUILDS, encode, decode, persistence });
  return {
    restore: (build) => builds.restore(build),
    opening(build, opening) {
      if (opening === "fresh") builds.forget(build);
    },
    seen(build, page, at) {
      const lines = webPageChoiceLines(page);
      const known = builds.get(build)?.get(page.location);
      // Nothing to remember: no line shows chosen, and none this page remembers is shown.
      if (!lines.some((line) => line.chosen || known?.has(line.handle))) return;
      const remembered = builds.entry(build, () => new Map());
      const controls = remembered.get(page.location) ?? new Map<string, Control>();
      remembered.delete(page.location);
      remembered.set(page.location, controls);
      let changed = false;
      for (const line of lines) {
        const was = controls.get(line.handle);
        if (!line.chosen && was === undefined) continue;
        const found = line.chosen ? at?.(line.handle) ?? was?.at : was?.at;
        if (was?.chosen === line.chosen && was.words === line.words && sameAt(was.at, found)) continue;
        controls.delete(line.handle);
        controls.set(line.handle, present<Control>({ words: line.words, chosen: line.chosen, at: found }));
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
      const standing = [...controls].filter(([, control]) => control.chosen).map(([handle, control]) => present<WebStandingChoice>({ handle, words: control.words, shown: shown.has(handle), at: control.at }));
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

/** Whether two `at`s are the same, by their JSON. */
function sameAt(left: JsonObject | undefined, right: JsonObject | undefined): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Each page as `[location, [[handle, words, chosen, at?], ...]]`: page words already shown to the model, and what finds each control again. */
function encode(remembered: Remembered): JsonValue {
  return [...remembered].map(([location, controls]) => [location, [...controls].map(([handle, control]) => control.at ? [handle, control.words, control.chosen, control.at] : [handle, control.words, control.chosen])]);
}

function decode(stored: JsonValue): Remembered | undefined {
  if (!Array.isArray(stored)) return undefined;
  const remembered: Remembered = new Map();
  for (const page of stored) {
    if (!Array.isArray(page) || typeof page[0] !== "string" || !Array.isArray(page[1])) continue;
    const controls = new Map<string, Control>();
    for (const control of page[1]) {
      if (!Array.isArray(control) || typeof control[0] !== "string" || typeof control[1] !== "string" || typeof control[2] !== "boolean") continue;
      const at = control[3];
      controls.set(control[0], present<Control>({ words: control[1], chosen: control[2], at: isObject(at) ? at : undefined }));
    }
    remembered.set(page[0], controls);
  }
  return remembered;
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
