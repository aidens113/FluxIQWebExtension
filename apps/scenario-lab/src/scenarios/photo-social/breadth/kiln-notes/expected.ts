import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { UNTOUCHED_ACCOUNT } from "../untouched-account.js";
import { accountFact } from "../account-fact.js";
import { relayFact } from "../relay-fact.js";

/**
 * A new collection, Kiln Theory notes, holding the two Kiln Theory posts the
 * visitor had saved (the celadon diagram of 19 September and the cone chart of
 * 30 August, both also in Studio inspo), and every other collection as it
 * was. Written out from `data/saved.ts` by hand. Both posts are already saved,
 * so their bookmarks are filled: pressing one unsaves it and takes it out of
 * Studio inspo. The studio's own kiln photo of 21 June is saved too, and its
 * alt text says "kiln"; picking it fails the oracle. The table is the Saved
 * page's collection tiles in the order it shows them, All posts left out.
 */
export const kilnNotesExpected: ScenarioExpected = {
  pageFacts: [relayFact("kiln-notes-consent-unanswered", "consent", "pending"), accountFact("kiln-notes-initial-account")],
  finalState: [
    relayFact("kiln-notes-consent-declined", "consent", "essential"),
    relayFact("kiln-notes-never-blocked", "blocked", "clear"),
    accountFact("kiln-notes-account", { collections: [{ name: "Kiln Theory notes", slug: "kiln-theory-notes", codes: ["D1AanlGg31e", "Dn6ixXoKbtq"] }, ...UNTOUCHED_ACCOUNT.collections] }),
  ],
  extracted: [{
    step: "extract-kiln-notes",
    count: 3,
    records: [
      { collection: "Kitchen", posts: "3" },
      { collection: "Studio inspo", posts: "5" },
      { collection: "Kiln Theory notes", posts: "2" },
    ],
  }],
  allowedConsoleErrors: [],
};
