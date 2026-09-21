import { MEMBERS } from "./members.js";
import type { Member } from "../types.js";

/** The one member with this display name. Names used for invitations and conversations are unique; a missing one is an authoring error. */
export function memberNamed(name: string): Member {
  const matches = MEMBERS.filter((member) => member.name === name);
  if (matches.length !== 1) throw new Error(`professional-network: ${matches.length} members are called ${name}`);
  return matches[0]!;
}

export function memberByUrn(urn: string): Member | undefined {
  return MEMBERS.find((member) => member.urn === urn);
}

export function memberBySlug(slug: string): Member | undefined {
  return MEMBERS.find((member) => member.slug === slug && !member.hidden);
}
