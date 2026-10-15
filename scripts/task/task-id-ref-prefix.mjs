// Where an allocated task id is recorded, so nothing ever hands it out again:
// one local ref per id, `refs/fluxiq/task-ids/t<NNN>` (`task-id.mjs` says why).

export const TASK_ID_REF_PREFIX = "refs/fluxiq/task-ids/";
