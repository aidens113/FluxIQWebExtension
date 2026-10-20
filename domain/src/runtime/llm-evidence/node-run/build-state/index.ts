// Barrel for the build a call belongs to, as Core says (`./build-key.ts`), and
// the memories a build keeps across calls, held here and in Core's store
// (`./memory.ts`, `./persistence.ts`, t728), and the run of a memory that fits
// Core's bound on one stored value (`./stored-prefix.ts`, t737).
export { webNodeBuildOf, webNodeBuildSlot, type WebNodeBuildKey, type WebNodeOpening } from "./build-key";
export { createWebNodeBuildMemory, type WebNodeBuildMemory } from "./memory";
export { createWebNodeBuildStatePersistence, type WebNodeBuildStatePersistence, type WebNodeBuildStateSource } from "./persistence";
export { webNodeStoredPrefix } from "./stored-prefix";
