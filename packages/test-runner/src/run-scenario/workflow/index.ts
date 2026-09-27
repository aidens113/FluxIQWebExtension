// Which workflow and variant a run resolves to, and when in the run the variant
// is armed. The page-fact schedule reads both, because a workflow's page facts
// describe the fixture's unarmed rendering and a variant's the armed one.
export { armingOf, type ScenarioArmingOptions } from "./scenario-arming.js";
export { unarmedWorkflow } from "./unarmed-workflow.js";
export { workflowSelection, type WorkflowSelectionOptions } from "./workflow-selection.js";
