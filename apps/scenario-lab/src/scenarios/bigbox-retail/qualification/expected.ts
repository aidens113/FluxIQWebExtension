import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";

/** Literal answers and account identities, independent of the renderer and facts formatter. */
export const soapQuantityExpected: ScenarioExpected = {
  pageFacts: [{ id: "soapQuantity-start", subject: "bigbox-soap-account", predicate: "text", value: "{\"storeId\":\"2291\",\"cart\":[{\"lineId\":\"L1\",\"productId\":\"418832007\",\"sku\":\"5530601\",\"qty\":1,\"fulfilment\":\"pickup\"}],\"saved\":[],\"nextLine\":2,\"checkout\":\"account-wall\",\"expressOpen\":false,\"orderCount\":0,\"flaggedOrders\":0}" }],
  extracted: [{ step: "extract-soap-quantity", count: 1, records: [{"item": "ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz", "quantity": "3", "price": "$3.97"}] }],
  finalState: [{ id: "soapQuantity-account", subject: "bigbox-soap-account", predicate: "text", value: "{\"storeId\":\"2291\",\"cart\":[{\"lineId\":\"L1\",\"productId\":\"418832007\",\"sku\":\"5530601\",\"qty\":3,\"fulfilment\":\"pickup\"}],\"saved\":[],\"nextLine\":2,\"checkout\":\"account-wall\",\"expressOpen\":false,\"orderCount\":0,\"flaggedOrders\":0}" }],
  allowedConsoleErrors: [],
};
