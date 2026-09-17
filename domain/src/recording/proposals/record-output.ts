// The dataset a recorded list extraction proposes saving its records into.
//
// The builder lives with the list extraction output node
// (`output-nodes/extract-list/record-output.ts`), which derives the same record
// output for a Flow that names none. It is built there rather than here because
// this directory already depends on `output-nodes` through `io/input-model`, so
// the output node importing it from here would make a module cycle. A recording
// proposal still names it from this directory, as it always has.

export { webAutomationRecordOutput } from "../../output-nodes";
export type { WebAutomationRecordOutput, WebAutomationRecordOutputSource } from "../../output-nodes";
