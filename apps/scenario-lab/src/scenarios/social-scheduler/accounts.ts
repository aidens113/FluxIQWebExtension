import type { ConnectedAccount } from "./types.js";

/**
 * The eight accounts this workspace publishes to.
 *
 * Two pairs are deliberately hard to tell apart, because a real brand's
 * accounts are:
 *
 * - `@northwind-outdoors` and `@northwind.outdoors` are both called "Northwind
 *   Outdoors". Nothing but the network and the handle separates them, so a run
 *   told to post "to Northwind Outdoors on Chirp" has to read past the name.
 * - `@northwind-co` and `@northwind-clips` both abbreviate to "NC", so the
 *   avatar letters in the account cell disambiguate nothing either.
 *
 * The list is authored and identical for every lab seed: the manifest's
 * expected records are literal text, so an account's cell must read the same
 * on every run.
 */
export const connectedAccounts: readonly ConnectedAccount[] = [
  account("@northwind-outdoors", "Chirp", "Northwind Outdoors", "NO"),
  account("@northwind.outdoors", "Photogram", "Northwind Outdoors", "NO"),
  account("@northwind-gear", "Chirp", "Northwind Gear", "NG"),
  account("@northwind-trails", "Photogram", "Northwind Trails", "NT"),
  account("@northwind-co", "Linkline", "Northwind Co", "NC"),
  account("@northwind-clips", "Reelgrid", "Northwind Clips", "NC"),
  account("@northwind-support", "Chirp", "Northwind Support", "NS"),
  account("@northwind-eu", "Chirp", "Northwind Outdoors EU", "NE"),
];

export function accountById(id: string): ConnectedAccount {
  const found = connectedAccounts.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No connected account ${id}`);
  return found;
}

export function accountBySlug(slug: string): ConnectedAccount | undefined {
  return connectedAccounts.find((candidate) => candidate.slug === slug);
}

/**
 * The account cell's whole text, with the avatar letters first because an
 * initials avatar is text in the cell like everything else, then the network,
 * then the handle. The two accounts that share a display name differ here only
 * after the name.
 */
export function accountCellText(account: ConnectedAccount): string {
  return `${account.initials} ${account.display} ${account.network} · ${account.handle}`;
}

/**
 * The select's option value carries the network as well as the handle,
 * because the handle alone is not unique across networks -- which is the
 * point of the two accounts that share a display name.
 */
function account(handle: string, network: string, display: string, initials: string): ConnectedAccount {
  const slug = `${network.toLowerCase()}-${handle.slice(1).replaceAll(".", "-")}`;
  return { id: `acc_${slug}`, handle, network, display, initials, slug };
}
