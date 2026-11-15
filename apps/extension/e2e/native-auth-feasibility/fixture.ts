import { randomBytes } from "node:crypto";
import { getScenario } from "../../../scenario-lab/src/registry.js";
import { startScenarioLab } from "../../../scenario-lab/src/server.js";

export async function nativeProbeFixture(): Promise<{ configuration: { ordinaryUrl: string; alternateUrl: string }; close(): Promise<void> }> {
  const scenario = getScenario("company-website");
  if (!scenario) throw new Error("native_auth_probe.fixture_missing");
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: scenario.seed });
  try {
    for (const [operation, payload] of [["set-consent", { choice: "essential" }], ["dismiss-chat-greeting", {}], ["dismiss-newsletter", {}]] as const) {
      const response = await fetch(`${lab.origin}/api/company-website/${operation}`, { method: "POST", headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("native_auth_probe.fixture_refused");
    }
    return { configuration: { ordinaryUrl: new URL(scenario.startPath, lab.origin).href, alternateUrl: new URL("/scenarios/company-website/booking-widget", lab.frameOrigin).href }, close: () => lab.close() };
  } catch {
    await lab.close();
    throw new Error("native_auth_probe.fixture_refused");
  }
}
