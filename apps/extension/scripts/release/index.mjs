// Release tooling for the extension: build stamp, icons, permission review,
// target verification, store packaging, release-candidate checklist.
export { BUILD_INFO_FILE, compareBuildInfo, hashBuildInputs, writeBuildInfo } from "./build-info.mjs";
export { renderIconPng } from "./icon-png.mjs";
export { packageExtension } from "./package-extension.mjs";
export { REVIEWED_PERMISSIONS } from "./permission-review.mjs";
export { CLEAN_ENVIRONMENT_STEPS, OWNER_ACTIONS, PROVISIONAL_BENCH_THRESHOLDS, evaluateReleaseCandidate } from "./release-candidate-checklist.mjs";
export { readTargetFiles } from "./target-files.mjs";
export { verifyExtensionTarget } from "./verify-extension-target.mjs";
export { readZip, writeZip } from "./zip-archive.mjs";

export { buildIdentity } from "./build-identity.mjs";
