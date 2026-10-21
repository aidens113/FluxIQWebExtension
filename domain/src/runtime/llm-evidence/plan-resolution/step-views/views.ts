// Where a candidate Flow's step stands: in the dialog the steps before it
// left open, when exploration saw the press among them open one (t748 U1, U1b).
//
// The packet store (`../target-packets.ts`) keeps one page per address, as
// exploration last saw it. A site that opens an item as a dialog over its list
// and pushes the item's address has two documents at that address -- the
// dialog over the list, and the item's own page a load of the address gives --
// and the Flow-wide numbering (`../../stable-handles.ts`) can give a control of
// each one handle. Once exploration looked at the own page, that handle named
// the own page's control, and a Flow that opened the dialog and pressed it
// carried an identity with no dialog into the dialog: rerun round 4's photo
// builder, refused `web.target.ambiguous` among the dialog's controls.
//
// So this keeps, per Flow:
//
// - each dialog view: per address and set of dialogs its controls sat in, the
//   controls inside a dialog from the newest capture of it, keeping what its
//   captures agree on (the store's merge rule, handed in as `across`), or only
//   adding where a look was cut short;
// - where each press of exploration's led: the dialog view the page it left
//   showed, or none;
// and, asked about a candidate's step, folds the moves of the plan's steps
// before it -- which Core sends with the node (`precedingSteps`), each read by
// `./move.ts` -- into where that step stands: after a press, the dialog view
// exploration's press of that handle led to; after a step that only reads or
// acts in place, where the step before it stood; after anything else -- a
// navigation, a key, a node this domain does not run -- nowhere. Nothing is
// kept between questions: the steps alone say where a step stands, never the
// order the questions came in, which skips the steps Core does not ask about
// and runs one plan straight into the next (t748 U1b). No steps, nowhere.
//
// The store asks it only for a candidate's handle, and takes its control only
// where the pages name another or none (`../target-packets.ts`).

import type { WebLlmTargetView } from "../view-history";

/** Dialog views one Flow keeps; the one captured longest ago goes first. */
const RETAINED_VIEWS = 8;
/** Presses one Flow remembers the destination of; the one pressed longest ago goes first. */
const LED_PER_FLOW = 4096;

/** How a plan's step moves where the next one stands: a press of a handle, a step that leaves the page as it is, or anything else. */
export type WebLlmPlanStepMove = { press: string } | "stays" | "moves";

export type WebLlmStepViews<T> = {
  /** A capture at `location` numbered `view`, whose controls sat in `dialogs` (`""` for none); `partial` when the browser cut it short (header). */
  captured(location: string, dialogs: string, view: number, targets: ReadonlyMap<string, T>, partial: boolean): void;
  /** Exploration pressed `handle`, leaving the page at `location` whose controls sat in `dialogs` (header). */
  pressedInto(handle: string, location: string, dialogs: string): void;
  /** What `handle` names in the dialog view a step stands in after the steps whose moves are `after` -- at `location`, when one is named -- and that view; nothing where it stands in none or that view does not show it (header). */
  standing(handle: string, location: string | undefined, after: readonly WebLlmPlanStepMove[]): { target: T; shownIn: WebLlmTargetView } | undefined;
};

type DialogView<T> = { location: string; view: number; targets: Map<string, T> };

/** One Flow's dialog views, merging a handle's captures with `across`; `inDialog` says whether a target sits in a dialog. */
export function createWebLlmStepViews<T>(across: (earlier: T | undefined, target: T) => T, inDialog: (target: T) => boolean): WebLlmStepViews<T> {
  const views = new Map<string, DialogView<T>>();
  const led = new Map<string, string>();
  return {
    captured(location, dialogs, view, targets, partial) {
      if (dialogs === "") return;
      const key = viewKey(location, dialogs);
      const before = views.get(key)?.targets;
      const kept = new Map<string, T>(partial && before !== undefined ? before : []);
      for (const [handle, target] of targets) if (inDialog(target)) kept.set(handle, across(before?.get(handle), target));
      views.delete(key);
      if (kept.size > 0) views.set(key, { location, view, targets: kept });
      keepNewest(views, RETAINED_VIEWS);
    },
    pressedInto(handle, location, dialogs) {
      led.delete(handle);
      if (dialogs !== "") led.set(handle, viewKey(location, dialogs));
      keepNewest(led, LED_PER_FLOW);
    },
    standing(handle, location, after) {
      let standingIn: string | undefined;
      for (const move of after) if (move !== "stays") standingIn = move === "moves" ? undefined : led.get(move.press);
      const view = standingIn === undefined ? undefined : views.get(standingIn);
      if (view === undefined || (location !== undefined && location !== view.location)) return undefined;
      const target = view.targets.get(handle);
      return target === undefined ? undefined : { target, shownIn: { view: view.view, location: view.location } };
    }
  };
}

function viewKey(location: string, dialogs: string): string {
  return `${location}\0${dialogs}`;
}

/** Let the oldest entries of `kept` go past `bound`. */
function keepNewest<V>(kept: Map<string, V>, bound: number): void {
  for (const oldest of kept.keys()) {
    if (kept.size <= bound) break;
    kept.delete(oldest);
  }
}
