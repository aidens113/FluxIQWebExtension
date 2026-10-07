import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
/** Synthetic owning fixture only; real artifacts always use Core's generator. */
export async function writeServerAdapterFixture(webDirectory: string): Promise<void> {
  const artifact = path.join(webDirectory, ".server-runtime/client-gateway-server.mjs");
  const code = 'const embedded=' + JSON.stringify("__FLUXIQ_SERVER_IDENTITY_BEGIN__" + Buffer.from('{"fluxiqServerIdentityPlaceholder":310}').toString("base64") + "__FLUXIQ_SERVER_IDENTITY_END__") + ";";
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  const identity = { schema: 1, protocol: "fluxiq.module-build-identity.v1", moduleId: "fluxiq/web-client-gateway-server", version: "0.1.0", normalization: "module-payload-v1", artifactDigest: hash(code), sourceInputsDigest: hash("{}") };
  await mkdir(path.dirname(artifact), { recursive: true }); await writeFile(artifact, code);
  await writeFile(`${artifact}.identity.json`, JSON.stringify({ identity, sources: {} }));
}
