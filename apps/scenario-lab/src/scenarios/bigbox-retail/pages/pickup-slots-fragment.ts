import { pickupSlots, slotRangeText } from "../cart/index.js";
import { REFERENCE_DAY } from "../catalog/index.js";
import type { BigboxClasses } from "../theme/index.js";

/**
 * The pickup times the checkout fetches after it loads: today's, then
 * tomorrow's. A full slot is a disabled button that still says its time.
 * Every button reads only its time; the day is in the heading above it.
 */
export function pickupSlotsFragment(storeId: string, c: BigboxClasses): string {
  const slots = pickupSlots(storeId);
  const day = (which: "today" | "tomorrow", heading: string) => `<h3>${heading}</h3><div class="${c.slotGrid}">${slots.filter((slot) => slot.day === which).map((slot) => (slot.full
    ? `<button type="button" class="${c.slot} ${c.slotFull}" disabled>${slotRangeText(slot)} <small>Full</small></button>`
    : `<button type="button" class="${c.slot}" value="${slot.id}">${slotRangeText(slot)}</button>`)).join("")}</div>`;
  return `${day("today", `Today, ${REFERENCE_DAY.today}`)}${day("tomorrow", `Tomorrow, ${REFERENCE_DAY.tomorrow}`)}`;
}
