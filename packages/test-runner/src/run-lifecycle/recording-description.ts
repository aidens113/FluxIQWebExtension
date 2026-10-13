import { RunnerFailure } from "../failure.js";

/** Explicit fixture-authored demonstration context, independent of task instructions and generated names. */
export function recordingStartMessage(description: unknown): { type: "fluxiq.startRecording"; description: string } {
  if (typeof description !== "string" || !description.trim() || description.trim().length > 4000) {
    throw new RunnerFailure("fixture.invalid", "Recording needs an explicit fixture-authored description of what it demonstrates, up to 4000 characters.", { details: { code: "recording.description_required" } });
  }
  return { type: "fluxiq.startRecording", description: description.trim() };
}
