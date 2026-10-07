import { screenServerAdapterIdentity } from "./screen.js";
/** Same payload-only policy as the owning generator; surrounding executed semantics stay hashed. */
export function normalizeServerAdapterArtifact(text: string): string {
  const matches = [...text.matchAll(/(["'])__FLUXIQ_SERVER_IDENTITY_BEGIN__([^"']*)__FLUXIQ_SERVER_IDENTITY_END__\1/g)];
  if ([...text.matchAll(/["']__FLUXIQ_SERVER_IDENTITY_BEGIN__/g)].length !== 1 || [...text.matchAll(/__FLUXIQ_SERVER_IDENTITY_END__["']/g)].length !== 1) throw new Error("Server adapter identity needs exactly one embedded payload slot.");
  if (matches.length !== 1) throw new Error("Server adapter identity needs exactly one embedded payload slot.");
  const literal = matches[0]![0], encoded = matches[0]![2]!;
  if (!/^[A-Za-z0-9+/=]+$/.test(encoded) || Buffer.from(encoded, "base64").toString("base64") !== encoded) throw new Error("Malformed server payload encoding.");
  const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  const placeholder = (parsed as { fluxiqServerIdentityPlaceholder?: unknown } | null)?.fluxiqServerIdentityPlaceholder === 310 && Object.keys(parsed as object).length === 1;
  if (!placeholder && !screenServerAdapterIdentity(parsed)) throw new Error("Malformed server adapter identity payload.");
  return text.replace(literal, JSON.stringify("__FLUXIQ_SERVER_IDENTITY_BEGIN__" + Buffer.from('{"fluxiqServerIdentityPlaceholder":310}').toString("base64") + "__FLUXIQ_SERVER_IDENTITY_END__"));
}
