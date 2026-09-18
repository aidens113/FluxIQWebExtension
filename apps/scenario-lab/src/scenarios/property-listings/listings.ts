import type { PropertyListing } from "./types.js";

/**
 * How many homes the portal has on the market. Large enough that a search has
 * to be narrowed before it is worth reading, and that reading one of those
 * narrowed searches means following pagination to its end.
 */
export const PROPERTY_COUNT = 288;

/** The five areas the portal covers, in the order the Area select offers them. */
export const propertyAreas = ["Ashcombe", "Kelford", "Marlow Cross", "Riverhead", "Tenby Fields"] as const;

/** What an asking price starts from in each area before bedrooms and the street are counted. */
const AREA_FLOOR_GBP: Readonly<Record<string, number>> = {
  Ashcombe: 168_000, Kelford: 118_000, "Marlow Cross": 241_000, Riverhead: 296_000, "Tenby Fields": 196_000,
};

const STREETS = [
  "Bramble Way", "Cathedral Rise", "Drovers Lane", "Eastgate Terrace", "Foundry Walk",
  "Granary Close", "Hollybank Road", "Ironstone Avenue", "Juniper Mews", "Kilnfield Drive",
  "Lantern Court", "Marsh End", "Nightingale Row", "Old Quarry Lane", "Pennant Street",
  "Quarry Bank", "Rookery Hill", "Saltmarsh Crescent", "Tanners Yard", "Vicarage Green",
] as const;

const PROPERTY_TYPES = ["Terraced house", "Semi-detached house", "Detached house", "Flat", "Maisonette", "Bungalow"] as const;

const AGENTS = [
  "Ashdown & Vale", "Crossley Kent", "Kerrigan Property", "Northgate Residential",
  "Pemberton & Co", "Selby Hume", "Waterline Homes",
] as const;

/** Bedrooms, weighted the way a market is: mostly two and three, a few of everything else. */
const BEDROOM_CYCLE = [1, 2, 2, 3, 3, 4, 5] as const;

/** How long ago a home was listed, in days. Seven days or fewer is what "new this week" means. */
const LISTED_DAYS = [0, 1, 2, 3, 4, 6, 7, 9, 12, 18, 26, 41] as const;

const EPC_RATINGS = ["B", "C", "D", "E"] as const;

/**
 * The whole market, in the order the portal generated it. Nothing here reads
 * the lab seed: a manifest's expected records are literal text, so the market
 * must be identical on every run.
 *
 * Every attribute is drawn with its own salt through `pick`, so no two of them
 * move together. Drawing them all from `index` directly would make a page of
 * results that shares a listing date share a property type and an agent as
 * well, which is not what a portal looks like.
 */
export const propertyListings: readonly PropertyListing[] = Array.from({ length: PROPERTY_COUNT }, (_unused, index) => listing(index));

export function listingByReference(reference: string): PropertyListing | undefined {
  return propertyListings.find((candidate) => candidate.reference === reference);
}

function listing(index: number): PropertyListing {
  const area = pick(propertyAreas, index, 17);
  const bedrooms = pick(BEDROOM_CYCLE, index, 83);
  const propertyType = pick(PROPERTY_TYPES, index, 101);
  const leasehold = propertyType === "Flat" || propertyType === "Maisonette";
  const reference = `HB-${10_243 + index * 3}`;
  return {
    reference,
    slug: reference.toLowerCase(),
    address: addressOf(index, area, leasehold),
    area,
    bedrooms,
    propertyType,
    priceGbp: priceOf(index, area, bedrooms),
    ...(mix(index, 16) % 9 === 4 ? {} : { floorAreaSqFt: 420 + bedrooms * 285 + (mix(index, 223) % 13) * 35 }),
    agent: pick(AGENTS, index, 131),
    listedDaysAgo: pick(LISTED_DAYS, index, 149),
    tenure: leasehold ? "Leasehold" : "Freehold",
    epcRating: pick(EPC_RATINGS, index, 167),
    newBuild: mix(index, 2) % 11 === 3,
  };
}

/** A flat carries its own number, as a portal writes it; a house is a number on a street. */
function addressOf(index: number, area: string, leasehold: boolean): string {
  const street = `${1 + (mix(index, 59) % 120)} ${pick(STREETS, index, 41)}`;
  const flat = leasehold ? `Flat ${1 + (mix(index, 239) % 8)}, ` : "";
  return `${flat}${street}, ${area}`;
}

/**
 * The asking price: the area's floor, the bedrooms, and where on the street it
 * is, rounded to the nearest 2,500 as an agent prices a home. A five-bedroom
 * home therefore starts above 430,000 everywhere, which is what makes "five
 * bedrooms up to 250,000" a search with no answer rather than a small one.
 */
function priceOf(index: number, area: string, bedrooms: number): number {
  const floor = AREA_FLOOR_GBP[area] ?? 200_000;
  return Math.round((floor + bedrooms * 62_500 + (mix(index, 181) % 23) * 8_000) / 2_500) * 2_500;
}

/** One value of `values` for this listing, drawn with `salt` so each attribute varies independently of the others. */
function pick<TValue>(values: readonly TValue[], index: number, salt: number): TValue {
  const value = values[mix(index, salt) % values.length];
  if (value === undefined) throw new Error("A property listing cycle must not be empty");
  return value;
}

/** Knuth's multiplicative hash of `index + salt`, kept to its high 24 bits so neighbouring indices do not land together. */
function mix(index: number, salt: number): number {
  return (((index + salt) * 2_654_435_761) >>> 0) >>> 8;
}
