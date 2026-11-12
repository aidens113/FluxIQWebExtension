import { BrowserHostError } from "../errors/index.js";

/** The extension's id, read from its service worker's `chrome-extension://<id>/...` URL. */
export function extensionIdOf(workerUrl: string): string {
  const url = new URL(workerUrl);
  if (url.protocol !== "chrome-extension:" || url.host === "") throw new BrowserHostError("browser_host.no_extension", "The service worker found is not an extension's.");
  return url.host;
}
