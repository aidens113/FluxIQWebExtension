import { REFERENCE_DAY } from "../catalog/index.js";

export type PickupSlot = { id: string; day: "today" | "tomorrow"; hour: number; full: boolean };

/** Hours a store books pickups in, each slot starting on the hour and lasting one. */
const FIRST_HOUR = 8;
const LAST_HOUR = 20;
/** The hours already full today, by store; a slot that started before the reference time is not offered at all. */
const FULL_TODAY: Readonly<Record<string, readonly number[]>> = { "2291": [11, 12, 13], "5510": [11], "1187": [11, 12], "4419": [] };

const hourText = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "am" : "pm"}`;

/** Every pickup slot a store offers today and tomorrow, earliest first. */
export function pickupSlots(storeId: string): PickupSlot[] {
  const slots: PickupSlot[] = [];
  for (let hour = REFERENCE_DAY.hour + 1; hour <= LAST_HOUR; hour += 1) slots.push({ id: `${storeId}-0921-${hour}`, day: "today", hour, full: (FULL_TODAY[storeId] ?? []).includes(hour) });
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 1) slots.push({ id: `${storeId}-0922-${hour}`, day: "tomorrow", hour, full: false });
  return slots;
}

/** "2pm–3pm", as a slot button reads. */
export function slotRangeText(slot: Pick<PickupSlot, "hour">): string {
  return `${hourText(slot.hour)}–${hourText(slot.hour + 1)}`;
}

/** "Mon, Sep 21, 2pm–3pm", as the order confirmation reads. */
export function slotText(slot: Pick<PickupSlot, "hour" | "day">): string {
  return `${slot.day === "today" ? REFERENCE_DAY.today : REFERENCE_DAY.tomorrow}, ${slotRangeText(slot)}`;
}
