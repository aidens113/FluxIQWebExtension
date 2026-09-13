import { directoryMembers, RECORDED_MEMBER } from "./members.js";
import { ROLE_OPTIONS, STATUS_OPTIONS, type FilterOption } from "./options.js";
import type { DirectoryMember, DirectoryMode, MemberFilters, MemberRole } from "./types.js";

/**
 * The roster a rendering shows. `member-left` drops the person the recorded
 * workflows act on; `sorted-by-activity` keeps everyone and changes the order,
 * most recently active first, ties broken by the default Name order.
 */
export function rosterFor(mode: DirectoryMode): readonly DirectoryMember[] {
  if (mode === "member-left") return directoryMembers.filter((candidate) => candidate.id !== RECORDED_MEMBER.id);
  if (mode === "sorted-by-activity") return [...directoryMembers].sort((left, right) => left.activeMinutes - right.activeMinutes);
  return directoryMembers;
}

/** Search matches a name or an email; the two selects match a label exactly. Empty means "any", as the first option does. */
export function filterMembers(members: readonly DirectoryMember[], filters: MemberFilters): DirectoryMember[] {
  const needle = filters.search.trim().toLowerCase();
  const role = labelFor(ROLE_OPTIONS, filters.role);
  const status = labelFor(STATUS_OPTIONS, filters.status);
  return members.filter((member) =>
    (needle === "" || member.name.toLowerCase().includes(needle) || member.email.includes(needle))
    && (role === undefined || member.role === role)
    && (status === undefined || member.status === status));
}

/** What the page header counts: the whole roster, its admins, and the invitations nobody has accepted. */
export function rosterCounts(members: readonly DirectoryMember[]): { memberCount: number; adminCount: number; pendingCount: number } {
  return {
    memberCount: members.length,
    adminCount: members.filter((member) => member.role === "Admin").length,
    pendingCount: members.filter((member) => member.status === "Invited").length,
  };
}

/** The header stat line, which is also the oracle a final-state fact reads. */
export function statsText(members: readonly DirectoryMember[]): string {
  const { memberCount, adminCount, pendingCount } = rosterCounts(members);
  return `${memberCount} members \u00b7 ${adminCount} admins \u00b7 ${pendingCount} pending`;
}

export function resultCountText(shown: number, total: number): string {
  return `Showing ${shown} of ${total} members`;
}

export function sortStatusText(mode: DirectoryMode): string {
  return mode === "sorted-by-activity" ? "Sorted by Last active" : "Sorted by Name";
}

/** The roster after a run's own changes, so the oracle is what the page would now show. */
export function applyChanges(members: readonly DirectoryMember[], roles: Record<string, MemberRole>, removed: readonly string[]): DirectoryMember[] {
  const gone = new Set(removed);
  return members
    .filter((member) => !gone.has(member.id))
    .map((member) => {
      const role = roles[member.id];
      return role === undefined ? member : { ...member, role };
    });
}

function labelFor(options: readonly FilterOption[], value: string): string | undefined {
  if (value === "") return undefined;
  return options.find((option) => option.value === value)?.label;
}
