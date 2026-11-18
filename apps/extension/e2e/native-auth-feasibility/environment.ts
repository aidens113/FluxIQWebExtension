import { fileURLToPath } from "node:url";
import { NativeAuthProbeError } from "./failure.js";

export async function probeEnvironment(environment: NodeJS.ProcessEnv): Promise<Record<string, string>> {
  const filterUrl = new URL("../../../../scripts/provider-secret-environment.mjs", import.meta.url);
  const source = await import(fileURLToPath(filterUrl)) as { withoutProviderSecrets?: (input: NodeJS.ProcessEnv) => Record<string, string> };
  if (typeof source.withoutProviderSecrets !== "function") throw new NativeAuthProbeError("containment");
  const clean = source.withoutProviderSecrets(environment);
  delete clean.DEBUG;
  delete clean.PWDEBUG;
  return clean;
}
