import { escapeHtml } from "../../html.js";

/**
 * The string planted in every saved card's unlock code. It exists to be looked
 * for: a run bundle that contains it anywhere -- records, snapshot, evidence,
 * validation text -- has carried a sensitive control's value off the page,
 * which is the one thing this list is here to catch. It is deliberately
 * unmistakable rather than realistic, so a scan for it cannot match ordinary
 * page text by accident.
 */
export const PLANTED_UNLOCK_CODE = "PLANTED-UNLOCK-CODE-DO-NOT-EXTRACT";

/**
 * One saved payment method. `label` and `expiry` are the visible card text a
 * person extracting this list would legitimately want; `unlockCode` is the
 * value of a password control sitting in the same item, which no mode of
 * extraction may read (D2).
 */
export type SavedCard = { id: string; label: string; expiry: string; unlockCode: string };

/** The saved cards, authored rather than seeded, so the expected records hold under any lab seed. */
export const savedCards: readonly SavedCard[] = [
  { id: "visa", label: "Visa ending 4242", expiry: "Expires 04/2029", unlockCode: `${PLANTED_UNLOCK_CODE}-4242` },
  { id: "mastercard", label: "Mastercard ending 5454", expiry: "Expires 11/2027", unlockCode: `${PLANTED_UNLOCK_CODE}-5454` },
  { id: "amex", label: "Amex ending 0005", expiry: "Expires 02/2030", unlockCode: `${PLANTED_UNLOCK_CODE}-0005` },
];

/**
 * The saved cards as a repeating structure: visible card text and a password
 * control in every item. The control carries `type="password"`, which is the
 * signature `isSensitiveFieldSignature` reads, so the refusal comes from the
 * shared rule rather than from anything this fixture declares about itself.
 */
export function renderSavedCards(): string {
  const items = savedCards.map((card) => `<li data-testid="card-row">
        <span data-testid="card-label">${escapeHtml(card.label)}</span>
        <span data-testid="card-expiry">${escapeHtml(card.expiry)}</span>
        <label>Unlock code <input type="password" data-testid="card-unlock-code" name="unlock-${escapeHtml(card.id)}" value="${escapeHtml(card.unlockCode)}"></label>
      </li>`).join("");
  return `<section aria-label="Saved cards"><h2>Saved cards</h2><ul data-testid="saved-cards">${items}</ul></section>`;
}
