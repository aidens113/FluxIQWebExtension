/**
 * Kestrel Lane Heating & Plumbing: a fictional family firm, five branches, a
 * website built by a local agency on a page builder and then added to for ten
 * years. Every name, address and number here is invented; the phone numbers
 * are from the 01632 960 range set aside for fiction.
 */
export const COMPANY = {
  name: "Kestrel Lane Heating & Plumbing",
  shortName: "Kestrel Lane",
  founded: 1987,
  phone: "01632 960 418",
  emergencyPhone: "01632 960 999",
  email: "hello@kestrel-lane.example",
  /** The site's "today". Nothing reads the wall clock: the calendar starts here. */
  today: "2026-09-28",
  root: "/scenarios/company-website/",
} as const;

export type Branch = {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: ReadonlyArray<readonly [string, string]>;
  note: string;
};

/**
 * The branches in the order the site lists them everywhere: head office
 * first, then the rest in the order they opened. It is not alphabetical, and
 * nothing on the site says what the order is.
 */
export const BRANCHES: readonly Branch[] = [
  {
    id: "wrenfield", name: "Wrenfield", address: "2 Mill Race Yard, Wrenfield KL1 4AX", phone: "01632 960 418",
    hours: [["Monday to Friday", "08:00 to 17:30"], ["Saturday", "09:00 to 13:00"], ["Sunday", "Closed"]],
    note: "Head office and showroom. Parking behind the building.",
  },
  {
    id: "corve-bridge", name: "Corve Bridge", address: "Unit 9, Riverside Trading Estate, Corve Bridge KL3 8LT", phone: "01632 960 422",
    hours: [["Monday to Friday", "08:00 to 17:00"], ["Saturday", "Closed"], ["Sunday", "Closed"]],
    note: "Trade counter only. Customer visits by appointment.",
  },
  {
    id: "sallowmere", name: "Sallowmere", address: "41 Quarry Lane, Sallowmere KL5 2QE", phone: "01632 960 437",
    hours: [["Monday to Friday", "08:30 to 17:00"], ["Saturday", "09:00 to 12:00"], ["Sunday", "Closed"]],
    note: "Renewables and heat pump centre.",
  },
  {
    id: "eastmoor", name: "Eastmoor", address: "14 Carding Row, Eastmoor KL2 3HD", phone: "01632 960 451",
    hours: [["Monday to Friday", "08:00 to 17:30"], ["Saturday", "09:00 to 13:00"], ["Sunday", "Closed"]],
    note: "Closed for stocktaking on Friday 9 October.",
  },
  {
    id: "hollins-cross", name: "Hollins Cross", address: "Unit 4, Tanyard Park, Hollins Cross KL6 1PW", phone: "01632 960 463",
    hours: [["Monday to Friday", "07:30 to 17:30"], ["Saturday", "09:00 to 13:00"], ["Sunday", "Closed"]],
    note: "Our newest branch, opened in March.",
  },
];

export function branchById(id: string): Branch {
  const branch = BRANCHES.find((candidate) => candidate.id === id);
  if (!branch) throw new Error(`Unknown branch ${id}`);
  return branch;
}
