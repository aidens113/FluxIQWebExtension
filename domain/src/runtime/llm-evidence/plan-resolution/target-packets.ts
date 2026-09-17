// The target handles one Flow's authoring was shown, remembered per page, so a
// plan that names `target.N` can be given the selector behind it.
//
// Handles are positional: `target.3` on one page and `target.3` on the next
// are different controls. So this keeps, for each project and Flow, the newest
// packet the model was shown for each page it visited -- a recapture of a page
// replaces that page's handles, as it replaced them in front of the model --
// and a handle is resolved against those pages:
//
// - named with the page's `location`, against that page alone;
// - named bare, against every remembered page, and only when they all agree
//   on what it names. Two pages that give one handle different selectors make
//   a bare handle `ambiguous`, never a guess at the newer one.
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
//
// Bounded twice: a Flow keeps its newest `RETAINED_PAGES_PER_FLOW` pages, and
// the store keeps its newest `RETAINED_FLOWS` Flows. A page let go makes its
// handles `stale` for that Flow; another Flow's handles are `unknown`, as they
// are for the extraction handles (`structure/handles.ts`).

import { present } from "../present";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { webPlanElementIdentity, type WebPlanElementIdentity } from "./element-identity";

const RETAINED_PAGES_PER_FLOW = 8;
const RETAINED_FLOWS = 32;
/** Let-go pages remembered per Flow, by location only, so a handle on one reads as stale rather than unknown. */
const REMEMBERED_STALE_PAGES = 64;

export type WebLlmTargetScope = { projectId: string; flowId: string };

export type WebLlmTargetResolution =
  | { ok: true; selector: string; frameId: number | undefined; element: WebPlanElementIdentity }
  | { ok: false; code: "unknown" | "stale" | "ambiguous" | "not_unique" };

export type WebLlmTargetPackets = {
  /** Remember a packet the model was just shown, as the newest view of its page. */
  remember(scope: WebLlmTargetScope, binding: WebLlmSnapshotBinding): void;
  resolve(scope: WebLlmTargetScope, handle: string, location: string | undefined): WebLlmTargetResolution;
};

type PageTarget = { selector: string; frameId: number | undefined; element: WebPlanElementIdentity; shared: boolean };
type PageTargets = Map<string, PageTarget>;
type FlowPages = { pages: Map<string, PageTargets>; letGo: Set<string> };

export function createWebLlmTargetPackets(): WebLlmTargetPackets {
  const flows = new Map<string, FlowPages>();
  return {
    remember(scope, binding) {
      const key = scopeKey(scope);
      const flow = flows.get(key) ?? { pages: new Map<string, PageTargets>(), letGo: new Set<string>() };
      flows.delete(key);
      flows.set(key, flow);
      for (const oldest of flows.keys()) {
        if (flows.size <= RETAINED_FLOWS) break;
        flows.delete(oldest);
      }
      const location = binding.evidence.location;
      const targets: PageTargets = new Map();
      const uses = new Map<string, number>();
      for (const element of binding.evidence.elements) {
        const selector = binding.selectors.get(element.target);
        if (selector === undefined) continue;
        const address = `${element.frameId ?? 0}\0${selector}`;
        uses.set(address, (uses.get(address) ?? 0) + 1);
        targets.set(element.target, { selector, frameId: element.frameId, element: webPlanElementIdentity(element, selector), shared: false });
      }
      for (const target of targets.values()) target.shared = (uses.get(`${target.frameId ?? 0}\0${target.selector}`) ?? 0) > 1;
      flow.pages.delete(location);
      flow.pages.set(location, targets);
      flow.letGo.delete(location);
      for (const oldest of flow.pages.keys()) {
        if (flow.pages.size <= RETAINED_PAGES_PER_FLOW) break;
        flow.pages.delete(oldest);
        flow.letGo.add(oldest);
      }
      for (const oldest of flow.letGo) {
        if (flow.letGo.size <= REMEMBERED_STALE_PAGES) break;
        flow.letGo.delete(oldest);
      }
    },
    resolve(scope, handle, location) {
      const flow = flows.get(scopeKey(scope));
      if (!flow) return { ok: false, code: "unknown" };
      if (location !== undefined) {
        const page = flow.pages.get(location);
        if (!page) return { ok: false, code: flow.letGo.has(location) ? "stale" : "unknown" };
        const target = page.get(handle);
        if (target === undefined) return { ok: false, code: "unknown" };
        return target.shared ? { ok: false, code: "not_unique" } : resolved(target);
      }
      const seen = new Map<string, PageTarget>();
      for (const page of flow.pages.values()) {
        const target = page.get(handle);
        if (target === undefined) continue;
        const address = `${target.frameId ?? 0}\0${target.selector}`;
        const known = seen.get(address);
        // One page sharing the selector makes the handle not unique wherever
        // else it agrees, and the identity is only what every page said. A new
        // record, so the pages' own stay as they were shown.
        seen.set(address, known === undefined ? target : {
          selector: known.selector,
          frameId: known.frameId,
          element: agreedIdentity(known.element, target.element),
          shared: known.shared || target.shared
        });
      }
      if (seen.size > 1) return { ok: false, code: "ambiguous" };
      const only = [...seen.values()][0];
      if (only?.shared) return { ok: false, code: "not_unique" };
      if (only !== undefined) return resolved(only);
      return { ok: false, code: flow.letGo.size > 0 ? "stale" : "unknown" };
    },
  };
}

/** A resolution whose identity is the caller's own copy, so nothing done to it reaches the store. */
function resolved(target: PageTarget): WebLlmTargetResolution {
  return { ok: true, selector: target.selector, frameId: target.frameId, element: structuredClone(target.element) };
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
