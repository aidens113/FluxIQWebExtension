// Whether a point that missed the target still reaches the control the target
// is part of, so that a person's press there does exactly what a press on the
// target does (t756).
//
// A photo grid draws each cell as a link around its picture, and over the
// picture the cell's own like and comment counts: an `inset: 0` layer, drawn
// transparent until it is hovered, inside the same link. Every point of the
// picture lands on that layer. Live (`run-mvdi88yz-e444d594`, photo-social),
// a Flow whose step pressed the picture it had found by its alt text was
// refused as covered on every attempt of three trials -- "the point 441,360
// landed on ul.<overlay>, which covers the target" -- while a person's click
// on the picture opens the post, because the layer is part of the link.
//
// So a hit outside the target is accepted when, and only when:
//
// - the target is inside a control (`PRESSABLE_HOST`) and is not that control
//   itself -- a control's own box was already tested by the caller;
// - the hit lies inside that same control; and
// - the nearest control around the hit is that same control: a Like button,
//   a menu or any other control nested in the link is a different press, and a
//   hit on it is still a cover.
//
// A layer that is not part of the control -- a consent dialog, a scrim, a
// promotion, a sibling card -- is outside it and stays a cover, so the dialog
// defences keep answering it first.

import { composedClosest, composedContains } from "../../shadow-dom";
import { PRESSABLE_HOST } from "./pressable-host";

/** The control the target is part of, when `hit` is inside it and belongs to no other control; otherwise `undefined`. */
export function sameControlHit(target: Element, hit: Element): Element | undefined {
  const control = composedClosest(target, PRESSABLE_HOST);
  if (control === null || control === target) return undefined;
  if (!composedContains(control, hit)) return undefined;
  return composedClosest(hit, PRESSABLE_HOST) === control ? control : undefined;
}
