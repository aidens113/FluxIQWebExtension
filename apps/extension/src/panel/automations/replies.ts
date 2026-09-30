// Readers for the replies to `runAutomation`, `runDetail` and `exportDataset`.
// Each takes the background's whole reply (`{ ok, payload }`) and answers
// undefined when the payload is not the shape the relay promises.

import type { DatasetExport, RunDataset, RunDetail, RunReply } from "./types";
import { readCore } from "./read-core";

/** Reads the three replies a run and its data answer with. */
export const readRunReplies = {
  /** `runAutomation`: `{ payload: { runSummary, createdAdaptationIds, durableBehaviorChanged } }`. */
  run(reply: unknown): RunReply | undefined {
    const payload = readCore.record(readCore.record(reply)?.payload);
    const run = readCore.run(payload?.runSummary);
    if (payload === undefined || run === undefined) return undefined;
    const durable = payload.durableBehaviorChanged;
    return {
      run,
      createdAdaptationIds: readCore.texts(payload.createdAdaptationIds),
      durableBehaviorChanged: typeof durable === "boolean" ? durable : undefined
    };
  },
  /** `runDetail`: `{ payload: { runDetail: { summary, adaptationIds, datasets }, adaptations } }`. */
  detail(reply: unknown): RunDetail | undefined {
    const payload = readCore.record(readCore.record(reply)?.payload);
    const detail = readCore.record(payload?.runDetail);
    if (payload === undefined || detail === undefined) return undefined;
    const datasets = (Array.isArray(detail.datasets) ? detail.datasets : [])
      .map((raw) => readCore.dataset(raw))
      .filter((dataset): dataset is RunDataset => dataset !== undefined);
    const adaptationStatuses = new Map<string, string>();
    for (const raw of Array.isArray(payload.adaptations) ? payload.adaptations : []) {
      const adaptation = readCore.record(raw);
      const id = readCore.text(adaptation?.adaptationId);
      const status = readCore.text(adaptation?.status);
      if (id !== undefined && status !== undefined) adaptationStatuses.set(id, status);
    }
    return { run: readCore.run(detail.summary), adaptationIds: readCore.texts(detail.adaptationIds), datasets, adaptationStatuses };
  },
  /** `exportDataset`: `{ payload: { export } }`. */
  export(reply: unknown): DatasetExport | undefined {
    const exported = readCore.record(readCore.record(readCore.record(reply)?.payload)?.export);
    if (exported === undefined) return undefined;
    if (exported.tooLarge === true) return { tooLarge: true };
    const fileName = readCore.text(exported.fileName);
    const contentType = readCore.text(exported.contentType);
    if (exported.tooLarge !== false || fileName === undefined || contentType === undefined || typeof exported.body !== "string") return undefined;
    return { tooLarge: false, fileName, contentType, body: exported.body };
  }
};
