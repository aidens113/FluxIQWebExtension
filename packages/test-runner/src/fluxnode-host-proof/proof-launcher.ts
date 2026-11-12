import { createBrowserHostLauncher } from "@fluxiq-web-extension/browser-host";
import type { BrowserContext } from "@playwright/test";
import type { FluxIQHostLauncher } from "fluxiq/server";
import { sharedReaper } from "@fluxiq-web-extension/browser-host/reaper";
import { installDeterministicNetworkGuard } from "../network-guard.js";
import { networkContainmentArgs } from "../guarded-browser/index.js";
import { sendHostProofEvent } from "./events.js";

/** A product launcher with the Lab's network guard, never a parallel browser implementation. */
export function createFluxIQHostLauncher(environment: NodeJS.ProcessEnv): FluxIQHostLauncher {
  const extensionPath = environment.FLUXIQ_BROWSER_EXTENSION_PATH;
  const marker = environment.FLUXIQ_HOST_PROOF_MARKER;
  const startUrl = environment.FLUXIQ_HOST_PROOF_START_URL;
  const origins: unknown = JSON.parse(environment.FLUXIQ_HOST_PROOF_SCENARIO_ORIGINS ?? "null");
  if (!extensionPath || !marker || !Array.isArray(origins) || origins.some((origin) => typeof origin !== "string" || new URL(origin).hostname !== "127.0.0.1")) throw new Error("The host proof requires an isolated extension, marker and loopback scenario origins.");
  if (!startUrl || !origins.includes(new URL(startUrl).origin)) throw new Error("The host proof's start page must belong to its isolated realistic fixture.");
  const contexts = new Map<string, BrowserContext>();
  process.on("message", (message: unknown) => {
    const command = message as { type?: string; hostId?: string; id?: string };
    if (command?.type === "proof.flush" && typeof command.id === "string") sendHostProofEvent({ type: "proof.flushed", id: command.id });
    if (command?.type === "proof.reaper-loss") sharedReaper().disconnect();
    if (command?.type === "proof.crash" && command.hostId) {
      const context = contexts.get(command.hostId);
      const page = context?.pages()[0];
      if (!context || !page) {
        sendHostProofEvent({ type: "proof.crash-error", name: "HostUnavailable" });
        return;
      }
      // Persistent contexts have no Browser client in Playwright; a page CDP
      // session can still send the browser-wide crash command.
      void context.newCDPSession(page).then(async (session) => {
        try { await session.send("Browser.crash"); }
        catch (error) { if (!/closed|crash|disconnected/iu.test(String(error))) throw error; }
      }).catch((error: unknown) => sendHostProofEvent({ type: "proof.crash-error", name: error instanceof Error ? error.name : "unknown" }));
    }
  });
  return { launch: (request) => createBrowserHostLauncher({ extensionPath,
    browserArgs: [...networkContainmentArgs([request.gatewayUrl, request.coreApiUrl, ...origins]), `--fluxiq-proof-run=${marker}`],
    onContext: async (context) => {
      contexts.set(request.hostId, context);
      const guard = await installDeterministicNetworkGuard(context, { scenarioOrigins: origins as string[], fluxiqOrigins: [request.coreApiUrl], gatewayOrigins: [request.gatewayUrl] });
      const fixture = await context.newPage();
      const session = await context.newCDPSession(fixture);
      const version = await session.send("Browser.getVersion");
      await session.detach();
      sendHostProofEvent({ type: "proof.browser", hostId: request.hostId, version: version.product });
      await fixture.goto(startUrl);
      context.on("close", () => {
        if (contexts.get(request.hostId) === context) contexts.delete(request.hostId);
        sendHostProofEvent({ type: "proof.network", violations: guard.violations().length });
      });
    }
  }).launch({ ...request, takeEnrolmentTicket: () => {
    sendHostProofEvent({ type: "proof.ticket", hostId: request.hostId });
    return request.takeEnrolmentTicket();
  } }) };
}
