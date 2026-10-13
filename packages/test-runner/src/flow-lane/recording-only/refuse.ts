import { RunnerFailure } from "../../failure.js";

/** A demonstration is supplementary evidence, never executable task authority. */
export function refuseRecordingOnlyFlow(): never {
  throw new RunnerFailure("recording.contract", "Recording-only Flow creation is retired. Write explicit automation instructions and use the existing instruction-led lane: pnpm lab run <scenario> --live-llm --llm-profile <profile> --llm-provider <provider> --llm-task create-flow --instruction-task <task>. A described recording may support those instructions; it cannot define the automation.", { details: { code: "automation.instruction_led_authoring_required" } });
}
