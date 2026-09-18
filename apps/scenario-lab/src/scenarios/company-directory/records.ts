import { profilePath, sectorLabel } from "./format.js";
import type { CompanyEntry, CompanyVariant } from "./types.js";

/**
 * What a read of the register table yields for `entries` under `variant`. A
 * company that has never filed a headcount has no element in its Employees
 * cell, so nothing is read rather than something read as blank. `withUrl`
 * adds the profile link's address, which is an attribute rather than text.
 */
export function registerRecords(entries: readonly CompanyEntry[], variant: CompanyVariant, withUrl = false): Array<Record<string, string | null>> {
  return entries.map((entry) => {
    const record: Record<string, string | null> = {
      name: entry.name,
      sector: sectorLabel(entry.sector, variant),
      location: entry.location,
      employees: entry.employeeBand ?? null,
    };
    if (withUrl) record.url = profilePath(entry);
    return record;
  });
}

/** What a read of a company's profile yields: its name and sector, and the four facts the table does not carry. */
export function profileRecords(entries: readonly CompanyEntry[], variant: CompanyVariant): Array<Record<string, string | null>> {
  return entries.map((entry) => ({
    name: entry.name,
    sector: sectorLabel(entry.sector, variant),
    employees: entry.employeeBand ?? null,
    founded: String(entry.founded),
    website: entry.website,
    telephone: entry.telephone,
  }));
}

/** What the per-row enrichment collects from each profile it opens: the two facts the register table has no column for. */
export function enrichmentRecords(entries: readonly CompanyEntry[]): Array<Record<string, string | null>> {
  return entries.map((entry) => ({ name: entry.name, founded: String(entry.founded), website: entry.website }));
}
