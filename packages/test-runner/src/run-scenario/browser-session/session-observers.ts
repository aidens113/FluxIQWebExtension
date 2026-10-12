import type { DeterministicNetworkGuard } from "../../network-guard.js";
import type { launchBrowser } from "./launch-browser.js";
import type { launchExtensionSession } from "./launch-extension-session.js";

type Session = Awaited<ReturnType<typeof launchBrowser>>;
type Watch = { dispose(): void };
type SessionOptions = Parameters<typeof launchExtensionSession>[2];
type Options = Pick<SessionOptions, "scenarioOrigins" | "trace"> & {
  adoptSession(session: Session): void;
  adoptGuard(guard: DeterministicNetworkGuard): void;
  watchConsole(session: Session, isScenarioUrl: (url: string) => boolean): Watch;
  startCapture(): void;
  watchSteps(): void;
};

/** Rebind browser observers while the run retains its terminal evidence/cleanup owners. */
export function sessionObservers(options: Options): SessionOptions {
  let current: Session | undefined;
  let watch: Watch | undefined;
  let capturing = false;
  const isScenarioUrl = (url: string) => URL.canParse(url) && options.scenarioOrigins.includes(new URL(url).origin);
  return {
    scenarioOrigins: options.scenarioOrigins,
    trace: options.trace,
    onLaunched: session => {
      watch?.dispose();
      watch = undefined;
      current = session;
      options.adoptSession(session);
      if (!capturing) {
        capturing = true;
        options.startCapture();
        options.watchSteps();
      }
    },
    onGuard: guard => {
      if (!current) throw new Error("A browser guard cannot precede its owned launch");
      options.adoptGuard(guard);
      watch = options.watchConsole(current, isScenarioUrl);
    },
  };
}
