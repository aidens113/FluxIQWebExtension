import type { ExpectedFact, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { storeById } from "../catalog/index.js";
import { marketClasses } from "../styles/index.js";
import { MARKET_SEED } from "./answers.js";
import { cartCount, FIRST_VISIT, ordersShipped } from "./facts.js";
import { SITE_NOISE } from "./site-noise.js";
import { ARRIVE, OPEN_OFFICIAL_LISTING } from "./steps.js";

const c = marketClasses(MARKET_SEED, "baseline");

/** How the account flyout lists followed stores, given their ids in the order followed (`markup/flyouts.ts`). */
const followedText = (storeIds: readonly string[]) => `Followed stores: ${storeIds.map((storeId) => storeById(storeId).name).join("; ")}`;

/** The three stores the account follows on a first visit (`state/create.ts`), and the list once the official store is added. */
const FOLLOWED_AT_START = followedText(["hubsmith", "mirafone", "qinport"]);
const FOLLOWED_AFTER = followedText(["hubsmith", "mirafone", "qinport", "voltbay-official"]);

const followed = (id: string, value: string): ExpectedFact => ({ id, subject: "followed-stores", predicate: "text", value });

/**
 * Open the official listing from the results -- not the lookalike "VoltBay
 * Store" under the same title -- press Follow on its store card, and read the
 * account's list back. Following is a toggle, so a second press undoes it.
 */
const SCRIPT: ScenarioWorkflow["recordingScript"] = [
  ...ARRIVE,
  ...OPEN_OFFICIAL_LISTING,
  { id: "follow-press", operation: "click", target: `.${c.sideCard} >> text="Follow"` },
  { id: "follow-confirmed", operation: "waitForState", target: `.${c.sideCard} >> text="Following"`, timeoutMs: 5000 },
  { id: "follow-show-account", operation: "click", target: 'span:has(> b:text-is("Mara"))' },
  { id: "follow-account-visible", operation: "waitForState", target: "testid:followed-stores", timeoutMs: 5000 },
  { id: "extract-followed-stores", operation: "extract", target: "testid:followed-stores", fields: { following: ":scope" } },
  { id: "follow-official-store-done", operation: "checkpoint" },
];

/** A lasting act: follow Voltbay Official Store, keep the stores already followed, follow nothing else, fill no cart. */
export const followOfficialStoreWorkflow: ScenarioWorkflow = {
  id: "follow-official-store",
  recordingDescription: "Demonstrates following a seller from its product page and reviewing the account's followed stores.",
  description: "Follow Voltbay Official Store, keeping the three stores already followed and following no other, and report how the account lists them.",
  recordingScript: SCRIPT,
  expected: {
    pageFacts: [...FIRST_VISIT, followed("follow-start-three-stores", FOLLOWED_AT_START)],
    extracted: [{ step: "extract-followed-stores", count: 1, records: [{ following: FOLLOWED_AFTER }] }],
    finalState: [followed("follow-official-added", FOLLOWED_AFTER), cartCount(0), ordersShipped(0)],
    allowedConsoleErrors: SITE_NOISE,
  },
};
