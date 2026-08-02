import path from "node:path";
import { setupWebAutomationFluxIQ } from "./setup";

const repoRoot = path.resolve(process.env.FLUXIQ_WEB_AUTOMATION_ROOT ?? process.cwd());
void main();

async function main(): Promise<void> {
  const result = await setupWebAutomationFluxIQ(repoRoot);
  console.log(JSON.stringify({
    root: result.paths.root,
    fluxiq: result.paths.fluxiq,
    configPath: result.configPath,
    created: result.created,
    domains: result.domains,
    recordingDomains: result.recordingDomains.map((domain) => ({
      domainId: domain.domainId,
      label: domain.label,
      eventCount: domain.events.length
    }))
  }, null, 2));
}
