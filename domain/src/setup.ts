import path from "node:path";
import { createWebAutomationFluxIQ } from "./host";

export type WebAutomationSetupResult = Awaited<ReturnType<ReturnType<typeof createWebAutomationFluxIQ>["setup"]>> & {
  domains: ReturnType<ReturnType<typeof createWebAutomationFluxIQ>["domains"]["summaries"]>;
  recordingDomains: ReturnType<ReturnType<typeof createWebAutomationFluxIQ>["programs"]["automationStudio"]["listRecordingDomains"]>;
};

export async function setupWebAutomationFluxIQ(rootDir = process.cwd()): Promise<WebAutomationSetupResult> {
  const fluxiq = createWebAutomationFluxIQ({
    rootDir: path.resolve(rootDir),
    loadEnv: true
  });
  const result = await fluxiq.setup();
  return {
    ...result,
    domains: fluxiq.domains.summaries(),
    recordingDomains: fluxiq.programs.automationStudio.listRecordingDomains()
  };
}
