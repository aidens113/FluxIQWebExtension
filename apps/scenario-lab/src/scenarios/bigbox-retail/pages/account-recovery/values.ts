/**
 * What the "Forgot your password?" panel shows that the site itself keeps
 * hidden, word for word: the security details inside its group marked
 * `data-sensitive`, the saved password hint, the one-time code, the address a
 * reset link goes to, and the masked card details the saved-cards section
 * marks hidden. All of it is made up for this fictional store, and none of it
 * may leave the page in anything a recorder or a snapshot sends.
 *
 * Exported so a browser test can search a whole serialized reply for every
 * one of these strings rather than restating them.
 */
export const ACCOUNT_RECOVERY_VALUES = {
  /** The two answers the hidden "Security answer" select offers, as option values and as the words it renders. */
  securityAnswers: [
    { value: "sa-larkspur-court", label: "Larkspur Court" },
    { value: "sa-fenwick-road", label: "Fenwick Road" },
  ],
  /** The text of the saved password hint, a `data-sensitive` textarea. */
  passwordHint: "Our first dog, then the street we met on",
  /** The one-time code the code select holds (`autocomplete="one-time-code"`), as its value and its words. */
  oneTimeCode: { value: "vc-604218", label: "604 218" },
  /** The address the reset-link button names, marked hidden inside the button's own text. */
  resetEmail: "d.whitfield.home@example.net",
  /** Masked card details, each in a `data-sensitive` span inside the text that names, heads or labels something else. */
  savedCardsHeading: "Visa ending in 4417",
  cardColumn: "Mastercard ending in 5523",
  billingAddress: "418 Larch Hollow Road",
  nicknameCard: "Discover ending in 7781",
  billingZip: "60614-2207",
} as const;
