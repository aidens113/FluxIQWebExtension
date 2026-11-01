import { listenForPressAnswer, lookUntilSettled, markPressWork, markRequestStarts, type PressListener, type PressSignal, type SettledLook } from "../../../action-runtime/ignored-press";
import type { WebAutomationNextPageRequest } from "../../../../shared/protocol";
import { isDisabled } from "../../pager-reading";
import { layerOverControl } from "../covered-press";
import { PaginationFault } from "../pagination-fault";
import { loadMoreContinuations } from "./continuation";

type Binding = ReturnType<typeof loadMoreContinuations.bind>;
type Proof = { binding: Binding; document: Document; control: Element };
type LookRejection = NonNullable<ReturnType<NonNullable<SettledLook["rejection"]>>>;
type Rejection = "binding_unknown" | "request_probe_missing" | "request_probe_unhealthy" | "request_started"
  | "work_probe_missing" | "work_unknown" | "work_pending" | "non_change_signal" | "origin_changed"
  | "control_unsafe" | "look_unavailable" | `look_${LookRejection}` | "deadline" | "stopped";
type Observers = {
  listen(control: Element, note: (signal: PressSignal) => void): PressListener;
  request: typeof markRequestStarts;
  work: typeof markPressWork;
  look(control: Element): SettledLook | undefined;
  uncovered(control: Element): boolean;
};
const OBSERVERS: Observers = { listen: listenForPressAnswer, request: markRequestStarts, work: markPressWork,
  look: lookUntilSettled, uncovered: (control) => layerOverControl(control) === undefined };
const faults = new WeakMap<object, Proof>();
const outcomes = new WeakMap<object, Proof & { request: WebAutomationNextPageRequest }>();
const MIN_OBSERVATION_MS = 800;
const SETTLE_MS = 1_500;
const POLL_MS = 25;

/** The only path from supported browser observations to a consumable no-effect receipt. */
export const loaderSettlement = {
  watch(binding: Binding, control: Element, deadline: number | undefined, observers: Observers = OBSERVERS) {
    const known = loadMoreContinuations.current(binding) === control;
    const proof: Proof = { binding, document, control };
    const startedAt = Date.now();
    const signals = new Set<PressSignal>();
    const request = known ? observers.request(control) : undefined;
    const work = known ? observers.work(control) : undefined;
    const listener = known ? observers.listen(control, (signal) => signals.add(signal)) : undefined;
    const look = known ? observers.look(control) : undefined;
    const state = () => known ? loadMoreContinuations.state(binding) : undefined;
    const safe = (): boolean => proof.document === document && loadMoreContinuations.current(binding) === control
      && !isDisabled(control) && control.closest('[aria-busy="true"],[inert]') === null
      && control.getAttribute("hidden") === null && (typeof control.getClientRects !== "function" || control.getClientRects().length > 0)
      && observers.uncovered(control);
    let stopped = false;
    let rejection: Rejection | undefined;
    const reject = (reason: Rejection): undefined => {
      rejection ??= reason;
      return undefined;
    };
    return {
      state,
      /** Diagnostic only: never used to establish or consume the private proof. */
      rejection: () => rejection,
      async settle(): Promise<"advanced" | PaginationFault | undefined> {
        if (!known) return reject("binding_unknown");
        if (!request) return reject("request_probe_missing");
        if (!work) return reject("work_probe_missing");
        if (!look) return reject("look_unavailable");
        const until = Math.min(startedAt + 10_000, deadline ?? Infinity);
        let waiting: Rejection = "deadline";
        while (!stopped && Date.now() < until) {
          listener?.flush();
          const origin = state();
          if (origin === "advanced") return "advanced";
          if (origin !== "unchanged") waiting = "origin_changed";
          if (proof.document !== document) return reject("origin_changed");
          if (request.healthy?.() !== true) return reject("request_probe_unhealthy");
          if (request.begunSince()) return reject("request_started");
          if ([...signals].some((signal) => signal !== "change")) return reject("non_change_signal");
          const observedWork = work.state();
          if (observedWork === "unknown") return reject("work_unknown");
          if (observedWork === "pending") waiting = "work_pending";
          if (Date.now() - startedAt >= MIN_OBSERVATION_MS) {
            const readyWork = work.state();
            if (readyWork !== "idle") waiting = readyWork === "pending" ? "work_pending" : "work_unknown";
            else if (state() !== "unchanged") waiting = "origin_changed";
            else if (!safe()) waiting = "control_unsafe";
            else {
              const remaining = Math.min(SETTLE_MS, until - Date.now());
              if (remaining <= 0) return reject("deadline");
              const restored = await look.settle(remaining);
              listener?.flush();
              if (state() === "advanced") return "advanced";
              if (restored === false) {
                const reason = look.rejection?.();
                return reject(reason === undefined ? "look_not_restored" : `look_${reason}`);
              }
              const settledWork = work.state();
              if (settledWork !== "idle") return reject(settledWork === "pending" ? "work_pending" : "work_unknown");
              if (request.healthy?.() !== true) return reject("request_probe_unhealthy");
              if (request.begunSince()) return reject("request_started");
              if (![...signals].every((signal) => signal === "change")) return reject("non_change_signal");
              if (state() !== "unchanged") return reject("origin_changed");
              if (!safe()) return reject("control_unsafe");
              if (!(Date.now() < until)) return reject("deadline");
              const fault = new PaginationFault("list_unchanged", "The detected list loader was pressed once; supported work settled with the original list and page unchanged apart from status notices, and no request or other effect was observed.");
              faults.set(fault, proof);
              return fault;
            }
          }
          await new Promise<void>((resolve) => setTimeout(resolve, POLL_MS));
        }
        return reject(stopped ? "stopped" : waiting);
      },
      stop(): void {
        if (!stopped) {
          stopped = true;
          listener?.stop();
          look?.stop();
          work?.stop();
        }
      }
    };
  },
  transfer(error: unknown, outcome: object, request: WebAutomationNextPageRequest): void {
    if (typeof error !== "object" || error === null) return;
    const proof = faults.get(error);
    faults.delete(error);
    if (proof) outcomes.set(outcome, { ...proof, request });
  },
  consume(outcome: object, request: WebAutomationNextPageRequest): boolean {
    const proof = outcomes.get(outcome);
    outcomes.delete(outcome);
    return proof !== undefined && proof.request === request && proof.document === document
      && loadMoreContinuations.state(proof.binding) === "unchanged" && loadMoreContinuations.current(proof.binding) === proof.control;
  }
};
