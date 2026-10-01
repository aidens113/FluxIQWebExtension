import type { BrowserContext } from "@playwright/test";
import type { RunningScenarioLab } from "../../server.js";

/**
 * Ends a browser session against a scenario lab: closes its browser context,
 * then the lab, and closes the lab whatever the context does. Pass no context
 * when the session failed before it had one.
 *
 * A lab is two listening servers, and they keep the test process alive: a lab
 * left open is a test file that never exits, idle at no CPU with its ports
 * held, no test running and nothing printed. That is what a teardown written
 * as `await context.close(); await lab.close();` did once the session's
 * browser had gone away mid-run: `context.close()` rejects ("Target page,
 * context or browser has been closed"), the lab line never runs, and with
 * every session in the file open at that moment the file hung for good
 * (`everything-store/tests/naive-paths.test.ts`, 25 minutes, 12 ports).
 *
 * A context whose browser is already gone has nothing left to close, so that
 * rejection is not raised again here: the step that met the lost browser has
 * already failed its test, and a teardown error in its place would hide which
 * step that was. Any other failure to close the context is raised, after the
 * lab is closed.
 */
export async function closeLabSession(lab: RunningScenarioLab, context?: BrowserContext): Promise<void> {
  try {
    await context?.close();
  } catch (error) {
    if (context?.browser()?.isConnected() !== false) throw error;
  } finally {
    await lab.close();
  }
}
