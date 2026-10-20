import { randomBytes } from "node:crypto";
import { HOUSEHOLD, STORE_PATHS } from "../../../scenario-lab/src/scenarios/everything-store/index.js";
import { startScenarioLab } from "../../../scenario-lab/src/server.js";

/** The store's own product photo the network probes ask for, each probe under its own query so the lab counts it apart. */
const PROBED_IMAGE = STORE_PATHS.image(HOUSEHOLD.batteries.sku);

/**
 * The pages the probe opens, all on everything-store in the scenario lab: the
 * printable receipt of an order the returning shopper has just placed (served
 * under a policy that runs no page script), the store's home page (whose own
 * script publishes `window.storeModals` in the page world), and the same home
 * page under `localhost`, a host name the probe extension was never granted.
 * What reached the server is read from the lab's request counter, which no
 * page or script can fake.
 */
export async function startProbePages() {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  const call = async (path: string, body?: unknown): Promise<unknown> => {
    const response = await fetch(`${lab.origin}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (!response.ok) throw new Error(`The lab answered ${response.status} to ${path}.`);
    return response.json();
  };
  try {
    await call("/api/everything-store/start-checkout", { pipeline: "cart" });
    const placed = await call("/api/everything-store/place-order", {}) as { state: { orders: Array<{ orderId: string }> } };
    const orderId = placed.state.orders[0]?.orderId;
    if (!orderId) throw new Error("everything-store placed no order.");
    const asset = (kind: string) => `${PROBED_IMAGE}?v=${kind}`;
    return {
      origin: lab.origin,
      receipt: `${lab.origin}${STORE_PATHS.receipt(orderId)}`,
      store: `${lab.origin}${STORE_PATHS.home}`,
      ungrantedStore: `http://localhost:${lab.port}${STORE_PATHS.home}`,
      asset: (kind: string) => `${lab.origin}${asset(kind)}`,
      requests: async (kind: string) => (await call(`/__control/requests?${new URLSearchParams({ path: asset(kind) })}`) as { count: number }).count,
      close: () => lab.close()
    };
  } catch (error) {
    await lab.close();
    throw error;
  }
}
