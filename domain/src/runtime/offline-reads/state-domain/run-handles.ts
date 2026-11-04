// What a run mints for itself, read as where it stands in that run (`run_handles`, and
// `run_clock` for the instant a list read judges dates at).
// A tab id means nothing to another run, so an exploration's click on its tab 41 and a Flow
// step's click with no tab named are one call. What a tab id does say, a run says too: this
// is the tab I started on, or another one. So one scope reads one run's calls in order:
//
// - the first tab a run names is the tab it stands in, the same as naming none, and leaves
//   the call. A run that opened a tab first (`newTab`) stands in that one, so it is not;
// - every other tab is written as its place among them (`tab#1`, `tab#2`), so a call on a
//   tab the run opened still differs from the same call on the first, and from a call on
//   another run's second tab only by which it opened first;
// - frame 0 is the top frame, the same as naming none; another frame is its place among
//   the frames the run named (`frame#1`). `browserFrameUrlPath`, which names a frame by
//   what it holds, stays in the key as written.
//
// **The instant.** A Flow's dispatch stamps a read that judges dates with its run's start
// (`extractList.now`), so two runs of one read differ only by when they ran. A simulated
// run stands on the recording's clock, so an instant inside the time the recording spans is
// the recording's own and leaves the call: the recording saw those dates. An instant outside
// it asks about another time, stays in the key, and is a gap. A call read with no clock (the
// recording's own, or a saved run walked as a simulated one) names its own run's instant.
//
// What this cannot see: a press that opened a tab by itself, before the run named any. Its
// first tab is then read as the one it started on, and the recorded answer's address is
// what still tells them apart. Rewriting an operation already rewritten changes nothing.

import { readClientGatewayTraceOperation, type ClientGatewayTraceOperation, type ClientGatewayTraceStateClockSpan } from "fluxiq/client-gateway";

const TOP_FRAME = 0;

export function webTraceStateHandleScope(clock?: ClientGatewayTraceStateClockSpan): (operation: ClientGatewayTraceOperation) => ClientGatewayTraceOperation {
  const tabs: number[] = [];
  const frames: number[] = [];
  let openedTab = false;
  return (operation) => {
    const parameters = recordOf(operation.compared.parameters);
    if (parameters === undefined) return operation;
    const tab = parameters.browserTabId;
    const frame = parameters.browserFrameId;
    const list = recordOf(parameters.extractList);
    const instant = list?.now;
    const ownInstant = typeof instant === "number" && (clock === undefined || (instant >= clock.fromMs && instant <= clock.toMs));
    const named = typeof tab === "number" || typeof frame === "number" || ownInstant;
    const opensTab = parameters.newTab === true;
    if (!named) {
      openedTab ||= opensTab;
      return operation;
    }
    const rewritten: Record<string, unknown> = { ...parameters };
    if (ownInstant) {
      const { now: _now, ...undated } = list!;
      rewritten.extractList = undated;
    }
    if (typeof tab === "number") {
      if (!tabs.includes(tab)) tabs.push(tab);
      const place = tabs.indexOf(tab) + (openedTab ? 1 : 0);
      if (place === 0) delete rewritten.browserTabId;
      else rewritten.browserTabId = `tab#${place}`;
    }
    if (typeof frame === "number") {
      if (frame === TOP_FRAME) delete rewritten.browserFrameId;
      else {
        if (!frames.includes(frame)) frames.push(frame);
        rewritten.browserFrameId = `frame#${frames.indexOf(frame) + 1}`;
      }
    }
    openedTab ||= opensTab;
    return readClientGatewayTraceOperation({ actionType: operation.actionType, target: operation.compared.target, parameters: rewritten });
  };
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
