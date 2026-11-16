// The panel's humanness requests: one Flow's or one task's own level, which the
// background worker relays to Core with the pairing token
// (`background/panel/humanness-relay.ts`). `protocol.ts` re-exports them, so
// they are named from there as every other panel message is.
//
// A level is a whole number from 0 (fastest) to 100 (most human-like). A Flow
// or task with no level of its own uses the person's starting value, and
// `null` clears its own level so it uses that again. What runs is the run's
// option, else the task's, else the Flow's, else the starting value, else 0.
//
// Each panel message is one Core call. A `projectId` left out means the project
// this browser's session belongs to. Core judges the level: one out of range
// is refused in Core's own words, which reach the person as they stand.

/**
 * `panelFlowHumannessRead`: `get-flow-metadata-detail` with `{ projectId, flowId }`.
 * Answers `PanelHumannessReply`, from Core's `flow.metadata.humanness`.
 */
export type PanelFlowHumannessReadRequest = {
  projectId?: string | undefined;
  flowId: string;
};

/**
 * `panelFlowHumannessSet`: `update-flow-settings` with
 * `{ projectId, flowId, flow: { flowId, metadata: { humanness } } }`, where
 * `null` clears. Answers `PanelHumannessReply`, from the settings Core saved.
 */
export type PanelFlowHumannessSetRequest = {
  projectId?: string | undefined;
  flowId: string;
  humanness: number | null;
};

/**
 * `panelTaskHumannessSet`: `update-task-settings` with
 * `{ projectId, taskId, humanness }`, where `null` clears. Answers
 * `PanelHumannessReply`, from Core's `{ taskId, humanness }`. A task's level is
 * read from its `list-project-tasks` row (`listTasks`), which carries it.
 */
export type PanelTaskHumannessSetRequest = {
  projectId?: string | undefined;
  taskId: string;
  humanness: number | null;
};

/** What each humanness request answers: the own level as Core holds it, absent when there is none. */
export type PanelHumannessReply = {
  humanness?: number | undefined;
};

/** The body of `get-flow-metadata-detail` the relay sends: exactly these fields. */
export type CoreFlowHumannessReadBody = {
  projectId: string;
  flowId: string;
};

/**
 * The body of `update-flow-settings` the relay sends: the Flow, and in its
 * settings patch the humanness and nothing else, so a panel message cannot
 * rename a Flow or change any other setting through it.
 */
export type CoreFlowHumannessSetBody = {
  projectId: string;
  flowId: string;
  flow: { flowId: string; metadata: { humanness: number | null } };
};

/** The body of `update-task-settings` the relay sends: exactly these fields. */
export type CoreTaskHumannessSetBody = {
  projectId: string;
  taskId: string;
  humanness: number | null;
};
