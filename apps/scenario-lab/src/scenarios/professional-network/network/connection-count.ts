import { acceptedPeople } from "../conversations/index.js";
import type { ProfessionalNetworkState } from "../types.js";

/** The connection total the site prints: the 612 the member began with, plus everyone accepted this session. */
export function connectionCount(state: Pick<ProfessionalNetworkState, "accepted">): number {
  return 612 + acceptedPeople(state).length;
}
