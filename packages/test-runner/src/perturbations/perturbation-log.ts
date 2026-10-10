import type { RunPerturbation } from "./run-perturbation.js";

/** A detail value: a scalar only, so nothing a frame or a page carried can ride into the record by accident. */
export type PerturbationDetailValue = string | number | boolean | null;
export type PerturbationDetail = Readonly<Record<string, PerturbationDetailValue>>;

/** One thing the perturbation saw or did, stamped with this machine's clock (`atMs`, epoch ms) and as ISO text. */
export type PerturbationEvent = { at: string; atMs: number; event: string; detail?: PerturbationDetail };

/** What the extension and Core said, read some time after the fault fired; each side is screened, or says why it could not be read. */
export type AfterFaultObservation = { afterMs: number; at: string; extension: unknown; core: unknown };

/**
 * The run bundle's `snapshots/perturbation.json`: the perturbation declared,
 * whether and when it fired, everything it saw in order, and what the
 * extension and Core reported afterwards.
 */
export type PerturbationReport = {
  perturbation: RunPerturbation;
  fired: boolean;
  firedAt: string | null;
  /** The event that counts as the fault, such as `fault.fired` with the dropped command, or `worker.stopped`. */
  firedEvent: string | null;
  events: PerturbationEvent[];
  afterFault: AfterFaultObservation[];
};

/**
 * The perturbation's own record. `fire` marks the one moment the fault
 * happened (the first call wins) and tells whoever waits for it; `record`
 * notes everything around it.
 */
export class PerturbationLog {
  private readonly events: PerturbationEvent[] = [];
  private readonly observations: AfterFaultObservation[] = [];
  private fired: PerturbationEvent | undefined;
  private readonly listeners: Array<(event: PerturbationEvent) => void> = [];

  constructor(readonly perturbation: RunPerturbation, private readonly now: () => number = Date.now) {}

  record(event: string, detail?: PerturbationDetail): PerturbationEvent {
    const atMs = this.now();
    const entry: PerturbationEvent = { at: new Date(atMs).toISOString(), atMs, event, ...(detail ? { detail: { ...detail } } : {}) };
    this.events.push(entry);
    return entry;
  }

  /** Records the fault. A second fault is recorded as `fault.repeated` and changes nothing: each perturbation fires once. */
  fire(event: string, detail?: PerturbationDetail): void {
    if (this.fired) {
      this.record("fault.repeated", { event, ...(detail ?? {}) });
      return;
    }
    const entry = this.record(event, detail);
    this.fired = entry;
    for (const listener of this.listeners.splice(0)) listener(entry);
  }

  /** Calls `listener` once the fault has fired; at once when it already has. */
  onFired(listener: (event: PerturbationEvent) => void): void {
    if (this.fired) listener(this.fired);
    else this.listeners.push(listener);
  }

  firedAtMs(): number | undefined { return this.fired?.atMs; }

  observe(observation: AfterFaultObservation): void { this.observations.push(observation); }

  report(): PerturbationReport {
    return {
      perturbation: this.perturbation,
      fired: this.fired !== undefined,
      firedAt: this.fired?.at ?? null,
      firedEvent: this.fired?.event ?? null,
      events: this.events.map(event => ({ ...event })),
      afterFault: [...this.observations],
    };
  }
}
