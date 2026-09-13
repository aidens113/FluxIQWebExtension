import type { IdentifierPolicy } from "../../identifier-policy/index.js";

/**
 * The console's vocabulary: what a member is, what the page can be filtered
 * by, and the renderings the fixture can be armed into.
 *
 * `baseline` is the console as it ships. The four armed renderings are each
 * one thing a real deployment does between a recording and a run:
 *
 * - `restyled` -- the CSS-in-JS build hash moved, so every generated class
 *   name on the page is different and nothing else is. It is the one drift a
 *   class-set matcher cannot survive, and the reason this fixture exists.
 * - `member-left` -- the person the recording was made against is no longer in
 *   the workspace, so the row and its action button are simply gone.
 * - `support-drawer` -- the help widget is open, docked over the right-hand
 *   edge of the console, covering whatever the page has there.
 * - `sorted-by-activity` -- the workspace default sort moved from Name to Last
 *   active, so the same members are listed in a different order.
 */
export const directoryModes = ["baseline", "restyled", "member-left", "support-drawer", "sorted-by-activity"] as const;

export type DirectoryMode = (typeof directoryModes)[number];

/** Every role the workspace grants, as the table and the edit dialog spell them. */
export const memberRoles = ["Owner", "Admin", "Member", "Billing admin", "Read only"] as const;

export type MemberRole = (typeof memberRoles)[number];

export type MemberStatus = "Active" | "Invited" | "Suspended";

/** One row of the members table. `activeMinutes` is the sort key `lastActive` is written from. */
export type DirectoryMember = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: MemberRole;
  team: string;
  status: MemberStatus;
  activeMinutes: number;
  lastActive: string;
};

/** What the toolbar is asking for. Empty strings are "any", as the selects' first options are. */
export type MemberFilters = { search: string; role: string; status: string };

/**
 * What the run left behind. `roles` and `removed` are the changes the page
 * reported through `mutate`; `oracle` is the roster those changes produce, so
 * a run's final state can be checked without replaying the page's arithmetic.
 */
export type MemberDirectoryState = {
  mode: DirectoryMode;
  /**
   * How much of the console's identifier surface this rendering keeps.
   *
   * A separate axis from `mode`, and composed with it: a mode changes what the
   * console *is* -- restyled, a member gone, the drawer open -- while this
   * changes only what a recorder can see of it. `set-identifiers` arms it.
   * See `identifier-policy/policies.ts` for what each policy removes and why.
   */
  identifiers: IdentifierPolicy;
  roles: Record<string, MemberRole>;
  removed: string[];
  /** Operations the page reported, oldest first, capped. */
  activity: string[];
  oracle: { memberCount: number; adminCount: number; pendingCount: number };
};
