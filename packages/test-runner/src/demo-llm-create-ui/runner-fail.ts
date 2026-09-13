// How this module refuses. Both throw the runner's own failure so a live run
// reports a behaviour fault rather than an unhandled error; the inspecting
// form additionally carries the reason code the topology checks are read by.

import { RunnerFailure } from "../failure.js";

export function fail(message: string): never { throw new RunnerFailure("runtime.behavior", message); }
export function inspectionFail(message: string, reasonCode: string): never { throw new RunnerFailure("runtime.behavior", message, { details: { reasonCode } }); }
