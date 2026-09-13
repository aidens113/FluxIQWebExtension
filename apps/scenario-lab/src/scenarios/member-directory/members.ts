import type { DirectoryMember, MemberRole } from "./types.js";

/** How many people the workspace has. Large enough that the table, not the shell, is the page. */
export const ROSTER_SIZE = 240;

// Sixteen given names and fifteen family names, both in alphabetical order, so
// the roster is exactly 240 people and the table's default Name order is the
// order they are generated in. The lab seed does not reach any of this: a
// manifest's expected records are literal text, so the roster must be the same
// on every run.
const GIVEN_NAMES = [
  "Amara", "Clara", "Desmond", "Elena", "Felix", "Ingrid", "Joon", "Leila",
  "Marcus", "Naomi", "Otto", "Priya", "Rafael", "Sofia", "Tomas", "Yusuf",
] as const;
const FAMILY_NAMES = [
  "Barros", "Bright", "Castellano", "Duval", "Ferris", "Hollis", "Krause", "Lindqvist",
  "Mehta", "Nakamura", "Okafor", "Oyelaran", "Salinas", "Vance", "Whitfield",
] as const;

/** Eleven roles in a repeating cycle: mostly Member, with the odd Admin. Index 0 is the workspace Owner and is not in the cycle. */
const ROLE_CYCLE: readonly MemberRole[] = [
  "Member", "Member", "Admin", "Member", "Read only", "Member",
  "Member", "Billing admin", "Member", "Admin", "Member",
];
/** The teams a member can belong to, in the order the edit dialog offers them. */
export const teamNames = ["Platform", "Growth", "Support", "Data", "Design", "Security", "Finance"] as const;
const ACTIVITY_CYCLE = [
  { minutes: 2, label: "2 minutes ago" },
  { minutes: 18, label: "18 minutes ago" },
  { minutes: 60, label: "1 hour ago" },
  { minutes: 240, label: "4 hours ago" },
  { minutes: 1_440, label: "Yesterday" },
  { minutes: 4_320, label: "3 days ago" },
  { minutes: 20_160, label: "2 weeks ago" },
  { minutes: 43_200, label: "1 month ago" },
] as const;
const NEVER_ACTIVE = { minutes: Number.MAX_SAFE_INTEGER, label: "Never" } as const;

/**
 * The whole workspace, in the console's default order: by the name the table
 * shows, which is what a member list is sorted by and what the page's own Name
 * sort reproduces.
 */
export const directoryMembers: readonly DirectoryMember[] = Array.from({ length: ROSTER_SIZE }, (_unused, index) => member(index))
  .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

/** The member the recorded workflows act on: a Member the edit workflow promotes to Admin. */
export const RECORDED_MEMBER: DirectoryMember = memberById("usr_" + identifier(91));

export function memberById(id: string): DirectoryMember {
  const found = directoryMembers.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No console member ${id}`);
  return found;
}

function member(index: number): DirectoryMember {
  const given = cycle(GIVEN_NAMES, index);
  const family = FAMILY_NAMES[Math.floor(index / GIVEN_NAMES.length)] ?? "Bright";
  const status = index % 19 === 5 ? "Suspended" : index % 7 === 3 ? "Invited" : "Active";
  const activity = status === "Invited" ? NEVER_ACTIVE : cycle(ACTIVITY_CYCLE, index);
  return {
    id: `usr_${identifier(index)}`,
    name: `${given} ${family}`,
    initials: `${given.slice(0, 1)}${family.slice(0, 1)}`,
    email: `${given.toLowerCase()}.${family.toLowerCase()}@halden-robotics.test`,
    role: index === 0 ? "Owner" : cycle(ROLE_CYCLE, index),
    team: cycle(teamNames, index),
    status,
    activeMinutes: activity.minutes,
    lastActive: activity.label,
  };
}

/**
 * An opaque six-hex account id, as a real console shows rather than a row
 * number. Knuth's multiplicative constant is odd, so the low 24 bits are a
 * bijection and no two members can collide.
 */
function identifier(index: number): string {
  return (((index + 7) * 2_654_435_761) % 16_777_216).toString(16).padStart(6, "0");
}

function cycle<TValue>(values: readonly TValue[], index: number): TValue {
  const value = values[index % values.length];
  if (value === undefined) throw new Error("A member cycle must not be empty");
  return value;
}
