const BEGIN = "__FLUXIQ_HOST_IDENTITY_BEGIN__", END = "__FLUXIQ_HOST_IDENTITY_END__";
const PLACEHOLDER = Buffer.from('{"fluxiqHostIdentityPlaceholder":305}').toString("base64");
/** Normalize only one self-containing payload; all executing surrounding bytes remain hashed. */
export function hostIdentitySlot(text, identity) {
  const pattern = /(["'])__FLUXIQ_HOST_IDENTITY_BEGIN__([^"']*)__FLUXIQ_HOST_IDENTITY_END__\1/g;
  const matches = [...text.matchAll(pattern)];
  if ([...text.matchAll(/["']__FLUXIQ_HOST_IDENTITY_BEGIN__/g)].length !== 1 || [...text.matchAll(/__FLUXIQ_HOST_IDENTITY_END__["']/g)].length !== 1) throw new Error("Host identity needs exactly one embedded payload slot.");
  if (matches.length !== 1) throw new Error("Host identity needs exactly one embedded payload slot.");
  const [literal, , encoded] = matches[0];
  if (!/^[A-Za-z0-9+/=]+$/.test(encoded) || Buffer.from(encoded, "base64").toString("base64") !== encoded) throw new Error("Malformed host identity payload encoding.");
  const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  const placeholder = parsed.fluxiqHostIdentityPlaceholder === 305 && Object.keys(parsed).length === 1;
  if (!placeholder && (parsed.schema !== 1 || parsed.protocol !== "fluxiq.module-build-identity.v1" || parsed.normalization !== "module-payload-v1"
    || parsed.moduleId !== "@fluxiq-web-extension/domain-host" || typeof parsed.version !== "string" || Object.keys(parsed).length !== 7
    || !/^[a-f0-9]{64}$/.test(parsed.artifactDigest) || !/^[a-f0-9]{64}$/.test(parsed.sourceInputsDigest))) throw new Error("Malformed host identity payload.");
  const payload = identity ? Buffer.from(JSON.stringify(identity)).toString("base64") : PLACEHOLDER;
  return text.replace(literal, JSON.stringify(BEGIN + payload + END));
}
