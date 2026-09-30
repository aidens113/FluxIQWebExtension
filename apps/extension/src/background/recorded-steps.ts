// Which recording event each recorded step in the panel's log was sent as.
//
// The panel names a step by the `ActivityEntry.id` its log showed. Removing it
// means removing the recording event behind it -- from the offline queue if it
// was never sent, from Core's recording if it was -- and that event is named by
// the recording it belongs to and its `eventId`, which Core keeps on the
// recorded entries as `metadata.eventId` (`runtime/io-bridge.ts` in FluxIQ Core).
//
// Bounded like the log it indexes, and held in the worker only: a step shown
// before the worker restarted cannot be removed from here afterwards, and the
// relay says so rather than guessing.

export type RecordedStepRef = {
  readonly recordingId: string;
  readonly eventId: string;
};

export const RECORDED_STEP_INDEX_LIMIT = 500;

export class RecordedStepIndex {
  private readonly steps = new Map<string, RecordedStepRef>();

  note(activityId: string, step: RecordedStepRef): void {
    this.steps.set(activityId, step);
    // A Map iterates in insertion order, so the first key is the oldest.
    while (this.steps.size > RECORDED_STEP_INDEX_LIMIT) {
      const oldest = this.steps.keys().next().value;
      if (oldest === undefined) break;
      this.steps.delete(oldest);
    }
  }

  lookup(activityId: string): RecordedStepRef | undefined {
    return this.steps.get(activityId);
  }

  forget(activityId: string): void {
    this.steps.delete(activityId);
  }
}
