// What a node run's refusal names instead, where the call itself was the
// mistake: a node this domain cannot run, or a handle written in a shape the
// resolver does not read. Moved out of `../run.ts` (2026-11-10) when its timing
// spans took it past the 800-line limit; both details are only ever built
// there, and neither reads the page.

import type { JsonObject } from "fluxiq/core";
import { webPlanFirstTargetHandle } from "../../plan-resolution";
import { rejectionDetail } from "../../tool-rejection";
import { webRunnableNodeIds } from "../catalog";

/** The shapes a handle is written in, as a refusal names them (`../handle-shape/` puts a bare one into the first). */
const HANDLE_SHAPE = ['target: {"handle": "tN"}', 'extractList: {"handle": "extraction.N"}'];

/** The details a node run's refusal of its own call carries. */
export const webNodeRefusalDetail = {
  handleShape: HANDLE_SHAPE,
  /** What the call could have named instead: every node this domain can run. */
  unknownNode(named: unknown) {
    return rejectionDetail({
      reason: "node_not_runnable_here",
      target: typeof named === "string" ? named.slice(0, 200) : undefined,
      instead: webRunnableNodeIds(),
      missing: undefined,
      requestId: undefined
    });
  },
  /** The handle refusal, carrying the handle the call named and the resolver's own codes. */
  handle(parameters: JsonObject, issueCodes: readonly string[]) {
    return rejectionDetail({
      reason: "parameters_not_resolved",
      target: webPlanFirstTargetHandle(parameters),
      // The codes, and then the shapes a handle is accepted in. A live build was refused `web.handle.extraction_required` fifteen times
      // and never once corrected the shape, because a code is a name for a mistake and not a statement of what is accepted instead (`run-mudabxqd-266e728d`).
      instead: [...issueCodes.map((code) => String(code).slice(0, 100)).slice(0, 12), ...HANDLE_SHAPE],
      missing: undefined,
      requestId: undefined
    });
  }
};
