// Writing a Flow-lane run's adaptation measurements into its bundle.
//
// Core deletes an isolated run's workspace when the run ends, so the Flow, the
// run detail and the adaptations it created, trialled or replayed are only
// readable while the lane still holds Core -- which is where a lane records its
// evidence (`recordEvidence`, for the recorded lane and the created one alike).
// The reading and the measuring belong to the run evaluation
// (`run-evaluation/adaptation/`, lane t179), which also reads the file back; this
// is the lane's half: take the measurement at that moment and put it in the
// bundle, or put nothing there at all.
//
// **A failed read writes nothing.** A missing snapshot reads as unmeasured,
// which is true; a partial or invented one would be measured as a real run's.
// A bundle that refuses the write is the facility failing, and that is not
// swallowed.

/** Where the snapshot goes and how it is measured. `measure` is the evaluation's reader bound to this run. */
export type FlowLaneAdaptationSnapshot = {
  bundle: { writeStructured(bundlePath: string, value: unknown): Promise<unknown> };
  /** The bundle path the evaluation reads the measurements back from. */
  path: string;
  measure(): Promise<unknown>;
};

/** Measures the run's adaptations and writes them, answering whether anything was written. */
export async function writeFlowLaneAdaptationSnapshot(input: FlowLaneAdaptationSnapshot): Promise<boolean> {
  let measured: unknown;
  try {
    measured = await input.measure();
  } catch {
    return false;
  }
  await input.bundle.writeStructured(input.path, measured);
  return true;
}
