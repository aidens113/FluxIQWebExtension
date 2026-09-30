import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { firefox, type BrowserContext } from "@playwright/test";
import { withoutProviderSecrets } from "../../environment.js";
import { installTemporaryAddon } from "./install-temporary-addon.js";

/** The gecko id `apps/extension/manifest.firefox.json` declares. */
const GECKO_ID = "fluxiq-web-automation@example.local";

export type LaunchedFirefox = {
  context: BrowserContext;
  /** `moz-extension://<uuid>`, fixed before the add-on was installed so its pages can be opened by address. */
  extensionOrigin: string;
  /** What Firefox reported installing. */
  addonId: string;
  /** The profile Firefox runs on, which names its process for a window capture. */
  profileDir: string;
};

/**
 * A headed Playwright Firefox with the extension's Firefox build installed as
 * a temporary add-on.
 *
 * Playwright cannot load an extension into Firefox itself, so Firefox is
 * started with its debugger server listening on a free loopback port and the
 * add-on is installed through the remote debugging protocol
 * (`installTemporaryAddon`), the technique `playwright-webextext` uses. The
 * add-on's internal UUID is pinned through `extensions.webextensions.uuids`
 * before the install, so its popup is at a known `moz-extension://` address.
 *
 * `extensions.openPopupWithoutUserGesture.enabled` lets `action.openPopup()`
 * run from a script, so the real toolbar popup can be opened without a click.
 */
export async function launchFirefoxWithExtension(input: { profileDir: string; addonPath: string }): Promise<LaunchedFirefox> {
  const uuid = randomUUID();
  const port = await freePort();
  const context = await firefox.launchPersistentContext(input.profileDir, {
    headless: false,
    env: withoutProviderSecrets(process.env),
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1280, height: 720 },
    colorScheme: "light",
    args: ["-start-debugger-server", String(port)],
    firefoxUserPrefs: {
      "devtools.debugger.remote-enabled": true,
      "devtools.debugger.prompt-connection": false,
      "devtools.chrome.enabled": true,
      "extensions.webextensions.uuids": JSON.stringify({ [GECKO_ID]: uuid }),
      "extensions.openPopupWithoutUserGesture.enabled": true,
      "browser.shell.checkDefaultBrowser": false,
    },
  });
  try {
    const { id } = await installTemporaryAddon(port, input.addonPath);
    return { context, extensionOrigin: `moz-extension://${uuid}`, addonId: id, profileDir: input.profileDir };
  } catch (error) {
    await context.close().catch(/* best-effort: the failed install is the error worth reporting */ () => undefined);
    throw error;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}
