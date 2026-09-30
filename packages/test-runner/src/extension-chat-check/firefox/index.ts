// Running the extension in Firefox under Playwright: a headed Firefox with the
// extension's Firefox build installed as a temporary add-on over the remote
// debugging protocol.
export { installTemporaryAddon } from "./install-temporary-addon.js";
export { launchFirefoxWithExtension, type LaunchedFirefox } from "./launch-firefox.js";
export { connectFirefoxRdp, type FirefoxRdpClient } from "./rdp-client.js";
export { readRdpFrames } from "./rdp-framing.js";
