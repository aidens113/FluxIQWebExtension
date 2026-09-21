import { formatPence } from "./format.js";

/**
 * One row of the price list. `incPence` is the homeowner price including VAT,
 * `null` for "Price on application"; `from` marks a starting price. A partner
 * row is an advert the page builder slots into the table: it is styled like a
 * service, carries a small "Sponsored" tag, and its price never changes with
 * the VAT switch because it is not Kestrel Lane's price at all.
 */
export type PriceRow = {
  name: string;
  detail: string;
  incPence: number | null;
  vatRate: 0 | 20;
  from?: true;
  partner?: { brand: string; price: string };
};

export type PriceCategory = { id: string; title: string; rows: readonly PriceRow[] };

export type PriceBasis = "inc" | "ex";

const row = (name: string, detail: string, incPence: number | null, extra: Partial<PriceRow> = {}): PriceRow => ({ name, detail, incPence, vatRate: 20, ...extra });
const partner = (brand: string, name: string, detail: string, price: string): PriceRow => ({ name, detail, incPence: null, vatRate: 20, partner: { brand, price } });

/**
 * The price list, in page order. Only the first category opens by default.
 * Heat pumps carry 0% VAT, as energy-saving installations do, so their two
 * prices are the same number.
 */
export const PRICE_LIST: readonly PriceCategory[] = [
  {
    id: "servicing", title: "Servicing & safety checks", rows: [
      row("Annual boiler service (combi)", "Full service, flue gas analysis and a written report.", 9_500),
      row("Annual boiler service (system or regular)", "As above, including the cylinder and controls.", 11_000),
      row("Oil boiler service", "Nozzle, filter and combustion check.", 12_500),
      partner("HomeShield Plus", "HomeShield Plus boiler cover", "Breakdown cover with unlimited call-outs. Provided by our partner.", "from £14.50 a month"),
      row("Gas safety certificate (CP12)", "For landlords. Up to three appliances.", 7_500),
      row("Gas safety certificate plus boiler service", "Both visits in one appointment.", 15_000),
      row("Carbon monoxide alarm fitted", "Supplied, fitted and tested.", 4_900),
    ],
  },
  {
    id: "repairs", title: "Repairs & call-outs", rows: [
      row("Boiler repair, first hour", "Diagnosis and the first hour of labour.", 8_500),
      row("Each further half hour", "Charged only for time on site.", 3_000),
      row("Emergency call-out, evenings and weekends", "Attendance within four hours.", 14_000),
      partner("FixFast", "FixFast parts protection", "Covers replacement parts after a repair. Provided by our partner.", "£6.99 a month"),
      row("Leak detection", "Thermal imaging and trace-and-access.", 12_000, { from: true }),
      row("Powerflush (up to 10 radiators)", "Includes inhibitor and a magnetic filter check.", 48_000),
      row("Radiator replacement", "Like-for-like, supplied and fitted.", 21_000, { from: true }),
    ],
  },
  {
    id: "installation", title: "Boiler installation", rows: [
      row("Combi boiler replacement", "Like-for-like swap with a ten-year warranty.", 214_500, { from: true }),
      row("System boiler replacement", "Including a new unvented cylinder.", 269_500, { from: true }),
      row("Back boiler removal", "Surveyed first; every chimney breast is different.", null),
    ],
  },
  {
    id: "renewables", title: "Heat pumps & renewables", rows: [
      row("Air source heat pump", "Design, installation and commissioning.", 985_000, { from: true, vatRate: 0 }),
      row("Heat pump service", "Annual service and refrigerant check.", 16_000),
    ],
  },
  {
    id: "plumbing", title: "Plumbing", rows: [
      row("Plumbing, hourly rate", "Minimum one hour.", 6_500),
      row("Tap or mixer replacement", "Supplied and fitted.", 9_500, { from: true }),
    ],
  },
];

/** The price a row shows on a basis, exactly as the page writes it. */
export function priceText(entry: PriceRow, basis: PriceBasis): string {
  if (entry.partner) return entry.partner.price;
  if (entry.incPence === null) return "Price on application";
  const pence = basis === "inc" || entry.vatRate === 0 ? entry.incPence : Math.round((entry.incPence * 100) / (100 + entry.vatRate));
  return `${entry.from ? "from " : ""}${formatPence(pence)}`;
}
