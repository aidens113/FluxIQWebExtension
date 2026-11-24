// A campaign run's recorded reads proved against the task's oracle (t990, P1-P3 acceptance): the reads admitted and
// reproduced, read again by today's production reader, joined and processed by Core's own data path, and judged.
export { runRecordedOracleCommand } from "./command.js";
export { collectRecordedOracleAnswer, type RecordedOracleRead } from "./collect.js";
export { discoverRecordedOracleRead, type RecordedOracleReadIdentity } from "./discover.js";
export { judgeRecordedOracleTable } from "./oracle-table.js";
export { runRetainedRecordedRead, type RetainedRecordedRead } from "./retained-read.js";
export { recordedSnapshotGateway, type RecordedSnapshotCommand } from "./snapshot-gateway.js";
export { recordedOracleTaskProcess } from "./declarations.js";
export { declarationInRunTerms } from "./model-aliases.js";
