import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NativeAuthProbeError } from "../failure.js";
import type { ProbeAllocation, ProbeArtifact, ProbeConfiguration } from "../model.js";
import { assertProbeAllocation } from "../allocation/index.js";
import { readProbeContentArtifact } from "../artifact.js";

export async function writeNativeProbeExtension(allocation: ProbeAllocation, configuration: ProbeConfiguration): Promise<ProbeArtifact> {
  await assertProbeAllocation(allocation);
  for (const value of [configuration.ordinaryUrl, configuration.alternateUrl]) {
    const url = new URL(value);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.search || url.hash || !url.pathname.startsWith("/scenarios/company-website/")) throw new NativeAuthProbeError("containment");
  }
  const artifact = await readProbeContentArtifact();
  await mkdir(allocation.extension);
  await writeFile(path.join(allocation.extension, "content.js"), artifact.content);
  await writeFile(path.join(allocation.extension, "page-world.js"), artifact.pageWorld);
  for (const name of ["worker.js", "flow.js", "observe.js", "capture.js", "probe.html"]) {
    await writeFile(path.join(allocation.extension, name), await readFile(new URL(name, import.meta.url)));
  }
  await writeFile(path.join(allocation.extension, "config.js"), `export const probeConfiguration = Object.freeze(${JSON.stringify(configuration)});\n`);
  const manifest = {
    manifest_version: 3, name: "Owned Native Identity Feasibility Probe", version: "0.0.1", minimum_chrome_version: "135",
    permissions: ["identity", "tabs", "scripting", "storage"], host_permissions: ["<all_urls>"],
    background: { service_worker: "worker.js", type: "module" },
    content_scripts: [
      { matches: ["http://127.0.0.1/*"], js: ["page-world.js"], run_at: "document_start", all_frames: true, match_about_blank: true, match_origin_as_fallback: true, world: "MAIN" },
      { matches: ["http://127.0.0.1/*"], js: ["content.js"], run_at: "document_start", all_frames: true, match_about_blank: true, match_origin_as_fallback: true }
    ]
  };
  await writeFile(path.join(allocation.extension, "manifest.json"), JSON.stringify(manifest));
  return { contentSha256: artifact.contentSha256, pageWorldSha256: artifact.pageWorldSha256 };
}
