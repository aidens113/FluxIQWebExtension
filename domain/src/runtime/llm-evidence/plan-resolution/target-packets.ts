// The target handles one Flow's authoring was shown, remembered per page, so a
// plan that names `tN` can be given the selector behind it. A handle written
// the old way, `target.N`, is looked up as the `tN` it means.
//
// This keeps, for each project and Flow, the newest packet the model was shown
// for each page it visited -- a recapture of a page replaces that page's
// handles, as it replaced them in front of the model -- and a handle is
// resolved against those pages:
//
// - named with the page's `location`, against that page alone;
// - named bare, against every remembered page, and only when they all agree
//   on what it names. Two pages that give one handle different selectors make
//   a bare handle `ambiguous`, never a guess at the newer one.
//
// The authoring tools number handles for the whole Flow (`../stable-handles.ts`),
// so two pages they show never give one handle to different controls, and a
// bare handle -- the way the Flow script format writes a step's target --
// resolves. They used to number every page from `t1`, and a bare handle
// was then ambiguous as soon as the exploration had seen two pages: 6 of E1
// lane B's 12 builds on the realistic stores. The rule above stays, for a
// packet numbered any other way and for a Flow whose numbers had to start
// again.
//
// A selector the page gave to more than one described element -- every product
// card's link can share one -- names none of them in particular, so resolving
// it would act on whichever the page lists first. Such a handle resolves as
// `not_unique`, as reveal refuses the same selector before it clicks.
//
// Each handle also keeps who its element is (`element-identity.ts`), which the
// resolved node carries as `parameters.element`. Pages that agree on a bare
// handle's selector but describe its element differently still resolve, since
// they name one address, but with only the identity fields they agree on.
// Beside it, never in it, rides the words a person reads for that element
// (`words`, `element-identity.ts` `webPlanElementWords`): the identity's name
// as the packet printed it, where the captured text ran a control's lines
// together. Only a resolution whose words differ from the identity's name
// carries them, and pages that disagree on them give none.
//
// A handle's element in a child frame also keeps the path of the document the
// frame held when it was shown (`frameUrlPath`, `frame-url-path.ts`). Pages that
// agree on a bare handle keep the newest path any of them gave.
//
// A look the model is not shown -- the one a node run takes before it acts --
// is remembered too, and when it was cut short it is only added: its handles
// join the page's and none the page already had is forgotten. A look describes
// forty controls, and one taken after a notice appeared above the results
// sidebar ended before the "Voltbay" filter the packet just shown had ended on.
// Remembered as the page's packet, it forgot that filter's handle, and four
// presses on it were refused `handle_not_in_packet`, two straight after a
// packet that showed it (`run-muohbi3e-e5847e5a`). Handles are numbered for the
// whole Flow, so a handle kept this way still names the one control it was
// given for. A look that described the whole page replaces, as a shown packet
// does: a control missing from it has left the page.
//
// A rerun puts its page back by reloading it, and a reload can address the
// page's controls differently, so the authoring tools may number them anew
// (`../stable-handles.ts` re-matches what it can). Live, 7-in-1 was `t985` on
// one load and `t1194` on the next, and a rerun sent with the handle read before
// the reload was refused `handle_not_in_packet`, twice, with nothing saying the
// page had been reloaded (`run-musq0b1m-0472cfa0`, Cause 4). So a view that
// replaces a page's handles and arrived by reload (`navigation.type`, the
// browser's own record of how the document was reached) marks each handle it
// dropped whose control it still shows under another handle: tag and words the
// same. Such a handle still resolves to nothing, and says it was renumbered by
// a reload (`renumberedByReload`). A handle shown again loses its mark; a
// control that left the page, or a drop with no reload, is never marked.
//
// **Only the first view of a new document marks (t741, C2).** `navigation.type`
// stays `reload` for the document's whole life, so every later view of a page
// once reloaded counted as a reload: a "Read more" exploration pressed expanded
// its review and left the page while another "Read more" still showed, and the
// pressed handle was marked and refused before the view history and its acted
// identity could name it (social round 3, 0137-0165, no reload made). So a view
// marks only when its document (`navigation.timeOrigin`, one value per
// document) differs from the one the page's previous whole view showed, kept per
// page beside the marks (`documents`). Where either view lacks it, any reload
// view marks, as before.
//
// **A re-viewed handle keeps only what its views agree on (t356, C1).** A newer
// view of a page replaces its handles, and used to replace each handle's
// identity with the newest one: after exploration pressed "Get coupons" the page
// relabelled it "Collected", and the candidate script bound `t925` to
// "Collected", which the trial's freshly reset page never shows
// (`run-muyrpbnk-fef374e7`, 0032 `web.target.not_found`). Now a handle the newer
// view shows as the same control keeps the identity both views agree on
// (`element-identity.ts` `webPlanElementIdentityAcrossViews`): a label the act
// changed is dropped, never adopted. A handle the newer view no longer shows
// still leaves the page with it, as above.
//
// **A control exploration acted on is saved as the act found it (t442, F1).**
// The agreement above serves exploration, which acts on the page as it now is.
// Saved into a Flow it left R4a's and R4b's coupon step as `{div, class b}`:
// "Get coupons" before the press, "Collected" after it, so no words survived,
// and a wordless identity matches the done control as well as the undone one
// (`r4b-coupon-step-identity.md`). So each handle exploration acted on also
// keeps the identity its control had in the view the act was made from
// (`acted`, from `../node-run/run.ts`; the first act's, since a Flow meets the
// control as exploration first did). A candidate submission (`view_history`)
// saves that identity in full; what the act changed -- the new words, the class
// it toggled -- is the step's effect, never who the control is. Exploration's
// own acts keep the agreed identity, so nothing it presses on the page as it
// now is is vetoed for words the act took away. Only while the handle still
// names the address it was acted on at; a handle nothing acted on keeps the
// agreed identity everywhere.
//
// **What that act made true is the step's effect (t447, F2).** The act that
// fixes the identity also fixes the effect: `acted` is handed the page the act
// left as well, and keeps what the act added to it beside the identity
// (`act-effect.ts`, the route-state effect a Flow node keeps). A candidate's
// resolution carries it (`effect`), only where it carries the acted identity,
// so the step a Flow saves for the act says both who its control was and what
// pressing it did; Core writes the effect onto the node's
// `routeSignatures.effect`, and a run that finds the effect already on the
// page passes the step over as done rather than failing it. An effect only
// ever skips a step: Core never runs an act again because of one.
//
// **What the page changes by itself is no act's effect (t496).** Each Flow also
// keeps what its pages were seen changing with nothing done to them -- a banner
// that turns on its own -- from every capture it is handed (`remember`,
// `rememberLook`) and the node run's word that something is about to be done to
// the page (`acting`), and `acted` leaves those names out of the effect it
// keeps (`self-changing/`).
//
// **A candidate submission may name a control from any view (t358).** The
// store also keeps each Flow's view history (`view-history.ts`): every handle
// any capture carried, as its views agree it is (`acrossView`). Only a caller
// that asks (`resolve`'s `reach`, `view_history`: a candidate submission)
// reaches it, and only for a handle the current pages call `unknown` or
// `stale` without a reload's renumbering; exploration's own acts keep the
// current pages alone, since a control that left the page is not there to
// press. Under `view_history` a resolution says which view it came from
// (`shownIn`), where a capture is on record.
//
// **A candidate's step stands where the step before it left the page (t748
// U1).** A site can open an item as a dialog over its list and push the item's
// address, while a load of that address gives the item's own page, and one
// Flow handle can name a control of each. The store keeps one page per
// address, so once exploration looked at the own page the handle named the own
// page's control, and a Flow that opened the dialog and pressed it took an
// identity with no dialog into the dialog (rerun round 4, photo builder,
// `web.target.ambiguous`). So each Flow also keeps its dialog views and where
// each press of exploration's led (`step-views/`). Core sends a candidate's
// node the plan's steps before it (`precedingSteps`), which
// `resolve-plan-node.ts` reads into how each moves the page and hands to
// `resolve` (`after`); a candidate's handle that the dialog those steps left
// open shows, in a dialog, names that control where the pages name another or
// none -- with that view as `shownIn` and, through `acted` below, as
// exploration's press there found it. Nothing is kept between resolutions: the
// steps alone say where a step stands, never the order Core asked in (t748
// U1b). Everything else resolves as before: a step after a navigation, and one
// Core sent no steps, names the own page's control, as that page showed it.
//
// t743 d5 kept the two documents as two views of the page and the acted identity
// per address instead. The first act at the own page's address was then the
// press that undid the dialog's act, made from the state the build had left, and
// a Flow saving the own page's control saved the words that undo found
// ("Unlike"): the acted identity below stays the handle's first act's, lent only
// at the address that act named.
//
// **A candidate names only what evidence printed (t378, lane B C4).** A capture
// holds every element, and the page view prints only those with words or a
// control; the rest keep their handles in the numbering gaps. Lane B's
// candidate named `t551`, `t560` and `t570`, between a printed `t550` and
// `t555` (`run-mv0fu9pb-57454dc4`, 0058), and each resolved through the view
// history to a search-page card wrapper the model was never shown. So each Flow
// also keeps the handles evidence printed (`printed-handles.ts`): the lines of
// every capture's page view -- a look's too, since a node run's answer can name
// the controls of the look it took -- a failure packet's repair candidates, and
// every tool result the model read (`printed`, fed by `../tools.ts` where each
// answer leaves the runtime): a search's matches, a description, a node run's
// answer, and a detection's columns, whose `at` names an element the page view
// may have left out for having no words (W13). Under `view_history` a handle
// none of them printed is `not_shown`, whatever the store holds for it (the
// resolver refuses it as `web.handle.unknown`); exploration's own acts are not
// held to it.
//
// **Each target says whether a press acts on it (t378, lane D).** A plain text
// line is not a control, and a press on one -- lane D's `t860`, a chat message
// printed under the chat's "Close chat" button -- presses words
// (`pressable-targets.ts`). Such a resolution is marked `notAControl`, and
// the resolver refuses a candidate's press on it; pages that disagree make it
// pressable. So does a press exploration ran on it that changed the page
// (`pressed`, from `../node-run/run.ts`, W13): a listener the capture cannot
// see makes words a control that prints as text, and the model may press
// anything a person could, so a press shown to work is never refused for its
// looks. A press that changed nothing proves nothing, and lane D's message
// pressed so stays refused.
//
// **A step types into a field (t486).** A plain text line holds no typed
// text, and round 12 build 1 typed into one (`run-mv62icw0-2be384b4`, `t932
// "1"`). So each target also says, where it is not a field, what it is
// (`typing-targets.ts`), and a resolution of one is marked `notAField` with
// that word; the resolver refuses a candidate's type step on it. Pages that
// disagree make it a field.
//
// **An act names a control on the page it acts on (t486).** Round 12 build 1
// (0035/0036) pressed `t667`, shown on the towels page, from the napkins page:
// resolved bare against every page, it found the towels control and the
// extension hunted for it on the napkins page through four attempts. A caller
// that acts on one page asks `resolveOn` with that page's location: a handle
// that page holds resolves there, one only another remembered page holds is
// `stale` (the node run answers it with the page it captured, t477), and one no
// page holds is what a bare handle would be. A page the store does not hold, or
// whose newest view was a look the browser cut short (`partial`), cannot say
// what it lacks, and the handle resolves bare, as before. So does a handle a
// page at the same path holds under another query or fragment: that is the
// same document in another state -- a variant chosen, a filter applied -- and
// a rerun that put the product page back without `?variant=` still pressed the
// size chip the variant page showed (U-B3-3, `run-mux6pndp-16feb842`).
//
// **Each target keeps where its control sits, as its view showed it (t751 G).**
// A step of a Flow is put to Core's gate with the same opaque spot tokens an
// exploration press declares (`../control-spot/` `webTargetSpot`), so Core can
// admit it by the rule it holds a press to. A resolution carries the tokens
// (`spot`) of the view the handle resolved from -- the newest view, the one
// `shownIn` names; a dialog view's for a step standing in that dialog; and, for
// a handle exploration acted on, the view its saved control is taken from.
//
// Bounded twice: a Flow keeps its newest `RETAINED_PAGES_PER_FLOW` pages, and
// the store keeps its newest `RETAINED_FLOWS` Flows. A page let go makes its
// handles `stale` for that Flow; another Flow's handles are `unknown`, as they
// are for the extraction handles (`structure/handles.ts`). The view history
// has bounds of its own (`view-history.ts`).

import type { JsonObject } from "fluxiq/core";
import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import { present } from "../present";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { webPlanElementIdentity, webPlanElementIdentityAcrossViews, webPlanElementWords, type WebPlanElementIdentity } from "./element-identity";
import { webLlmPageText } from "../page-view";
import { webResetCollections, webTargetSpot } from "../control-spot";
import { webPlanActEffect } from "./act-effect";
import { createWebLlmSelfChangingNames, type WebLlmSelfChangingNames } from "./self-changing";
import { webLlmFrameUrlPath } from "./frame-url-path";
import { webLlmPressableTargets } from "./pressable-targets";
import { webLlmPrintedTargetHandles } from "./printed-handles";
import { webLlmNotAFieldTargets, type WebLlmNotAFieldKind } from "./typing-targets";
import { createWebLlmStepViews, type WebLlmPlanStepMove, type WebLlmStepViews } from "./step-views";
import { createWebLlmViewHistory, type WebLlmTargetView, type WebLlmViewHistory } from "./view-history";

const RETAINED_PAGES_PER_FLOW = 8;
const RETAINED_FLOWS = 32;
/** Let-go pages remembered per Flow, by location only, so a handle on one reads as stale rather than unknown. */
const REMEMBERED_STALE_PAGES = 64;
/** Handles one Flow remembers being printed; the one printed longest ago goes first. Above the view history's own bound. */
const PRINTED_PER_FLOW = 16_384;
/** Handles one Flow remembers a press changing the page for; the one pressed longest ago goes first. */
const PRESSED_PER_FLOW = 4096;
/** Handles one Flow remembers the acted-on identity of; the one acted on longest ago goes first. */
const ACTED_PER_FLOW = 4096;

/** Where a control sits, as the opaque tokens of Core's action declaration (`../control-spot/`). */
type WebLlmTargetSpot = ReturnType<typeof webTargetSpot>;

export type WebLlmTargetScope = { projectId: string; flowId: string };

/**
 * Which views a handle may resolve from (header): absent, the pages as this
 * Flow's exploration last saw them; `view_history`, any view it took, which is
 * for a candidate submission alone.
 */
export type WebLlmTargetReach = "view_history";

export type WebLlmTargetResolution =
  | {
      ok: true;
      selector: string;
      frameId: number | undefined;
      frameUrlPath?: string;
      element: WebPlanElementIdentity;
      /** The words a person reads for the element, when they differ from its identity's name by spacing alone (header). Display only. */
      words?: string;
      /** Under `view_history` only: the newest view that carried the handle (on the page named, when one was). */
      shownIn?: WebLlmTargetView;
      /** The element is no control a press acts on: plain text, a heading (header). */
      notAControl?: true;
      /** Under `view_history`, beside the acted identity only: what exploration's act on it made true (header, t447). */
      effect?: JsonObject;
      /** The element holds no typed text, and is this (header, t486). */
      notAField?: WebLlmNotAFieldKind;
      /** Where the control sits on the view it resolved from, as opaque tokens; absent where it sits nowhere a token names (header, t751 G). */
      spot?: WebLlmTargetSpot;
    }
  /** `not_shown`: under `view_history`, a handle the store holds that no evidence printed (header). */
  | { ok: false; code: "unknown" | "stale" | "ambiguous" | "not_unique" | "not_shown"; renumberedByReload?: true };

export type WebLlmTargetPackets = {
  /** Remember a packet the model was just shown, as the newest view of its page. */
  remember(scope: WebLlmTargetScope, binding: WebLlmSnapshotBinding): void;
  /** Remember a look the model was not shown: as `remember` when it describes the whole page, else its handles only join the page's. */
  rememberLook(scope: WebLlmTargetScope, binding: WebLlmSnapshotBinding): void;
  /**
   * A tool's result the model read: each handle it printed at the start of a
   * line -- a page line, a search match, a description, a detection's `at`, an
   * answer's handle field -- that a capture of this Flow held is printed
   * (header). A handle `echoed` names -- a refused call's own input, which a
   * refusal hands back as the handle it could not use -- is not printed by it.
   */
  printed(scope: WebLlmTargetScope, result: unknown, echoed?: unknown): void;
  /** Exploration pressed `handle` and the page changed: a press acts on it, whatever its element prints as (header). */
  pressed(scope: WebLlmTargetScope, handle: string): void;
  /** Exploration acted on `handle` from the page `before` showed, leaving the page `after` shows: a candidate's step saves its control as it was there, and what the act made true (header). */
  acted(scope: WebLlmTargetScope, handle: string, before: WebLlmSnapshotBinding, after?: WebLlmSnapshotBinding): void;
  /** Something is about to be done to the page this Flow's build stands on, or Core is running the draft again: the newest capture no longer says how the page stands (header, t496). */
  acting(scope: WebLlmTargetScope): void;
  /** `after`: under `view_history`, how each of a candidate's steps before this one moves the page, so the step stands where they leave it (header, t748 U1b). */
  resolve(scope: WebLlmTargetScope, handle: string, location: string | undefined, reach?: WebLlmTargetReach, after?: readonly WebLlmPlanStepMove[]): WebLlmTargetResolution;
  /** A bare handle for an act on the page at `page`: that page's, `stale` when only another page holds it (header, t486). */
  resolveOn(scope: WebLlmTargetScope, handle: string, page: string): WebLlmTargetResolution;
};

type PageTarget = {
  selector: string; frameId: number | undefined; frameUrlPath: string | undefined; element: WebPlanElementIdentity; words: string | undefined; shared: boolean; pressable: boolean;
  /** What the element is, where a type step has nowhere to type into it (header). */
  notAField: WebLlmNotAFieldKind | undefined;
  /** Where its control sits on this view (header, t751 G). */
  spot: WebLlmTargetSpot;
};
type PageTargets = Map<string, PageTarget>;
/**
 * `renumbered`: per page, the handles a reload dropped while showing their
 * control under another (see the header). `history`: every handle any capture
 * carried (header). `printed`: every handle evidence printed (header). `pressed`: every handle
 * a press of exploration's changed the page for (header). `acted`: each handle exploration acted
 * on, as the view the first act was made from showed it, with what that act made true (header). `partial`: the pages
 * whose newest view was a look the browser cut short (header). `selfChanging`: what its pages were seen changing by
 * themselves (header, t496). `steps`: its dialog views and where its presses led (header, t748 U1).
 */
type FlowPages = {
  pages: Map<string, PageTargets>; letGo: Set<string>; renumbered: Map<string, Set<string>>;
  /** Per page, the document (`navigation.timeOrigin`) its newest whole view showed, where it said (header, t741 C2). */
  documents: Map<string, number>; history: WebLlmViewHistory<PageTarget>;
  printed: Set<string>; pressed: Set<string>; acted: Map<string, ActedTarget>; partial: Set<string>; selfChanging: WebLlmSelfChangingNames;
  steps: WebLlmStepViews<PageTarget>;
};
/** A control as the first act on it found it, and what that act made true when it added anything (`act-effect.ts`). */
type ActedTarget = PageTarget & { effect: JsonObject | undefined };

export function createWebLlmTargetPackets(): WebLlmTargetPackets {
  const flows = new Map<string, FlowPages>();
  /** The Flow's pages, made the newest Flow remembered. */
  const flowOf = (scope: WebLlmTargetScope): FlowPages => {
    const key = scopeKey(scope);
    const flow = flows.get(key) ?? {
      pages: new Map<string, PageTargets>(),
      letGo: new Set<string>(),
      renumbered: new Map<string, Set<string>>(),
      documents: new Map<string, number>(),
      history: createWebLlmViewHistory(acrossView),
      printed: new Set<string>(),
      pressed: new Set<string>(),
      acted: new Map<string, ActedTarget>(),
      partial: new Set<string>(),
      selfChanging: createWebLlmSelfChangingNames(),
      steps: createWebLlmStepViews(acrossView, (target: PageTarget) => target.element.context?.dialog !== undefined)
    };
    flows.delete(key);
    flows.set(key, flow);
    for (const oldest of flows.keys()) {
      if (flows.size <= RETAINED_FLOWS) break;
      flows.delete(oldest);
    }
    return flow;
  };
  return {
    remember(scope, binding) {
      const flow = flowOf(scope);
      const targets = targetsOf(binding);
      flow.selfChanging.captured(binding);
      flow.steps.captured(binding.evidence.location, dialogsOf(binding), flow.history.record(binding.evidence.location, targets), targets, false);
      printedBy(flow, binding);
      markRenumbered(flow, binding, targets);
      keep(flow, binding.evidence.location, acrossViews(flow.pages.get(binding.evidence.location), targets));
      flow.partial.delete(binding.evidence.location);
    },
    rememberLook(scope, binding) {
      const flow = flowOf(scope);
      const location = binding.evidence.location;
      const seen = targetsOf(binding);
      flow.selfChanging.captured(binding);
      flow.steps.captured(location, dialogsOf(binding), flow.history.record(location, seen), seen, binding.evidence.truncated === true);
      printedBy(flow, binding);
      // A look that described every control says which have gone, as a shown
      // packet does; one the browser's capture cut short (`captureTruncated`)
      // cannot, so it only adds. Since t200 nothing else cuts a look.
      const before = flow.pages.get(location);
      if (!binding.evidence.truncated) {
        markRenumbered(flow, binding, seen);
        keep(flow, location, acrossViews(before, seen));
        flow.partial.delete(location);
        return;
      }
      const targets = new Map(before ?? []);
      for (const [handle, target] of acrossViews(before, seen)) targets.set(handle, target);
      keep(flow, location, targets);
      flow.partial.add(location);
    },
    printed(scope, result, echoed) {
      // Only a Flow with captures holds a handle to have printed.
      const flow = flows.get(scopeKey(scope));
      if (flow === undefined) return;
      const held = { has: (handle: string): boolean => flow.history.find(handle, undefined) !== undefined };
      const echo = webLlmPrintedTargetHandles(echoed, held, "anywhere");
      keepNewest(flow.printed, [...webLlmPrintedTargetHandles(result, held, "line_start")].filter((handle) => !echo.has(handle)), PRINTED_PER_FLOW);
    },
    pressed(scope, written) {
      const handle = canonicalWebLlmTargetHandle(written);
      const flow = flows.get(scopeKey(scope));
      if (flow === undefined || handle === undefined || flow.history.find(handle, undefined) === undefined) return;
      keepNewest(flow.pressed, [handle], PRESSED_PER_FLOW);
    },
    acted(scope, written, before, after) {
      const handle = canonicalWebLlmTargetHandle(written);
      const flow = flows.get(scopeKey(scope));
      if (flow === undefined || handle === undefined) return;
      // Where every press led (header, t748 U1); nowhere known when nothing was captured after it.
      flow.steps.pressedInto(handle, after?.evidence.location ?? "", after === undefined ? "" : dialogsOf(after));
      // The first act's view only (header); a look the capture cut short before the control says nothing of it.
      if (flow.acted.has(handle)) return;
      const target = targetsOf(before).get(handle);
      if (target === undefined || target.shared) return;
      flow.acted.set(handle, { ...target, effect: webPlanActEffect(before, after, flow.selfChanging.of(before.evidence.location)) });
      for (const oldest of flow.acted.keys()) {
        if (flow.acted.size <= ACTED_PER_FLOW) break;
        flow.acted.delete(oldest);
      }
    },
    acting(scope) {
      flows.get(scopeKey(scope))?.selfChanging.acting();
    },
    resolve(scope, written, location, reach, after) {
      const handle = canonicalWebLlmTargetHandle(written) ?? written;
      const flow = flows.get(scopeKey(scope));
      if (!flow) return { ok: false, code: "unknown" };
      const current = resolveCurrent(flow, handle, location);
      if (reach !== "view_history") return pressedBefore(flow, handle, current);
      const standing = after === undefined ? current : inStandingView(flow, handle, location, after, current);
      const reached = resolveFromHistory(flow, handle, location, standing);
      // A candidate names only what evidence printed, and saves a control acted on as the act found it (header).
      return reached.ok && !flow.printed.has(handle) ? { ok: false, code: "not_shown" } : actedAs(flow, handle, pressedBefore(flow, handle, reached));
    },
    resolveOn(scope, written, page) {
      const handle = canonicalWebLlmTargetHandle(written) ?? written;
      const flow = flows.get(scopeKey(scope));
      if (!flow) return { ok: false, code: "unknown" };
      return pressedBefore(flow, handle, resolveOnPage(flow, handle, page));
    }
  };
}

/** A handle under `view_history`: as the current pages resolve it, or else as the views that carried it agreed (header). */
function resolveFromHistory(flow: FlowPages, handle: string, location: string | undefined, current: WebLlmTargetResolution): WebLlmTargetResolution {
  // What its views agreed it names, as the newest view that carried it --
  // on the page named, when one was -- left it.
  const found = flow.history.find(handle, location);
  if (current.ok || found === undefined) {
    if (current.ok && found !== undefined) current.shownIn ??= found.shownIn;
    return current;
  }
  // A reload that renumbered the handle shows its control under another
  // one now; `ambiguous` and `not_unique` name no one control (header).
  if ((current.code !== "unknown" && current.code !== "stale") || current.renumberedByReload === true) return current;
  if (found.target.shared) return { ok: false, code: "not_unique" };
  const earlier = resolved(found.target);
  earlier.shownIn = found.shownIn;
  return earlier;
}

/**
 * `current`, or the control in a dialog that the dialog view the candidate's
 * steps before it (`after`) left open shows under `handle`, where the pages
 * name another or none (header, t748 U1, U1b).
 */
function inStandingView(flow: FlowPages, handle: string, location: string | undefined, after: readonly WebLlmPlanStepMove[], current: WebLlmTargetResolution): WebLlmTargetResolution {
  const standing = flow.steps.standing(handle, location, after);
  if (standing === undefined || standing.target.shared || (current.ok && addressOf(current) === addressOf(standing.target))) return current;
  const resolution = resolved(standing.target);
  resolution.shownIn = standing.shownIn;
  return resolution;
}

/** The dialogs a capture's controls sat in, as one string; empty where none did. */
function dialogsOf(binding: WebLlmSnapshotBinding): string {
  return [...new Set(binding.dialogNames?.values() ?? [])].sort().join("\u001f");
}

/**
 * Keep the handles `binding`'s evidence printed (header): the lines of its page
 * view and its repair candidates. What a tool printed of it arrives with the
 * tool's result (`printed`).
 */
function printedBy(flow: FlowPages, binding: WebLlmSnapshotBinding): void {
  const held = binding.selectors;
  keepNewest(flow.printed, [
    ...webLlmPrintedTargetHandles(webLlmPageText(binding.evidence), held, "line_start"),
    ...webLlmPrintedTargetHandles(binding.evidence.repairCandidates, held, "anywhere")
  ], PRINTED_PER_FLOW);
}

/** `handles` made the newest of `kept`, letting the oldest go past `bound`. */
function keepNewest(kept: Set<string>, handles: Iterable<string>, bound: number): void {
  for (const handle of handles) {
    kept.delete(handle);
    kept.add(handle);
  }
  for (const oldest of kept) {
    if (kept.size <= bound) break;
    kept.delete(oldest);
  }
}

/** `resolution`, no longer marked `notAControl` when a press of exploration's on `handle` changed the page (header). */
function pressedBefore(flow: FlowPages, handle: string, resolution: WebLlmTargetResolution): WebLlmTargetResolution {
  if (resolution.ok && resolution.notAControl === true && flow.pressed.has(handle)) delete resolution.notAControl;
  return resolution;
}

/**
 * `resolution` with the identity, and the words, its control had where
 * exploration first acted on `handle`, and what that act made true (header):
 * only while it names that same address, since another element under the
 * handle is not the control acted on.
 */
function actedAs(flow: FlowPages, handle: string, resolution: WebLlmTargetResolution): WebLlmTargetResolution {
  const acted = flow.acted.get(handle);
  if (!resolution.ok || acted === undefined || addressOf(acted) !== addressOf(resolution)) return resolution;
  resolution.element = structuredClone(acted.element);
  if (acted.words === undefined) delete resolution.words;
  else resolution.words = acted.words;
  if (acted.effect !== undefined) resolution.effect = structuredClone(acted.effect);
  if (Object.keys(acted.spot).length === 0) delete resolution.spot;
  else resolution.spot = { ...acted.spot };
  return resolution;
}

/** A handle against the pages as this Flow's exploration last saw them (header). */
function resolveCurrent(flow: FlowPages, handle: string, location: string | undefined): WebLlmTargetResolution {
  if (location !== undefined) {
    const page = flow.pages.get(location);
    if (!page) return { ok: false, code: flow.letGo.has(location) ? "stale" : "unknown" };
    const target = page.get(handle);
    if (target === undefined) return missing("unknown", flow.renumbered.get(location)?.has(handle) === true);
    return target.shared ? { ok: false, code: "not_unique" } : resolved(target);
  }
  const seen = new Map<string, PageTarget>();
  for (const page of flow.pages.values()) {
    const target = page.get(handle);
    if (target === undefined) continue;
    const address = addressOf(target);
    const known = seen.get(address);
    // One page sharing the selector makes the handle not unique wherever
    // else it agrees, and the identity is only what every page said. A new
    // record, so the pages' own stay as they were shown.
    const element = known === undefined ? target.element : agreedIdentity(known.element, target.element);
    seen.set(address, known === undefined ? target : {
      selector: known.selector,
      frameId: known.frameId,
      frameUrlPath: target.frameUrlPath ?? known.frameUrlPath,
      element,
      words: known.words === target.words ? spacedName(element, known.words) : undefined,
      shared: known.shared || target.shared,
      pressable: known.pressable || target.pressable,
      // A field on any page is a field (header).
      notAField: known.notAField === undefined || target.notAField === undefined ? undefined : known.notAField,
      // The newest page's, as `shownIn` is the newest view (header).
      spot: target.spot
    });
  }
  if (seen.size > 1) return { ok: false, code: "ambiguous" };
  const only = [...seen.values()][0];
  if (only?.shared) return { ok: false, code: "not_unique" };
  if (only !== undefined) return resolved(only);
  return missing(flow.letGo.size > 0 ? "stale" : "unknown", [...flow.renumbered.values()].some((marked) => marked.has(handle)));
}

/** A bare handle for an act on the page at `page` (header). */
function resolveOnPage(flow: FlowPages, handle: string, page: string): WebLlmTargetResolution {
  const here = flow.pages.get(page);
  if (here?.has(handle) === true) return resolveCurrent(flow, handle, page);
  // A page not held, or newest seen through a look cut short, cannot say what it lacks.
  if (here === undefined || flow.partial.has(page)) return resolveCurrent(flow, handle, undefined);
  // Missing here: renumbered by this page's reload, which says so, or else named by another page or by none.
  const missingHere = resolveCurrent(flow, handle, page);
  if (missingHere.ok || missingHere.renumberedByReload === true) return missingHere;
  const elsewhere = resolveCurrent(flow, handle, undefined);
  // The same document in another state (header).
  const path = documentPath(page);
  if ([...flow.pages].some(([location, targets]) => location !== page && documentPath(location) === path && targets.has(handle))) return elsewhere;
  return elsewhere.ok || elsewhere.code === "ambiguous" || elsewhere.code === "not_unique" ? { ok: false, code: "stale" } : elsewhere;
}

/** A location without its query and fragment: the document it names, whatever state it is in. */
function documentPath(location: string): string {
  try {
    const url = new URL(location);
    return `${url.origin}${url.pathname}`;
  } catch {
    return location.replace(/[?#].*$/su, "");
  }
}

/** Each described element's target in one capture, marked shared where the capture gave its address to several. */
function targetsOf(binding: WebLlmSnapshotBinding): PageTargets {
  const targets: PageTargets = new Map();
  const uses = new Map<string, number>();
  const pressable = webLlmPressableTargets(binding.evidence.elements);
  const notFields = webLlmNotAFieldTargets(binding.evidence.elements);
  const spotOf = spotsOf(binding);
  for (const element of binding.evidence.elements) {
    const selector = binding.selectors.get(element.target);
    if (selector === undefined) continue;
    const identity = webPlanElementIdentity(element, selector, binding.shadowHosts?.get(element.target), binding.dialogNames?.get(element.target), binding.drawings?.get(element.target));
    const target: PageTarget = {
      selector,
      frameId: element.frameId,
      frameUrlPath: webLlmFrameUrlPath(element),
      element: identity,
      words: spacedName(identity, webPlanElementWords(element, identity)),
      shared: false,
      pressable: pressable.has(element.target),
      notAField: notFields.get(element.target),
      spot: spotOf(element.target)
    };
    const address = addressOf(target);
    uses.set(address, (uses.get(address) ?? 0) + 1);
    targets.set(element.target, target);
  }
  for (const target of targets.values()) target.shared = (uses.get(addressOf(target)) ?? 0) > 1;
  return targets;
}

/**
 * Each handle's `webTargetSpot` on `binding`, with the complete collections its
 * `scope` comes from found once for the capture rather than once per handle:
 * per handle, a page of two thousand elements took minutes. Without the
 * addresses `webTargetSpot` finds no collection and gives every other token as
 * it would; a collection's scope then replaces the location's, as it does there.
 */
function spotsOf(binding: WebLlmSnapshotBinding): (handle: string) => WebLlmTargetSpot {
  const collections = webResetCollections(binding).controls;
  const { selectors: _addresses, ...unaddressed } = binding;
  return (handle) => {
    const spot = webTargetSpot(unaddressed, handle);
    const scope = collections.get(handle);
    if (scope !== undefined) spot.scope = scope;
    return spot;
  };
}

/** `words` when they spell the identity's name otherwise than it is written -- by spacing alone -- else nothing. */
function spacedName(identity: WebPlanElementIdentity, words: string | undefined): string | undefined {
  const name = identity.accessibleName ?? identity.visibleText;
  if (words === undefined || name === undefined || words === name) return undefined;
  return webPlanElementWords({ readable: words }, identity) === words ? words : undefined;
}

/**
 * `targets`, a newer view of a page, with each handle `before` showed at the same
 * address keeping only the identity both views agree on (see the header). A new
 * record each, so the views' own stay as they were shown.
 */
function acrossViews(before: PageTargets | undefined, targets: PageTargets): PageTargets {
  if (before === undefined) return targets;
  const kept: PageTargets = new Map();
  for (const [handle, target] of targets) kept.set(handle, acrossView(before.get(handle), target));
  return kept;
}

/**
 * `target`, a newer view of one handle, keeping only the identity it and
 * `earlier` agree on when both show it at one address; whole when the earlier
 * view did not show it, or showed another element under it.
 */
function acrossView(earlier: PageTarget | undefined, target: PageTarget): PageTarget {
  if (earlier === undefined || addressOf(earlier) !== addressOf(target)) return target;
  const element = webPlanElementIdentityAcrossViews(earlier.element, target.element);
  return { ...target, element, words: earlier.words === target.words ? spacedName(element, target.words) : undefined };
}

/** A handle that names nothing, marked when a reload renumbered it. */
function missing(code: "unknown" | "stale", renumberedByReload: boolean): WebLlmTargetResolution {
  return renumberedByReload ? { ok: false, code, renumberedByReload: true } : { ok: false, code };
}

/** Handles marked per page, at most; the oldest mark goes first. */
const MARKED_PER_PAGE = 4096;
/** The navigation type of a document reached by reloading it (Navigation Timing). */
const RELOAD_NAVIGATION_TYPE = "reload";

/**
 * Before `targets` replace the page's view: unmark the handles it shows again,
 * and, when it is the first view of a document reached by reload, mark each
 * handle it dropped whose control -- tag and words -- it shows under another
 * handle (see the header).
 */
function markRenumbered(flow: FlowPages, binding: WebLlmSnapshotBinding, targets: PageTargets): void {
  const location = binding.evidence.location;
  const marked = flow.renumbered.get(location) ?? new Set<string>();
  for (const handle of targets.keys()) marked.delete(handle);
  const before = flow.pages.get(location);
  const origin = binding.evidence.navigation?.timeOrigin;
  const previous = flow.documents.get(location);
  // The same document both views name is no new load, whatever its type says (header).
  const newDocument = origin === undefined || previous === undefined || origin !== previous;
  if (origin === undefined) flow.documents.delete(location);
  else flow.documents.set(location, origin);
  if (before !== undefined && newDocument && binding.evidence.navigation?.type === RELOAD_NAVIGATION_TYPE) {
    const shown = new Set([...targets.values()].map(controlWords).filter((words): words is string => words !== undefined));
    for (const [handle, target] of before) {
      const words = controlWords(target);
      if (!targets.has(handle) && words !== undefined && shown.has(words)) marked.add(handle);
    }
  }
  for (const oldest of marked) {
    if (marked.size <= MARKED_PER_PAGE) break;
    marked.delete(oldest);
  }
  if (marked.size > 0) flow.renumbered.set(location, marked);
  else flow.renumbered.delete(location);
}

/** A control's tag and words, which a reload does not change; nothing for a wordless control, which only its place tells apart. */
function controlWords(target: PageTarget): string | undefined {
  const words = target.element.accessibleName ?? target.element.visibleText;
  return words === undefined || words.trim() === "" ? undefined : `${target.element.tagName ?? ""}\0${words.replace(/\s+/gu, " ").trim()}`;
}

/** Keep `targets` as the newest view of the page at `location`, letting the oldest page go past the bound. */
function keep(flow: FlowPages, location: string, targets: PageTargets): void {
  flow.pages.delete(location);
  flow.pages.set(location, targets);
  flow.letGo.delete(location);
  for (const oldest of flow.pages.keys()) {
    if (flow.pages.size <= RETAINED_PAGES_PER_FLOW) break;
    flow.pages.delete(oldest);
    flow.renumbered.delete(oldest);
    flow.documents.delete(oldest);
    flow.partial.delete(oldest);
    flow.letGo.add(oldest);
  }
  for (const oldest of flow.letGo) {
    if (flow.letGo.size <= REMEMBERED_STALE_PAGES) break;
    flow.letGo.delete(oldest);
  }
}

/**
 * Where a target is on its page: its frame, the open shadow roots it sits in,
 * and its selector within the innermost. Two widgets can give their controls
 * the same selector inside their own roots, and those are two controls, not one
 * shared selector.
 */
function addressOf(target: Pick<PageTarget, "selector" | "frameId" | "element">): string {
  const hosts = target.element.context?.shadowHosts;
  return `${target.frameId ?? 0}\0${hosts === undefined ? "" : hosts.join("\u001f")}\0${target.selector}`;
}

/** A resolution whose identity is the caller's own copy, so nothing done to it reaches the store. */
function resolved(target: PageTarget): Extract<WebLlmTargetResolution, { ok: true }> {
  const resolution: Extract<WebLlmTargetResolution, { ok: true }> = { ok: true, selector: target.selector, frameId: target.frameId, element: structuredClone(target.element) };
  if (target.frameUrlPath !== undefined) resolution.frameUrlPath = target.frameUrlPath;
  if (target.words !== undefined) resolution.words = target.words;
  if (!target.pressable) resolution.notAControl = true;
  if (target.notAField !== undefined) resolution.notAField = target.notAField;
  if (Object.keys(target.spot).length > 0) resolution.spot = { ...target.spot };
  return resolution;
}

/**
 * What two pages' identities for one address agree on, field by field. They
 * name the same address and not provably the same control, so the identity
 * keeps only what both said rather than either page's version of it.
 */
function agreedIdentity(left: WebPlanElementIdentity, right: WebPlanElementIdentity): WebPlanElementIdentity {
  const agreed = <T>(a: T, b: T): T | undefined => (JSON.stringify(a) === JSON.stringify(b) ? a : undefined);
  return present<WebPlanElementIdentity>({
    tagName: agreed(left.tagName, right.tagName),
    role: agreed(left.role, right.role),
    implicitRole: agreed(left.implicitRole, right.implicitRole),
    accessibleName: agreed(left.accessibleName, right.accessibleName),
    label: agreed(left.label, right.label),
    visibleText: agreed(left.visibleText, right.visibleText),
    selector: agreed(left.selector, right.selector),
    inputType: agreed(left.inputType, right.inputType),
    id: agreed(left.id, right.id),
    classNames: agreed(left.classNames, right.classNames),
    name: agreed(left.name, right.name),
    testId: agreed(left.testId, right.testId),
    attributes: agreed(left.attributes, right.attributes),
    drawing: agreed(left.drawing, right.drawing),
    context: agreed(left.context, right.context)
  });
}

function scopeKey(scope: WebLlmTargetScope): string {
  return `${scope.projectId}\0${scope.flowId}`;
}
