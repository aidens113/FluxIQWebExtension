// The workspace a step lives in: its packages, the FluxIQ Core packages they
// link, a registry entry resolved to absolute input roots and outputs, and the
// paths a TypeScript project names; and a FluxIQ Core library package
// resolved as a step of its own.

export { linkedCorePackages } from "./core-packages.mjs";
export { resolveCoreLibrary } from "./resolve-core-library.mjs";
export { resolveStep } from "./resolve-step.mjs";
export { tsconfigReferences } from "./tsconfig-references.mjs";
export { readWorkspacePackages } from "./workspace-packages.mjs";
