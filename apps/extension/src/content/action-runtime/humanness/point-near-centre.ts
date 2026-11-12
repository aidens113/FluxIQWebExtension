// Where a person's press lands on a control: near its middle, not on the exact
// pixel at its centre, and never at its edge.
//
// The offset on each axis is a normal draw whose spread grows with the level,
// held inside the control's visible box inset by a margin on every side
// (`INSET_SHARE`, at least `INSET_MIN_PX`), and within `REACH_MAX_PX` of the
// centre, since a person aims at a wide button's words rather than anywhere
// along it. This only draws the point: the actionability gate decides whether
// it may be used (`../actionability.ts`, `aimWithinTarget`), re-testing what is
// painted there and keeping the centre when the drawn point does not reach the
// same control.

import type { ClickPoint } from "../click-gesture";
import type { CommandHumanness } from "./command-humanness";
import { standardNormal } from "./standard-normal";

/** The share of the box's size kept clear on each side. */
const INSET_SHARE = 0.2;

/** The least margin kept clear on each side, in pixels. */
const INSET_MIN_PX = 2;

/** The farthest a press lands from the centre on either axis, in pixels. */
const REACH_MAX_PX = 40;

/** The spread of the offset at full humanness, as a share of the reach: about 95% of draws land within 0.8 of it. */
const SPREAD_AT_FULL = 0.4;

/** A box in viewport coordinates. */
type Box = { left: number; top: number; right: number; bottom: number };

/** A point near `centre` inside `box`, for a command at this humanness. Four draws of its generator. */
export function pointNearCentre(box: Box, centre: ClickPoint, human: CommandHumanness): ClickPoint {
  const x = axisOffset(box.right - box.left, standardNormal(human.random), human.share);
  const y = axisOffset(box.bottom - box.top, standardNormal(human.random), human.share);
  return { x: centre.x + x, y: centre.y + y };
}

/** The offset along one axis of `size` pixels, from a standard normal draw. */
function axisOffset(size: number, normal: number, share: number): number {
  const margin = Math.max(INSET_MIN_PX, size * INSET_SHARE);
  const reach = Math.min(REACH_MAX_PX, Math.max(0, size / 2 - margin));
  const offset = normal * reach * SPREAD_AT_FULL * share;
  return Math.max(-reach, Math.min(reach, offset));
}
