/**
 * The business register's vocabulary: what a company entry is, what the
 * register can be browsed by, and the renderings the fixture can be armed
 * into.
 *
 * `baseline` is the register as it ships. The two armed renderings are each
 * one thing a directory does between a recording and a run:
 *
 * - `relabelled-columns` -- the table was relabelled and reordered. Sector is
 *   now headed "Industry", Employees "Team size", and Location moved in front
 *   of Industry. Every value is the value it was, so a read that follows the
 *   words has to follow them somewhere else.
 * - `resectored` -- the register renamed one of its sectors. "Logistics" is
 *   now "Transport and logistics", in the sector list and in every entry's
 *   row, so a recording that clicked the old link finds nothing to click.
 */
export const companyVariants = ["baseline", "relabelled-columns", "resectored"] as const;

export type CompanyVariant = (typeof companyVariants)[number];

/**
 * One entry in the register. `employeeBand` is absent for a company that has
 * never filed a headcount, which is ordinary in a directory rather than an
 * error: its cell in the table is empty and its profile has no row for it.
 * `founded`, `website` and `telephone` appear only on the profile page.
 */
export type CompanyEntry = {
  slug: string;
  name: string;
  sector: string;
  location: string;
  employeeBand?: string;
  founded: number;
  website: string;
  telephone: string;
  registeredOffice: string;
};

/** What the register is being asked for. Empty strings are "any", as each control's first option is. */
export type CompanyBrowse = {
  page: number;
  letter: string;
  sector: string;
  size: string;
  query: string;
};

/** One page of entries for a browse; `browse.page` is clamped to `pageCount`. */
export type CompanyResults = {
  browse: CompanyBrowse;
  matchCount: number;
  pageCount: number;
  entries: readonly CompanyEntry[];
};

export type CompanyDirectoryState = {
  variant: CompanyVariant;
  /** The browse last served. The start page itself always shows the whole register from the top. */
  browse: CompanyBrowse;
  /** What `browse` yields under `variant`: the oracle a run's final state is checked against. */
  oracle: { matchCount: number; pageCount: number; slugs: string[] };
  /** Every browse served, oldest first, capped. */
  browseHistory: CompanyBrowse[];
  /** Slugs of profiles opened, oldest first, capped. */
  profileViews: string[];
};
