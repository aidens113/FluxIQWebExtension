import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";

/** Literal answers and account identities, independent of the renderer and facts formatter. */
export const soldSavesExpected: ScenarioExpected = {
  pageFacts: [{ id: "soldSaves-start", subject: "classifieds-sold-saves-account", predicate: "text", value: "{\"saved\":[\"1057533328723847\",\"1030986358004719\"],\"hidden\":[],\"offerCount\":0,\"messageCount\":0,\"contactCount\":0,\"refusedContacts\":0}" }],
  extracted: [{ step: "extract-available-saves", count: 1, records: [{"title": "Adjustable desk lamp, black", "price": "£22", "status": "Available"}] }],
  finalState: [{ id: "soldSaves-account", subject: "classifieds-sold-saves-account", predicate: "text", value: "{\"saved\":[\"1030986358004719\"],\"hidden\":[],\"offerCount\":0,\"messageCount\":0,\"contactCount\":0,\"refusedContacts\":0}" }],
  allowedConsoleErrors: [],
};
