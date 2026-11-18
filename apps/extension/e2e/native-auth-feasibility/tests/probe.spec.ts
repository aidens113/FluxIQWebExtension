import { expect, test, type TestInfo } from "@playwright/test";
import { nativeProbeCommand } from "../command.js";
import { nativeProbeEvidence, saveNativeProbeEvidence } from "../evidence/index.js";
import { runNativeProbeCase } from "../run.js";
import { NativeAuthProbeError } from "../failure.js";
import { assertNativeProbeCompletion } from "../completion.js";
import type { ProbeConfiguration, ProbeEvidence, ProbeHost, ProbeStage } from "../model.js";

test.use({ trace: "off", screenshot: "off", video: "off" });
test.skip(process.env.FLUXIQ_NATIVE_AUTH_PROBE !== "1", "Explicit native-auth provider-free probe gate is required.");

async function ready(host: ProbeHost): Promise<string> {
  let boot = "";
  await expect.poll(async () => {
    try {
      boot = String((await nativeProbeCommand(host.control, "ready")).boot ?? "");
      return boot.length > 0;
    } catch (error) {
      if (error instanceof NativeAuthProbeError && error.code === "operation_refused") return false;
      throw error;
    }
  }).toBe(true);
  return boot;
}

async function start(host: ProbeHost, record: (value: ProbeEvidence) => void, stage: (value: ProbeStage) => void): Promise<void> {
  stage("pending");
  await ready(host);
  await nativeProbeCommand(host.control, "control");
  await nativeProbeCommand(host.control, "start");
  let observation: Record<string, unknown> = {};
  let status: Record<string, unknown> = {};
  try {
    await expect.poll(async () => {
      observation = await nativeProbeCommand(host.control, "observe");
      status = await nativeProbeCommand(host.control, "status");
      return observation.nativeMatches === 1 || status.outcome === "rejected";
    }).toBe(true);
  } finally {
    record(nativeProbeEvidence("pending", { ...observation, ...status }));
  }
  if (status.outcome === "rejected") throw new NativeAuthProbeError("operation_refused");
}

async function attach(info: TestInfo, evidence: ProbeEvidence[]): Promise<void> {
  await saveNativeProbeEvidence(info, evidence);
}

async function diagnose(info: TestInfo, operation: Parameters<typeof runNativeProbeCase>[0]): Promise<void> {
  try {
    await attach(info, await runNativeProbeCase(operation));
  } catch (error) {
    if (error instanceof NativeAuthProbeError) await attach(info, [...error.evidence]);
    throw error;
  }
}

function visibleNative(host: ProbeHost, configuration: ProbeConfiguration): boolean {
  return host.context.pages().some(page => !page.isClosed() && [configuration.ordinaryUrl, configuration.alternateUrl].includes(page.url()));
}

test("native pending visibility, unchanged content injection, capture, completion and close", async ({}, info) => {
  await diagnose(info, async ({ host, configuration, record, stage }) => {
    await start(host, record, stage);
    record(nativeProbeEvidence("pending", { ...await nativeProbeCommand(host.control, "observe"), driverNativeVisible: visibleNative(host, configuration) }));
    stage("capture");
    record(nativeProbeEvidence("capture", await nativeProbeCommand(host.control, "capture")));
    stage("completion");
    await nativeProbeCommand(host.control, "complete");
    await expect.poll(async () => (await nativeProbeCommand(host.control, "status")).outcome).toBe("success");
    await expect.poll(() => visibleNative(host, configuration)).toBe(false);
    const success = await nativeProbeCommand(host.control, "status");
    record(nativeProbeEvidence("completion", { ...success, ...host.containment(), driverNativeClosed: !visibleNative(host, configuration) }));
    assertNativeProbeCompletion({ outcome: success.outcome, callbackMatched: success.callbackMatched === true, nativeCallbackRequests: host.containment().nativeCallbackRequests, driverNativeClosed: !visibleNative(host, configuration) });
    record(nativeProbeEvidence("success", { ...success, ...host.containment(), driverNativeClosed: true }));
    stage("close");
    await nativeProbeCommand(host.control, "start");
    await expect.poll(async () => (await nativeProbeCommand(host.control, "observe")).nativeMatches).toBe(1);
    await nativeProbeCommand(host.control, "close");
    await expect.poll(async () => (await nativeProbeCommand(host.control, "status")).outcome).toBe("rejected");
    record(nativeProbeEvidence("user_close", { ...await nativeProbeCommand(host.control, "status"), driverNativeClosed: !visibleNative(host, configuration) }));
  });
});

test("local cancel refuses a native late result without claiming UI abortion", async ({}, info) => {
  await diagnose(info, async ({ host, record, stage }) => {
    await start(host, record, stage);
    stage("cancel");
    await nativeProbeCommand(host.control, "cancel");
    await nativeProbeCommand(host.control, "complete");
    await expect.poll(async () => (await nativeProbeCommand(host.control, "status")).pending).toBe(false);
    const cancelled = await nativeProbeCommand(host.control, "status");
    expect(cancelled.outcome).toBe("locally_cancelled");
    expect(cancelled.lateResultDiscarded).toBe(true);
    record(nativeProbeEvidence("cancel", cancelled));
  });
});

test("native UI across actual extension runtime reload", async ({}, info) => {
  await diagnose(info, async ({ host, configuration, record, stage }) => {
    await start(host, record, stage);
    stage("reload");
    const boot = await ready(host);
    await nativeProbeCommand(host.control, "reload");
    await host.control.goto(`chrome-extension://${host.extensionId}/probe.html`);
    await expect.poll(() => ready(host)).not.toBe(boot);
    record(nativeProbeEvidence("reload", { ...await nativeProbeCommand(host.control, "observe"), extensionReloaded: true, driverNativeVisible: visibleNative(host, configuration) }));
  });
});

test("native UI across an explicit worker target stop", async ({}, info) => {
  await diagnose(info, async ({ host, configuration, record, stage }) => {
    await start(host, record, stage);
    stage("worker_stop");
    const boot = await ready(host);
    const targets = await host.cdp.send("Target.getTargets");
    const matching = targets.targetInfos.filter(target => target.type === "service_worker" && target.url === `chrome-extension://${host.extensionId}/worker.js`);
    expect(matching.length).toBe(1);
    const result = await host.cdp.send("Target.closeTarget", { targetId: matching[0]!.targetId });
    expect(result.success).toBe(true);
    await expect.poll(() => ready(host)).not.toBe(boot);
    record(nativeProbeEvidence("worker_stop", { ...await nativeProbeCommand(host.control, "observe"), workerStopped: true, driverNativeVisible: visibleNative(host, configuration) }));
  });
});

for (const crash of [false, true]) {
  test(`native off-origin UI after same-profile ${crash ? "crash" : "graceful"} restore`, async ({}, info) => {
    await diagnose(info, async ({ host, configuration, record, restart, stage }) => {
      await start(host, record, stage);
      stage("restore");
      await nativeProbeCommand(host.control, "alternate");
      await expect.poll(async () => (await nativeProbeCommand(host.control, "observe")).nativeMatches).toBe(1);
      const next = await restart(crash);
      await ready(next);
      const observed = await nativeProbeCommand(next.control, "observe");
      record(nativeProbeEvidence(crash ? "crash_restore" : "graceful_restore", { ...observed, nativeAfterRestart: visibleNative(next, configuration), controlAfterRestart: observed.ordinaryVisible, ...next.containment() }));
    });
  });
}
