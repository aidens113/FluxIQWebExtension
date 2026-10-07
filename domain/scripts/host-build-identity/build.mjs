import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { hostSourceInventory } from "./inventory.mjs";
import { hostIdentitySlot } from "./normalize.mjs";
/** Stamp the built executing host and a companion receipt through the owning build only. */
export async function stampHostBuildIdentity(root, outfile) {
  const hash = value => createHash("sha256").update(value).digest("hex");
  const sources = {};
  for (const key of await hostSourceInventory(root)) sources[key] = hash(await readFile(path.join(root, key)));
  const artifact = await readFile(outfile, "utf8");
  const { version } = JSON.parse(await readFile(path.join(root, "domain/package.json"), "utf8"));
  const identity = { schema: 1, protocol: "fluxiq.module-build-identity.v1", moduleId: "@fluxiq-web-extension/domain-host", version, normalization: "module-payload-v1",
    artifactDigest: hash(hostIdentitySlot(artifact)), sourceInputsDigest: hash(JSON.stringify(sources)) };
  await writeFile(outfile, hostIdentitySlot(artifact, identity));
  await writeFile(`${outfile}.identity.json`, JSON.stringify({ identity, sources }, null, 2) + "\n");
  return identity;
}
