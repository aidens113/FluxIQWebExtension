import { BRANCHES, COMPANY } from "./company.js";
import { addDays, weekday } from "./format.js";
import { fnv1a } from "./reference.js";
import { TEAM } from "./team.js";

/** What the booking widget sells: a service and the variant of it that sets the price. */
export type BookableService = { id: string; service: string; variant: string; pence: number };

export const BOOKABLE_SERVICES: readonly BookableService[] = [
  { id: "service-combi", service: "Annual boiler service", variant: "Combi boiler", pence: 9_500 },
  { id: "service-system", service: "Annual boiler service", variant: "System or regular boiler", pence: 11_000 },
  { id: "service-oil", service: "Annual boiler service", variant: "Oil boiler", pence: 12_500 },
  { id: "cp12", service: "Gas safety certificate", variant: "Landlord certificate (CP12)", pence: 7_500 },
  { id: "repair", service: "Boiler repair visit", variant: "First hour", pence: 8_500 },
];

/** Taken when the visit is booked and deducted from the final bill. */
export const DEPOSIT_PENCE = 3_000;

/** How far ahead the calendar reaches: three weeks from the site's today. */
export const CALENDAR_DAYS = 21;

export type Slot = { date: string; time: string; free: boolean; engineer: string };

const WEEKDAY_TIMES = ["08:00", "10:30", "13:00", "15:30"] as const;
const SATURDAY_TIMES = ["09:00", "11:30"] as const;
const OPEN_SATURDAYS = new Set(["wrenfield", "sallowmere", "eastmoor", "hollins-cross"]);

/**
 * Slots whose availability is authored rather than derived, so the booking
 * task has one right answer and the wrong ones sit close to it: Hollins Cross
 * has free mornings before 1 October, only afternoons on 1 and 2 October, a
 * free Saturday morning, and its first free weekday morning on Monday 5
 * October at 10:30; Eastmoor has a free morning on 1 October.
 */
const AUTHORED: Readonly<Record<string, boolean>> = {
  "hollins-cross|2026-09-29|08:00": true,
  "hollins-cross|2026-09-30|10:30": true,
  "hollins-cross|2026-10-01|08:00": false,
  "hollins-cross|2026-10-01|10:30": false,
  "hollins-cross|2026-10-01|13:00": true,
  "hollins-cross|2026-10-01|15:30": true,
  "hollins-cross|2026-10-02|08:00": false,
  "hollins-cross|2026-10-02|10:30": false,
  "hollins-cross|2026-10-02|13:00": false,
  "hollins-cross|2026-10-02|15:30": true,
  "hollins-cross|2026-10-03|09:00": true,
  "hollins-cross|2026-10-03|11:30": true,
  "hollins-cross|2026-10-05|08:00": false,
  "hollins-cross|2026-10-05|10:30": true,
  "eastmoor|2026-10-01|08:00": true,
};

/** The Gas Safe engineers who take bookings at a branch, in team-page order. */
export function bookableEngineers(branchId: string): string[] {
  return TEAM.filter((card) => card.kind === "person" && card.branchId === branchId && card.credentials.some(({ label, value }) => label === "Gas Safe ID" && /^\d+$/u.test(value))).map(({ name }) => name);
}

/**
 * Every slot a branch shows, in calendar order, with the run's own bookings
 * taken out. Today has no online slots, Sundays none, and Saturdays two, at
 * the branches that open on Saturdays.
 */
export function slotsFor(branchId: string, booked: ReadonlyArray<{ branchId: string; date: string; time: string }> = []): Slot[] {
  if (!BRANCHES.some(({ id }) => id === branchId)) return [];
  const engineers = bookableEngineers(branchId);
  const slots: Slot[] = [];
  for (let day = 1; day < CALENDAR_DAYS; day += 1) {
    const date = addDays(COMPANY.today, day);
    const dow = weekday(date);
    const times: readonly string[] = dow === 0 ? [] : dow === 6 ? (OPEN_SATURDAYS.has(branchId) ? SATURDAY_TIMES : []) : WEEKDAY_TIMES;
    times.forEach((time, index) => {
      const key = `${branchId}|${date}|${time}`;
      const authored = AUTHORED[key];
      const open = authored ?? fnv1a(key) % 5 >= 2;
      const taken = booked.some((entry) => entry.branchId === branchId && entry.date === date && entry.time === time);
      slots.push({ date, time, free: open && !taken, engineer: engineers[(day + index) % engineers.length] ?? "" });
    });
  }
  return slots;
}

export function bookableServiceById(id: string): BookableService | undefined {
  return BOOKABLE_SERVICES.find((candidate) => candidate.id === id);
}
