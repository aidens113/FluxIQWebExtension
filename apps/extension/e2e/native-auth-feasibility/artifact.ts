import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareBuildInfo } from "../../scripts/release/index.mjs";
import { NativeAuthProbeError } from "./failure.js";

export async function readProbeContentArtifact(): Promise<{ content: Buffer; pageWorld: Buffer; contentSha256: string; pageWorldSha256: string }> {
  const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
  const artifact = fileURLToPath(new URL("../../dist/chrome/", import.meta.url));
  const compared = await compareBuildInfo(artifact, repositoryRoot);
  if (compared.state !== "current") throw new NativeAuthProbeError(compared.state === "stale" ? "artifact_stale" : "artifact_unavailable");
  let content: Buffer;
  let pageWorld: Buffer;
  try {
    [content, pageWorld] = await Promise.all([readFile(path.join(artifact, "content/index.js")), readFile(path.join(artifact, "page-world/index.js"))]);
  } catch {
    throw new NativeAuthProbeError("artifact_unavailable");
  }
  const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
  return { content, pageWorld, contentSha256: hash(content), pageWorldSha256: hash(pageWorld) };
}
