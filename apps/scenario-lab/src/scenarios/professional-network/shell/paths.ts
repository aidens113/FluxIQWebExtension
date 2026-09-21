import type { Member } from "../types.js";

/** Where the site lives. Every link on it is written from here, the way a real app writes root-relative links. */
export const ROOT = "/scenarios/professional-network/";

/**
 * A member's profile address as a results card links it: the slug, and the
 * tracking parameters a real results page appends, which differ by position.
 */
export function profileHref(member: Member, tracking?: { origin: string; position: number }): string {
  const base = `${ROOT}in/${member.slug}/`;
  return tracking ? `${base}?trk=${tracking.origin}&position=${tracking.position}` : base;
}
