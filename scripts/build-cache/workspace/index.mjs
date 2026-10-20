// This repository's side of resolving a step: a registry entry resolved to
// absolute input roots and outputs for Core's engine, the FluxIQ Core packages
// a step links, a FluxIQ Core library package resolved as a step of its own,
// and the build-cache sources every fingerprint covers.

export { linkedCorePackages } from "./core-packages.mjs";
export { engineSourceRoots } from "./engine-sources.mjs";
export { resolveCoreLibrary } from "./resolve-core-library.mjs";
export { resolveExtensionStep } from "./resolve-step.mjs";
