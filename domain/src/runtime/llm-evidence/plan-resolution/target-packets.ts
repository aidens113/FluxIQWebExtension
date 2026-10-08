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
// frame held when the element was shown (`frameUrlPath`), read off the frame
// address the merge published with the element (`data-fluxiq-frame-url`). The
// frame id names nothing once a Flow reloads the page -- Chrome renumbers a
// frame when it navigates -- and the path finds the same document again, as it
// does for a recorded node (`output-nodes/payloads.ts`). The pathname only: the
// origin differs run to run and the query may carry a token. Pages that agree on
// a bare handle keep the newest path any of them gave.
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
// Bounded twice: a Flow keeps its newest `RETAINED_PAGES_PER_FLOW` pages, and
// the store keeps its newest `RETAINED_FLOWS` Flows. A page let go makes its
// handles `stale` for that Flow; another Flow's handles are `unknown`, as they
// are for the extraction handles (`structure/handles.ts`).

import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import { webAutomationUrlPath } from "../../../output-nodes";
import type { WebLlmEvidenceElement } from "../elements";
import { present } from "../present";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { webPlanElementIdentity, webPlanElementIdentityAcrossViews, webPlanElementWords, type WebPlanElementIdentity } from "./element-identity";

const RETAINED_PAGES_PER_FLOW = 8;
const RETAINED_FLOWS = 32;
/** Let-go pages remembered per Flow, by location only, so a handle on one reads as stale rather than unknown. */
const REMEMBERED_STALE_PAGES = 64;

export type WebLlmTargetScope = { projectId: string; flowId: string };

export type WebLlmTargetResolution =
  | {
      ok: true;
      selector: string;
      frameId: number | undefined;
      frameUrlPath?: string;
      element: WebPlanElementIdentity;
      /** The words a person reads for the element, when they differ from its identity's name by spacing alone (header). Display only. */
      words?: string;
    }
  | { ok: false; code: "unknown" | "stale" | "ambiguous" | "not_unique"; renumberedByReload?: true };

export type WebLlmTargetPackets = {
  /** Remember a packet the model was just shown, as the newest view of its page. */
  remember(scope: WebLlmTargetScope, binding: WebLlmSnapshotBinding): void;
  /** Remember a look the model was not shown: as `remember` when it describes the whole page, else its handles only join the page's. */
  rememberLook(scope: WebLlmTargetScope, binding: WebLlmSnapshotBinding): void;
  resolve(scope: WebLlmTargetScope, handle: string, location: string | undefined): WebLlmTargetResolution;
};

type PageTarget = { selector: string; frameId: number | undefined; frameUrlPath: string | undefined; element: WebPlanElementIdentity; words: string | undefined; shared: boolean };
type PageTargets = Map<string, PageTarget>;
/** `renumbered`: per page, the handles a reload dropped while showing their control under another (see the header). */
type FlowPages = { pages: Map<string, PageTargets>; letGo: Set<string>; renumbered: Map<string, Set<string>> };

export function createWebLlmTargetPackets(): WebLlmTargetPackets {
  const flows = new Map<string, FlowPages>();
  /** The Flow's pages, made the newest Flow remembered. */
  const flowOf = (scope: WebLlmTargetScope): FlowPages => {
    const key = scopeKey(scope);
    const flow = flows.get(key) ?? { pages: new Map<string, PageTargets>(), letGo: new Set<string>(), renumbered: new Map<string, Set<string>>() };
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
      markRenumbered(flow, binding, targets);
      keep(flow, binding.evidence.location, acrossViews(flow.pages.get(binding.evidence.location), targets));
    },
    rememberLook(scope, binding) {
      const flow = flowOf(scope);
      const location = binding.evidence.location;
      const seen = targetsOf(binding);
      // A look that described every control says which have gone, as a shown
      // packet does; one the browser's capture cut short (`captureTruncated`)
      // cannot, so it only adds. Since t200 nothing else cuts a look.
      const before = flow.pages.get(location);
      if (!binding.evidence.truncated) {
        markRenumbered(flow, binding, seen);
        keep(flow, location, acrossViews(before, seen));
        return;
      }
      const targets = new Map(before ?? []);
      for (const [handle, target] of acrossViews(before, seen)) targets.set(handle, target);
      keep(flow, location, targets);
    },
    resolve(scope, written, location) {
      const handle = canonicalWebLlmTargetHandle(written) ?? written;
      const flow = flows.get(scopeKey(scope));
      if (!flow) return { ok: false, code: "unknown" };
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
          shared: known.shared || target.shared
        });
      }
      if (seen.size > 1) return { ok: false, code: "ambiguous" };
      const only = [...seen.values()][0];
      if (only?.shared) return { ok: false, code: "not_unique" };
      if (only !== undefined) return resolved(only);
      return missing(flow.letGo.size > 0 ? "stale" : "unknown", [...flow.renumbered.values()].some((marked) => marked.has(handle)));
    },
  };
}

/** Each described element's target in one capture, marked shared where the capture gave its address to several. */
function targetsOf(binding: WebLlmSnapshotBinding): PageTargets {
  const targets: PageTargets = new Map();
  const uses = new Map<string, number>();
  for (const element of binding.evidence.elements) {
    const selector = binding.selectors.get(element.target);
    if (selector === undefined) continue;
    const identity = webPlanElementIdentity(element, selector, binding.shadowHosts?.get(element.target));
    const target: PageTarget = {
      selector,
      frameId: element.frameId,
      frameUrlPath: webLlmFrameUrlPath(element),
      element: identity,
      words: spacedName(identity, webPlanElementWords(element, identity)),
      shared: false
    };
    const address = addressOf(target);
    uses.set(address, (uses.get(address) ?? 0) + 1);
    targets.set(element.target, target);
  }
  for (const target of targets.values()) target.shared = (uses.get(addressOf(target)) ?? 0) > 1;
  return targets;
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
  for (const [handle, target] of targets) {
    const earlier = before.get(handle);
    if (earlier === undefined || addressOf(earlier) !== addressOf(target)) {
      kept.set(handle, target);
      continue;
    }
    const element = webPlanElementIdentityAcrossViews(earlier.element, target.element);
    kept.set(handle, { ...target, element, words: earlier.words === target.words ? spacedName(element, target.words) : undefined });
  }
  return kept;
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
 * and, when it arrived by reload, mark each handle it dropped whose control --
 * tag and words -- it shows under another handle (see the header).
 */
function markRenumbered(flow: FlowPages, binding: WebLlmSnapshotBinding, targets: PageTargets): void {
  const location = binding.evidence.location;
  const marked = flow.renumbered.get(location) ?? new Set<string>();
  for (const handle of targets.keys()) marked.delete(handle);
  const before = flow.pages.get(location);
  if (before !== undefined && binding.evidence.navigation?.type === RELOAD_NAVIGATION_TYPE) {
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
function addressOf(target: PageTarget): string {
  const hosts = target.element.context?.shadowHosts;
  return `${target.frameId ?? 0}\0${hosts === undefined ? "" : hosts.join("\u001f")}\0${target.selector}`;
}

/** A resolution whose identity is the caller's own copy, so nothing done to it reaches the store. */
function resolved(target: PageTarget): WebLlmTargetResolution {
  const resolution: Extract<WebLlmTargetResolution, { ok: true }> = { ok: true, selector: target.selector, frameId: target.frameId, element: structuredClone(target.element) };
  if (target.frameUrlPath !== undefined) resolution.frameUrlPath = target.frameUrlPath;
  if (target.words !== undefined) resolution.words = target.words;
  return resolution;
}

/** The attribute the frame merge publishes a child frame's element with: its frame document's URL, screened as a link is. */
const FRAME_URL_ATTRIBUTE = "data-fluxiq-frame-url";

/**
 * The pathname of the document a child frame's element was shown in, by the
 * rule a recorded node's path follows (`output-nodes/url-path.ts`); nothing for
 * the top frame, for a frame whose document is not http(s), or for an element
 * published without its frame's address.
 */
function webLlmFrameUrlPath(element: WebLlmEvidenceElement): string | undefined {
  if (element.frameId === undefined || element.frameId <= 0) return undefined;
  const url = element.attributes?.find(([name]) => name.toLowerCase() === FRAME_URL_ATTRIBUTE)?.[1];
  if (url === undefined || !URL.canParse(url)) return undefined;
  const parsed = new URL(url);
  return parsed.protocol === "http:" || parsed.protocol === "https:" ? webAutomationUrlPath(parsed.pathname) : undefined;
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
    accessibleName: agreed(left.accessibleName, right.accessibleName),
    visibleText: agreed(left.visibleText, right.visibleText),
    selector: agreed(left.selector, right.selector),
    inputType: agreed(left.inputType, right.inputType),
    context: agreed(left.context, right.context)
  });
}

function scopeKey(scope: WebLlmTargetScope): string {
  return `${scope.projectId}\0${scope.flowId}`;
}
