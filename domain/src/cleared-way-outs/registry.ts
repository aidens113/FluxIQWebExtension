// The ways out a client pressed, kept on this domain's server half under an
// opaque reference (t470).
//
// The clearing reports each layer it closed with the control it pressed
// (`../actions/cleared-layers.ts` `wayOut`): a page address and an element
// descriptor. Core keeps a run's trace and must never hold page structure it
// did not ask for, so the dispatcher keeps the descriptor here and hands Core a
// reference (`../io/gateway-output-dispatcher.ts`). A candidate trial gives the
// reference back, and the evidence runtime looks the way out up to name it by a
// handle the model may write (`../runtime/llm-evidence/way-out-handles/`).
//
// Bounded: the newest `RETAINED_WAY_OUTS` are kept and the oldest let go; a
// reference let go, or never kept, names nothing. A reference is random, so it
// says nothing of the page and cannot be guessed.
//
// **Kept with the Flow** (t728, audit finding 8). A way out pressed during one
// build is named again in that build's trials and in later runs of the Flow,
// so when the dispatch names its Flow each way out is also written through to
// Core's durable domain build state, Flow-scoped (no build id), and a lookup
// that misses here -- after a restart -- reads that Flow's record. The record
// holds the references and the way outs as kept here, nothing more, bounded by
// count as here and by bytes under Core's own bound on one value. Writing is
// best effort: a refused or failed write leaves the record as it was, and this
// process's copy still answers.

import { randomUUID } from "node:crypto";
import { AutomationStudioDomainBuildStateRefusal, type AutomationStudioDomainBuildState, type AutomationStudioDomainBuildStateScope } from "fluxiq/automation-studio";
import type { JsonValue } from "fluxiq/core";
import type { WebAutomationClearedWayOut } from "../actions/cleared-layers";

/** Ways out kept at once: far above what one trial presses, and a trial asks right after its run. */
const RETAINED_WAY_OUTS = 256;
/** Bytes of one Flow's stored record, under Core's 64 KiB bound on one value. */
const STORED_BYTES = 60 * 1024;
/** The record's key in a Flow's durable build state. */
const STORED_KEY = "web.cleared-way-outs";
/** Flows whose records this process holds at once; one let go is read again from the store. */
const RETAINED_FLOWS = 16;

/** The Flow a way out was pressed for. */
export type WebAutomationClearedWayOutFlow = { projectId: string; flowId: string };

export type WebAutomationClearedWayOuts = {
  /** Keeps `wayOut` and answers the reference Core may carry for it; with `flow`, also in that Flow's durable record. */
  keep(wayOut: WebAutomationClearedWayOut, flow?: WebAutomationClearedWayOutFlow): string;
  /** The way out this process kept under `reference`, or undefined when it was let go or never kept. */
  get(reference: string): WebAutomationClearedWayOut | undefined;
  /** As `get`, and on a miss the way out `flow`'s durable record keeps under `reference`. */
  find(reference: string, flow?: WebAutomationClearedWayOutFlow): Promise<WebAutomationClearedWayOut | undefined>;
  /** Resolves once every write to a Flow's record has gone out. Never rejects. */
  settled(): Promise<void>;
};

/** One Flow's record as this process holds it: read from the store once, then kept in step with it. */
type FlowRecord = { loaded: boolean; kept: Map<string, WebAutomationClearedWayOut>; queue: Promise<void> };

export function createWebAutomationClearedWayOuts(buildState: () => AutomationStudioDomainBuildState | undefined = () => undefined): WebAutomationClearedWayOuts {
  const kept = new Map<string, WebAutomationClearedWayOut>();
  const flows = new Map<string, FlowRecord>();
  const recordOf = (flow: WebAutomationClearedWayOutFlow): FlowRecord => {
    const slot = `${flow.projectId}\u0000${flow.flowId}`;
    const record = flows.get(slot) ?? { loaded: false, kept: new Map(), queue: Promise.resolve() };
    flows.delete(slot);
    flows.set(slot, record);
    for (const oldest of flows.keys()) {
      if (flows.size <= RETAINED_FLOWS) break;
      flows.delete(oldest);
    }
    return record;
  };
  // Every read and write of one Flow's record goes through its queue, in order. The step's own outcome is its caller's.
  const queued = (record: FlowRecord, step: () => Promise<void>): Promise<void> => {
    const ran = record.queue.then(step);
    record.queue = ran.then(() => undefined, () => undefined);
    return ran;
  };
  const load = async (store: AutomationStudioDomainBuildState, scope: AutomationStudioDomainBuildStateScope, record: FlowRecord): Promise<void> => {
    if (record.loaded) return;
    const stored = await store.get(scope, STORED_KEY);
    // What the store held is older than anything kept here since.
    record.kept = new Map([...storedWayOuts(stored), ...record.kept]);
    record.loaded = true;
  };
  return {
    keep(wayOut, flow) {
      const reference = `way-out.${randomUUID().replace(/-/gu, "")}`;
      kept.set(reference, structuredClone(wayOut));
      for (const oldest of kept.keys()) {
        if (kept.size <= RETAINED_WAY_OUTS) break;
        kept.delete(oldest);
      }
      const store = flow === undefined ? undefined : buildState();
      if (flow !== undefined && store !== undefined) {
        const scope = { projectId: flow.projectId, flowId: flow.flowId };
        const record = recordOf(flow);
        record.kept.set(reference, structuredClone(wayOut));
        queued(record, async () => {
          await load(store, scope, record);
          record.kept = bounded(record.kept);
          await store.put(scope, STORED_KEY, [...record.kept].map(([key, value]) => [key, value as unknown as JsonValue]));
        }).catch(/* best-effort: this process's copy still answers, and a lost write costs only what a restart forgets */ () => undefined);
      }
      return reference;
    },
    get(reference) {
      const wayOut = kept.get(reference);
      return wayOut === undefined ? undefined : structuredClone(wayOut);
    },
    async find(reference, flow) {
      const here = kept.get(reference);
      if (here !== undefined) return structuredClone(here);
      const store = flow === undefined ? undefined : buildState();
      if (flow === undefined || store === undefined) return undefined;
      const record = recordOf(flow);
      try {
        await queued(record, () => load(store, { projectId: flow.projectId, flowId: flow.flowId }, record));
      } catch (error) {
        // A record Core refuses to read names no way out, as one let go does; any other failure is a fault.
        if (error instanceof AutomationStudioDomainBuildStateRefusal) return undefined;
        throw error;
      }
      const stored = record.kept.get(reference);
      return stored === undefined ? undefined : structuredClone(stored);
    },
    async settled() {
      await Promise.all([...flows.values()].map((record) => record.queue));
    }
  };
}

/** The newest way outs of a record, as many as fit both bounds; the oldest go first, and one too large to store at all never stands in the others' way. */
function bounded(record: Map<string, WebAutomationClearedWayOut>): Map<string, WebAutomationClearedWayOut> {
  const entries = [...record].filter((entry) => Buffer.byteLength(JSON.stringify(entry), "utf8") < STORED_BYTES).slice(-RETAINED_WAY_OUTS);
  let bytes = Buffer.byteLength(JSON.stringify(entries), "utf8");
  while (entries.length > 0 && bytes > STORED_BYTES) {
    const [dropped] = entries.splice(0, 1);
    bytes -= Buffer.byteLength(JSON.stringify(dropped), "utf8") + 1;
  }
  return new Map(entries);
}

/** The way outs a stored record holds; an entry that is not one is skipped, and a value that is not a record at all holds none. */
function storedWayOuts(stored: JsonValue | undefined): Array<[string, WebAutomationClearedWayOut]> {
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((entry): Array<[string, WebAutomationClearedWayOut]> => {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string") return [];
    const wayOut = entry[1];
    if (wayOut === null || typeof wayOut !== "object" || Array.isArray(wayOut) || typeof wayOut.url !== "string") return [];
    const element = wayOut.element;
    if (element === null || typeof element !== "object" || Array.isArray(element)) return [];
    return [[entry[0], { url: wayOut.url, element: element as Record<string, unknown> }]];
  });
}
