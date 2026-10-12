import type { RunningTopology } from "../../coordinator.js";
import type { DeterministicNetworkGuard } from "../../network-guard.js";
import { RunnerFailure } from "../../failure.js";
import type { ExtensionStartTrace } from "../extension-start-trace/index.js";
import { extensionControlPage } from "../extension-control-page.js";
import { chromeWorkerTarget } from "./chrome-worker-target.js";
import { installRunNetworkGuard } from "./install-run-network-guard.js";
import { launchBrowser } from "./launch-browser.js";

type Options = {
  scenarioOrigins: readonly string[];
  trace: Pick<ExtensionStartTrace, "attach" | "mark"> & Partial<Pick<ExtensionStartTrace, "observePage">>;
  onLaunched?: (session: Awaited<ReturnType<typeof launchBrowser>>) => void;
  onGuard?: (guard: DeterministicNetworkGuard) => void;
  launch?: typeof launchBrowser;
  openControl?: typeof extensionControlPage;
  installGuard?: typeof installRunNetworkGuard;
  findTarget?: typeof chromeWorkerTarget;
};

/** Rebind an unobserved worker by restarting its owned browser, never by bypassing containment. */
export async function launchExtensionSession(topology: RunningTopology, extensionPath: string, options: Options) {
  const launch = options.launch ?? launchBrowser;
  const installGuard = options.installGuard ?? installRunNetworkGuard;
  const openControl = options.openControl ?? extensionControlPage;
  const findTarget = options.findTarget ?? chromeWorkerTarget;
  for (let attempt = 1; ; attempt++) {
    const session = await launch(topology, extensionPath);
    const { context } = session;
    options.onLaunched?.(session);
    await options.trace.attach(context);
    const guard = await installGuard(context, topology, options.scenarioOrigins);
    options.onGuard?.(guard);
    let controlPage;
    try {
      controlPage = await openControl(context);
    }
    catch (error) {
      if (attempt !== 1 || !observationGap(error) || !await findTarget(context)) throw error;
      await guard.serviceWorkersProven();
      guard.assertNoViolations();
      options.trace.mark("browser.worker-observation.retry", { attempt, observedWorkerCount: 0 });
      await context.close();
      continue;
    }
    await guard.serviceWorkersProven();
    guard.assertNoViolations();
    options.trace.observePage?.(controlPage, "control");
    const isScenarioUrl = (url: string) => URL.canParse(url) && options.scenarioOrigins.includes(new URL(url).origin);
    return { ...session, controlPage, guard, isScenarioUrl };
  }
}

function observationGap(error: unknown): boolean {
  if (!(error instanceof RunnerFailure) || error.category !== "extension.worker") return false;
  const details = error.details;
  return details?.extensionStage === "worker" && details.observedWorkerCount === 0
    && typeof details.timeoutMs === "number" && Number.isFinite(details.timeoutMs) && details.timeoutMs > 0
    && typeof details.workerMs === "number" && Number.isFinite(details.workerMs) && details.workerMs >= details.timeoutMs;
}
