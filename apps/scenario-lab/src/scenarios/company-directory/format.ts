import type { CompanyEntry, CompanyVariant } from "./types.js";

/** The register's front page. Profile links are written root-relative from here, so their `href` text is the same on every run's port. */
export const COMPANY_ROOT = "/scenarios/company-directory/";

/**
 * The sector the register renamed, and what it renamed it to. Only the name
 * changes: the sector's code, which its link and the query string carry, is
 * what it always was, which is exactly how a directory ships a rename.
 */
export const RENAMED_SECTOR = { from: "Logistics", to: "Transport and logistics" } as const;

/** What the register calls `sector` under `variant`. */
export function sectorLabel(sector: string, variant: CompanyVariant): string {
  return variant === "resectored" && sector === RENAMED_SECTOR.from ? RENAMED_SECTOR.to : sector;
}

/** A sector's code: stable across renamings, and what the sector link and the query string carry. */
export function sectorCode(sector: string): string {
  return sector.toLowerCase().replaceAll(" ", "-");
}

export function profilePath(entry: CompanyEntry): string {
  return `${COMPANY_ROOT}companies/${entry.slug}`;
}

/** The letter of the A-Z index an entry is filed under. */
export function letterOf(entry: CompanyEntry): string {
  return entry.name.slice(0, 1).toUpperCase();
}

/** One column of the register table: the heading it is under and the value it holds. */
export type RegisterColumn = { heading: string; field: "name" | "sector" | "location" | "employees" };

/**
 * The table's columns under `variant`. `relabelled-columns` is the register
 * after a redesign: Sector is headed "Industry", Employees "Team size", and
 * Location has moved in front of the industry. Every cell still holds the
 * value it held, so a read that follows the headings still has somewhere to
 * follow them to, and a read that counted on their order does not.
 */
export function registerColumns(variant: CompanyVariant): readonly RegisterColumn[] {
  return variant === "relabelled-columns"
    ? [
      { heading: "Company", field: "name" },
      { heading: "Location", field: "location" },
      { heading: "Industry", field: "sector" },
      { heading: "Team size", field: "employees" },
    ]
    : [
      { heading: "Company", field: "name" },
      { heading: "Sector", field: "sector" },
      { heading: "Location", field: "location" },
      { heading: "Employees", field: "employees" },
    ];
}
