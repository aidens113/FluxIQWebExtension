import type { CompanyEntry } from "./types.js";

/** Companies per sector, and sectors, so the register holds 320 entries with no two names alike. */
const PER_SECTOR = 40;

/**
 * The sectors the register is divided into, in the order the sector list
 * offers them, each with the word its members' names end in and the
 * headcounts a company in it plausibly has.
 *
 * The size profiles are what make one question in this fixture unanswerable:
 * an independent retailer never reaches a thousand staff, so that sector and
 * the largest size band together match nobody, and the right answer is an
 * empty table rather than the nearest thing to one.
 */
const SECTORS = [
  { name: "Agriculture", suffix: "Farms", bands: ["1\u201310", "11\u201350", "51\u2013200"] },
  { name: "Construction", suffix: "Construction", bands: ["11\u201350", "51\u2013200", "201\u2013500"] },
  { name: "Creative services", suffix: "Studio", bands: ["1\u201310", "11\u201350", "51\u2013200"] },
  { name: "Financial services", suffix: "Financial", bands: ["51\u2013200", "201\u2013500", "501\u20131,000", "1,001+"] },
  { name: "Healthcare", suffix: "Health", bands: ["11\u201350", "51\u2013200", "201\u2013500", "501\u20131,000"] },
  { name: "Independent retail", suffix: "Trading", bands: ["1\u201310", "11\u201350"] },
  { name: "Logistics", suffix: "Logistics", bands: ["51\u2013200", "201\u2013500", "501\u20131,000", "1,001+"] },
  { name: "Software", suffix: "Software", bands: ["11\u201350", "51\u2013200", "201\u2013500", "1,001+"] },
] as const;

/** Forty founders' names, one per company in each sector, spread across the alphabet so the A-Z index is worth using. */
const PREFIXES = [
  "Abbeyfield", "Alderworth", "Baverstock", "Brenthill", "Calderwood", "Cranmoor", "Deepdale", "Dunwich",
  "Earlsgate", "Elverton", "Fairholme", "Fenwick", "Garrowby", "Glendale", "Hartsmere", "Holbeck",
  "Inglewood", "Ivybridge", "Jarrowfield", "Kelsterne", "Kingsmoor", "Larkhill", "Lindhurst", "Marchwood",
  "Merefield", "Newbiggin", "Northaven", "Oakhanger", "Orrell", "Pendlebury", "Priorwood", "Quarrendon",
  "Ravensworth", "Rothbury", "Saltburn", "Shawcross", "Thorneley", "Ullswater", "Wardley", "Yarnfield",
] as const;

const LOCATIONS = [
  "Harrogate, North Yorkshire", "Kendal, Cumbria", "Shrewsbury, Shropshire", "Stamford, Lincolnshire",
  "Truro, Cornwall", "Hexham, Northumberland", "Ludlow, Shropshire", "Beverley, East Yorkshire",
  "Chepstow, Monmouthshire", "Dunblane, Perthshire", "Alnwick, Northumberland", "Bakewell, Derbyshire",
  "Framlingham, Suffolk", "Llandeilo, Carmarthenshire", "Melrose, Roxburghshire", "Wells, Somerset",
] as const;

const OFFICE_STREETS = [
  "Fenmarket Court", "Corn Exchange Yard", "Sessions House Lane", "Tanyard Wharf",
  "Weavers Gate", "Bishopfield Road", "Quarryman Row", "Signal Box Way",
] as const;

/**
 * The whole register, ordered as the directory lists it: alphabetically by
 * company name, which is how a person reads a directory and what the A-Z
 * index is for. Nothing here reads the lab seed -- a manifest's expected
 * records are literal text, so the register must be identical on every run.
 */
export const companyEntries: readonly CompanyEntry[] = Array
  .from({ length: SECTORS.length * PER_SECTOR }, (_unused, index) => entry(index))
  .sort((left, right) => left.name.localeCompare(right.name));

/** The sector names the register uses, in the order the sector list offers them. */
export const companySectors: readonly string[] = SECTORS.map(({ name }) => name);

/** The headcount bands the size filter offers, largest last; a company outside its sector's profile never carries one. */
export const companyBands: readonly string[] = ["1\u201310", "11\u201350", "51\u2013200", "201\u2013500", "501\u20131,000", "1,001+"];

export function companyBySlug(slug: string): CompanyEntry | undefined {
  return companyEntries.find((candidate) => candidate.slug === slug);
}

function entry(index: number): CompanyEntry {
  const sector = SECTORS[Math.floor(index / PER_SECTOR) % SECTORS.length];
  const prefix = PREFIXES[index % PER_SECTOR];
  if (!sector || !prefix) throw new Error(`company-directory: no entry at ${index}`);
  const name = `${prefix} ${sector.suffix}`;
  const slug = name.toLowerCase().replaceAll(" ", "-");
  const location = pick(LOCATIONS, index, 37);
  return {
    slug,
    name,
    sector: sector.name,
    location,
    // A company that has never filed a headcount has no band at all, which is
    // an empty cell in the table and no row on the profile.
    ...(mix(index, 31) % 9 === 4 ? {} : { employeeBand: pick(sector.bands, index, 61) }),
    founded: 1968 + (mix(index, 53) % 55),
    website: `${slug}.example`,
    telephone: telephoneOf(index),
    registeredOffice: `Unit ${1 + (mix(index, 89) % 40)}, ${pick(OFFICE_STREETS, index, 97)}, ${location.split(",")[0] ?? location}`,
  };
}

/** A landline written the way a directory prints one: a dialling code, then two groups of three. */
function telephoneOf(index: number): string {
  const code = 1_200 + (mix(index, 71) % 700);
  const line = 100_000 + (mix(index, 79) % 900_000);
  return `0${code} ${String(line).slice(0, 3)} ${String(line).slice(3)}`;
}

function pick<TValue>(values: readonly TValue[], index: number, salt: number): TValue {
  const value = values[mix(index, salt) % values.length];
  if (value === undefined) throw new Error("A company register cycle must not be empty");
  return value;
}

/** Knuth's multiplicative hash of `index + salt`, kept to its high 24 bits so neighbouring indices do not land together. */
function mix(index: number, salt: number): number {
  return (((index + salt) * 2_654_435_761) >>> 0) >>> 8;
}
