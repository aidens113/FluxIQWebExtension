import { createProbeAllocation } from "./allocation/index.js";
import { openNativeProbeHost } from "./browser.js";
import { nativeProbeFixture } from "./fixture.js";
import { writeNativeProbeExtension } from "./extension/index.js";
import { nativeProbeEvidence } from "./evidence/index.js";
import { NativeAuthProbeError } from "./failure.js";
import { finishNativeProbe } from "./finish.js";
import type { ProbeAllocation, ProbeConfiguration, ProbeEvidence, ProbeHost, ProbeStage } from "./model.js";

type CasePorts = { host: ProbeHost; configuration: ProbeConfiguration; record: (value: ProbeEvidence) => void; stage: (value: ProbeStage) => void; restart: (crash: boolean) => Promise<ProbeHost> };

export async function runNativeProbeCase(operation: (ports: CasePorts) => Promise<void>): Promise<ProbeEvidence[]> {
  const evidence: ProbeEvidence[] = [];
  let allocation: ProbeAllocation | undefined;
  let fixture: Awaited<ReturnType<typeof nativeProbeFixture>> | undefined;
  let host: ProbeHost | undefined;
  let failure: NativeAuthProbeError | undefined;
  let stage: ProbeStage = "allocation";
  const transition = (value: ProbeStage): void => {
    stage = value;
    process.stdout.write(`${JSON.stringify({ nativeProbeStage: value })}\n`);
  };
  const record = (value: ProbeEvidence): void => {
    evidence.push(value);
    process.stdout.write(`${JSON.stringify({ nativeProbe: value })}\n`);
  };
  try {
    transition("allocation");
    allocation = await createProbeAllocation();
    transition("fixture");
    fixture = await nativeProbeFixture();
    transition("artifact");
    const artifact = await writeNativeProbeExtension(allocation, fixture.configuration);
    record(nativeProbeEvidence("artifact", artifact));
    transition("browser");
    host = await openNativeProbeHost(allocation, fixture.configuration);
    record(nativeProbeEvidence("artifact", { browserVersion: host.browserVersion }));
    const owned = allocation;
    const configuration = fixture.configuration;
    await operation({
      host, configuration, record, stage: transition,
      async restart(crash) {
        await host!.assertContained();
        evidence.push(nativeProbeEvidence(crash ? "crash_restore" : "graceful_restore", host!.containment()));
        if (crash) await host!.crash();
        else await host!.close();
        host = await openNativeProbeHost(owned, configuration, true);
        return host;
      }
    });
    transition("containment");
    await host.assertContained();
  } catch (error) {
    if (error instanceof NativeAuthProbeError) evidence.push(...error.evidence);
    failure = new NativeAuthProbeError(error instanceof NativeAuthProbeError ? error.code : "unexpected", { stage, evidence });
  } finally {
    const clean = await finishNativeProbe({ allocation, host, fixture, evidence });
    if (!clean && !failure) failure = new NativeAuthProbeError("browser_close", { stage: "cleanup", evidence });
  }
  if (failure) throw new NativeAuthProbeError(failure.code, { stage: failure.stage, evidence });
  return evidence;
}
