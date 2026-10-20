/**
 * What the `saved-logins` login page shows that the site itself keeps hidden,
 * word for word: the remembered sign-in it pre-fills, the password hint and
 * the security answer the login form offers, the passwords the accounts on
 * this device are remembered with, the backup codes, the recent login codes,
 * and the recovery note. All of it is made up for this fictional network, and
 * none of it may leave the page in anything a recorder, a read or a snapshot
 * sends.
 *
 * Exported so a browser test can search a whole serialized reply for every one
 * of these strings rather than restating them.
 */
export const SAVED_LOGINS_VALUES = {
  /** The username the login form is pre-filled with: ordinary, and read like any field. */
  username: "tamsin.reyes",
  /** The remembered password the login form's password field is served with, as its `value` attribute. */
  password: "kelp-lantern-0417",
  /** The text of the password hint, a `data-sensitive` textarea inside the login form. */
  passwordHint: "The boat Grandad named, then the year we moved",
  /** The security answer, a `data-sensitive` select's one option, as its value and its words. */
  securityAnswer: { value: "sq-wren-cottage", label: "Wren Cottage" },
  /**
   * The accounts this device remembers: each a row of the handle, when it was
   * last used, and a password field served with the remembered password and
   * marked by its type alone.
   */
  accounts: [
    { handle: "tamsin.reyes", lastUsed: "Last used 2 days ago", password: "kelp-lantern-0417" },
    { handle: "tamsin.makes", lastUsed: "Last used 3 weeks ago", password: "driftwood-quay-2291" },
    { handle: "reyes.family", lastUsed: "Last used in August", password: "orchard-gate-7730" },
  ],
  /** Backup codes, each the whole of its row: a password field served with the code. */
  backupCodes: ["6204 1187", "9351 4402", "2768 0593"],
  /** The recent login codes a `data-sensitive` list box offers, as its options' words. */
  loginCodes: ["481 093", "772 510"],
  /** The recovery note, a `data-sensitive` editable region: its words, and a phone number held in a `<data>` value inside it. */
  recoveryNote: { words: "Spare phone is with", contact: "Aunt Rosalind", phone: "+44 7700 900461" },
} as const;
