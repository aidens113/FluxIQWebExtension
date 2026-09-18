import type { InboxAccount } from "./types.js";

/**
 * The six accounts this workspace watches.
 *
 * Three of them are called "Harbor & Pine" *and* answer to `@harborandpine`:
 * the same brand holds the same handle on three networks, which is what a real
 * brand does. Nothing but the network separates them, so the account cell
 * cannot be keyed on a name or a handle, and the toolbar's option value
 * carries the network for the same reason.
 *
 * The list is authored and identical for every lab seed: the manifest's
 * expected records are literal text, so an account's cell must read the same
 * on every run.
 */
export const inboxAccounts: readonly InboxAccount[] = [
  account("@harborandpine", "Chirp", "Harbor & Pine"),
  account("@harborandpine", "Photogram", "Harbor & Pine"),
  account("@harborandpine", "Linkline", "Harbor & Pine"),
  account("@harborpine-cafe", "Photogram", "Harbor & Pine Café"),
  account("@hp-roasters", "Chirp", "Harbor & Pine Roasters"),
  account("@hp-wholesale", "Linkline", "Harbor & Pine Wholesale"),
];

export function inboxAccountById(id: string): InboxAccount {
  const found = inboxAccounts.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No watched account ${id}`);
  return found;
}

export function inboxAccountBySlug(slug: string): InboxAccount | undefined {
  return inboxAccounts.find((candidate) => candidate.slug === slug);
}

/** The account cell's whole text: the name, then the network, then the handle. The first two are shared; only all three together are not. */
export function inboxAccountCellText(account: InboxAccount): string {
  return `${account.display} ${account.network} · ${account.handle}`;
}

/** The label the toolbar and the assignment dialog offer for an account, which has to name the network to be unambiguous. */
export function inboxAccountOptionLabel(account: InboxAccount): string {
  return `${account.display} · ${account.network} · ${account.handle}`;
}

function account(handle: string, network: string, display: string): InboxAccount {
  const slug = `${network.toLowerCase()}-${handle.slice(1)}`;
  return { id: `wac_${slug}`, handle, network, display, slug };
}
