// The state-aware recovery plan's provider-free acceptance matrix
// (`docs/working/state-aware-recovery-plan.md`, "Acceptance matrix"): each row
// as hand-authored candidate scripts saved through Core's own path, run headed
// against the realistic scenarios with their switches and faults, and judged
// from the run's own records. `lab recovery-matrix` is the command
// (`command.ts`, `run-recovery-matrix.ts`).
export * from "./checks/index.js";
export * from "./command.js";
export * from "./compile/index.js";
export * from "./flows/index.js";
export * from "./matrix-row.js";
export * from "./matrix-rows.js";
export * from "./measures.js";
export * from "./records/index.js";
export * from "./run/index.js";
export * from "./run-recovery-matrix.js";
