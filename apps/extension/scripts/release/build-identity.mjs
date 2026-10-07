import { createHash } from "node:crypto";

/** Exact browser bundle inputs, including the Core/domain contracts reached by esbuild. */
export function buildIdentity({ target, version, inputs }) {
  const digest = (entries) => createHash("sha256").update(JSON.stringify(entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))).digest("hex");
  const entries = Object.entries(inputs);
  return { schema: 1, target, version, protocol: "fluxiq.build-identity.v1", inputsDigest: digest(entries), coreInputsDigest: digest(entries.filter(([file]) => file.startsWith("../!FluxIQ/"))), domainInputsDigest: digest(entries.filter(([file]) => file.startsWith("domain/"))) };
}
