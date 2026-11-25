// One element seen at different positions by different pages (t1036, D2).
//
// Since the same card keeps its handle after a filter or a sort changes the
// page's query (`../../stable-handles.ts`), two remembered pages can give one
// handle selectors that differ only in their positions (`nth-of-type`,
// `nth-child`): one element, seen where each view put it. A bare handle then
// names that element as the newest of those views shows it. Selectors that
// differ in anything else -- another frame, other shadow hosts, another shape
// -- are not this, and the handle stays ambiguous (`../target-packets.ts`).

import type { AutomationStudioResolvedControlIntent } from "fluxiq/automation";
import { sameWebPlanControlIntent } from "../control-intents";

/** What this reads of a remembered target. */
type MovableTarget = {
  selector: string;
  frameId: number | undefined;
  element: { context?: { shadowHosts?: readonly string[] | undefined } | undefined };
  shared: boolean;
  controlIntent: AutomationStudioResolvedControlIntent | undefined;
  crossPageIntentConflict?: boolean;
};

/**
 * The newest of `views` (oldest first, one per page that holds the handle)
 * when every view is one address with only its positions moved, else
 * `undefined`. Not unique on any page is not unique here; views that classify
 * the control differently mark it as a cross-page conflict.
 */
export function webPlanMovedTarget<T extends MovableTarget>(views: readonly T[]): T | undefined {
  const newest = views[views.length - 1];
  if (newest === undefined || !views.every((view) => looseOf(view) === looseOf(newest))) return undefined;
  const shared = views.some((view) => view.shared);
  const conflict = views.some((view) => !sameWebPlanControlIntent(view.controlIntent, newest.controlIntent));
  return shared || conflict ? { ...newest, shared, crossPageIntentConflict: newest.crossPageIntentConflict === true || conflict } : newest;
}

/** The target's address with every position taken out. */
function looseOf(target: MovableTarget): string {
  const hosts = (target.element.context?.shadowHosts ?? []).map(unpositioned).join("\u001f");
  return `${target.frameId ?? 0}\0${hosts}\0${unpositioned(target.selector)}`;
}

function unpositioned(selector: string): string {
  return selector.replace(/:nth-(?:of-type|child)\(\d+\)/gu, "");
}
