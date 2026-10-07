import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { STORE_AT_START } from "../records.js";

/** Independently enumerated answer: thirty-three days and older, people only, in Sent order. */
export const staleRequestAuditExpected: ScenarioExpected = {
  pageFacts: [{ id: "audit-starts-with-original-invitations", subject: "invitation-store", predicate: "text", value: STORE_AT_START }],
  extracted: [{ step: "extract-stale-request-audit", count: 12, records: [
    { name: "Aoife Brennan" }, { name: "Mehmet Arslan" }, { name: "Ines Carvalho" },
    { name: "Kees Bakker" }, { name: "Derek Olsen" }, { name: "Fleur Brouwer" },
    { name: "Emre Yilmaz" }, { name: "Freya Lindqvist" }, { name: "Nadia Benali" },
    { name: "Koen Verbeek" }, { name: "Elif Kaya" }, { name: "Marit Dekker" },
  ] }],
  finalState: [{ id: "audit-keeps-invitations", subject: "invitation-store", predicate: "text", value: STORE_AT_START }],
  allowedConsoleErrors: ["status of 429"],
};
