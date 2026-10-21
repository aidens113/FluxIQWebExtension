// Two trials' stored rows compared record by record -- the rows Core serves as
// each run's answer, read from the store as the Lab reads them
// (`../oracle/trial-datasets.ts`) -- in counts and equalities only: the rows
// themselves are page content and never leave this function.

import type { FlowRunDataset } from "../../flow-lane/index.js";

export type StoredRowsComparison = Readonly<{
  liveDatasets: number;
  offlineDatasets: number;
  liveRows: number;
  offlineRows: number;
  /** Positions, in dataset then row order, where both sides hold a row and the rows are equal. */
  equalPositions: number;
  /** Same datasets (by id), same rows, same order. */
  equal: boolean;
}>;

export function compareStoredRows(live: readonly FlowRunDataset[], offline: readonly FlowRunDataset[]): StoredRowsComparison {
  const rows = (datasets: readonly FlowRunDataset[]) => datasets.flatMap((dataset) => dataset.records.map((record) => JSON.stringify(record)));
  const left = rows(live);
  const right = rows(offline);
  let equalPositions = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) if (left[index] === right[index]) equalPositions += 1;
  const sameIds = live.length === offline.length && live.every((dataset, index) => dataset.datasetId === offline[index]?.datasetId && dataset.records.length === offline[index]?.records.length);
  return Object.freeze({
    liveDatasets: live.length, offlineDatasets: offline.length, liveRows: left.length, offlineRows: right.length, equalPositions,
    equal: sameIds && left.length === right.length && equalPositions === left.length,
  });
}
