import type { Listing } from "../types.js";

/** Condition filter codes, as the marketplace's URLs carry them. */
export const CONDITION_CODES: Readonly<Record<string, Listing["condition"]>> = {
  "3000": "Pre-owned",
  "2500": "Seller refurbished",
  "7000": "For parts or not working",
};

/** Sort codes: Best Match, ending soonest, newly listed, lowest price plus postage. */
export const SORTS = [
  { code: "12", label: "Best Match" },
  { code: "1", label: "Time: ending soonest" },
  { code: "10", label: "Time: newly listed" },
  { code: "15", label: "Price + postage: lowest first" },
] as const;

export const PAGE_SIZES = [24, 48, 96] as const;

/**
 * What a results URL asks for. Every field has a URL parameter of the shape a
 * real auction site uses; `format` is the buying-format tab.
 */
export type SearchParams = {
  query: string;
  format: "all" | "auction" | "bin";
  conditions: string[];
  models: string[];
  types: string[];
  minPrice: number | null;
  maxPrice: number | null;
  sort: string;
  page: number;
  perPage: number;
};

export function parseSearchParams(query: URLSearchParams): SearchParams {
  const list = (name: string) => (query.get(name) ?? "").split("|").map((value) => value.trim()).filter(Boolean);
  const pounds = (name: string) => {
    const text = (query.get(name) ?? "").replace(/[£,\s]/gu, "");
    return /^\d+(\.\d{1,2})?$/u.test(text) ? Math.round(Number(text) * 100) : null;
  };
  const perPage = Number(query.get("_ipg"));
  const page = Number(query.get("_pgn"));
  const sort = query.get("_sop") ?? "12";
  return {
    query: (query.get("_nkw") ?? "").trim(),
    format: query.get("LH_Auction") === "1" ? "auction" : query.get("LH_BIN") === "1" ? "bin" : "all",
    conditions: list("LH_ItemCondition").filter((code) => code in CONDITION_CODES),
    models: list("Model"),
    types: list("Type"),
    minPrice: pounds("_udlo"),
    maxPrice: pounds("_udhi"),
    sort: SORTS.some((option) => option.code === sort) ? sort : "12",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    perPage: (PAGE_SIZES as readonly number[]).includes(perPage) ? perPage : 24,
  };
}

/** The URL query for `params`, in a fixed parameter order so the same search always has the same address. */
export function searchQueryString(params: SearchParams): string {
  const query = new URLSearchParams();
  query.set("_nkw", params.query);
  if (params.format === "auction") query.set("LH_Auction", "1");
  if (params.format === "bin") query.set("LH_BIN", "1");
  if (params.conditions.length > 0) query.set("LH_ItemCondition", params.conditions.join("|"));
  if (params.models.length > 0) query.set("Model", params.models.join("|"));
  if (params.types.length > 0) query.set("Type", params.types.join("|"));
  if (params.minPrice !== null) query.set("_udlo", String(params.minPrice / 100));
  if (params.maxPrice !== null) query.set("_udhi", String(params.maxPrice / 100));
  if (params.sort !== "12") query.set("_sop", params.sort);
  if (params.page > 1) query.set("_pgn", String(params.page));
  if (params.perPage !== 24) query.set("_ipg", String(params.perPage));
  return query.toString();
}

