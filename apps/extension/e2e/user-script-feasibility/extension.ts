import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
/** Generated test-only extension, never a shipped manifest or JS capability. */
export async function writeProbeExtension(root: string, hasPermission: boolean): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "manifest.json"), JSON.stringify({ manifest_version: 3, name: hasPermission ? "Owned User Script Probe" : "Owned Missing Permission Probe", version: "0.0.1", minimum_chrome_version: "135", permissions: hasPermission ? ["userScripts", "tabs"] : ["tabs"], host_permissions: ["http://127.0.0.1/*"], background: { service_worker: "worker.js" } }));
  await writeFile(path.join(root, "worker.js"), "chrome.runtime.onInstalled.addListener(() => {});\n");
  await writeFile(path.join(root, "probe.html"), "<!doctype html><title>Owned synthetic API probe</title><h1>Owned probe</h1>");
}
