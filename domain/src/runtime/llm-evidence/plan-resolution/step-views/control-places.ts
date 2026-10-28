// Where a control of a dialog view sits, so a newer capture of the dialog can
// say whether a handle it no longer shows is gone or only shows another state
// under another handle (`./kept-by-place.ts`, t781).
//
// A toggle's words change with its state ("Like" becomes "Unlike"), and the
// Flow-wide numbering (`../../stable-handles.ts`) gives each state its own
// handle, so a capture of a dialog after a trial liked the post holds the
// Unlike under a new handle and not the Like's. Its place is what does not
// change: its tag, its role, the context it sits in -- the dialog, its record,
// its list position -- and its address. A record by its key and values, not its
// text: a record's words leave out the words of its buttons, but not the count
// beside them ("12 likes" becomes "13 likes" with the Like), and the address
// already says which row it is.
//
// Two places, the second for when the first moved:
//
// - `exact`: the frame, the open shadow roots, the selector within the
//   innermost (the packet store's own address, `../target-packets.ts`
//   `addressOf`), with the tag, role and context;
// - `loose`: the same with every `:nth-of-type`/`:nth-child` taken out, as the
//   numbering's loose address takes them out, since a layer the page puts
//   beside the dialog -- one more `div` under `body` -- shifts every position
//   after it. The shadow hosts leave the context for the same reason; the host
//   chain stays in the address, unpositioned. Several controls share a loose
//   place, so `./kept-by-place.ts` matches on it only where nothing is left to
//   choose.

import type { WebPlanElementIdentity } from "../element-identity";

/** What a dialog view's control is, as far as its place goes. */
type Placed = { selector: string; frameId: number | undefined; element: WebPlanElementIdentity };

/** The exact and loose places of a control in a dialog view (header). */
export function webLlmDialogControlPlaces(target: Placed): { exact: string; loose: string } {
  const element = target.element;
  const { shadowHosts, record, ...context } = element.context ?? {};
  const hosts = shadowHosts ?? [];
  const { text: _words, ...row } = record ?? {};
  const kind = [element.tagName ?? "", element.role ?? element.implicitRole ?? "", JSON.stringify({ ...context, record: row })].join("\0");
  return {
    exact: [String(target.frameId ?? 0), hosts.join("\u001f"), target.selector, kind].join("\0"),
    loose: [String(target.frameId ?? 0), hosts.map(unpositioned).join("\u001f"), unpositioned(target.selector), kind].join("\0")
  };
}

function unpositioned(selector: string): string {
  return selector.replace(/:nth-(?:of-type|child)\(\d+\)/gu, "");
}
