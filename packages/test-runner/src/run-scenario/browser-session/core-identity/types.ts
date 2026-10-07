export type RuntimeIdentity = { schema: 1; protocol: "fluxiq.core-runtime-identity.v1"; version: string; normalization: "reader-payload-v1"; artifactDigest: string };
export type ExpectedRuntimeIdentity = { identity: RuntimeIdentity; reachedInputs: string[]; reachedInputsDigest: string };
