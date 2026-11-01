import { listenForPressAnswer, lookUntilSettled, markPressWork, markRequestStarts, type PressListener, type PressSignal } from "../../../action-runtime/ignored-press";
import type { WebAutomationNextPageRequest } from "../../../../shared/protocol";
import { isDisabled } from "../../pager-reading";
import { layerOverControl } from "../covered-press";
import { PaginationFault } from "../pagination-fault";
import { loadMoreContinuations } from "./continuation";

type Binding = ReturnType<typeof loadMoreContinuations.bind>;
type Proof = { binding: Binding; document: Document; control: Element };
type Observers = {
  listen(control: Element, note: (signal: PressSignal) => void): PressListener;
  request: typeof markRequestStarts;
  work: typeof markPressWork;
  look(control: Element): { settle(ms: number): Promise<boolean | "announced">; stop(): void };
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
    return {
      state,
      async settle(): Promise<"advanced" | PaginationFault | undefined> {
        if (!known || !request || !work || !look) return undefined;
        const until = Math.min(startedAt + 10_000, deadline ?? Infinity);
        while (!stopped && Date.now() < until) {
          listener?.flush();
          if (state() === "advanced") return "advanced";
          if (proof.document !== document || request.healthy?.() !== true || request.begunSince()
            || [...signals].some((signal) => signal !== "change") || work.state() === "unknown") return undefined;
          if (Date.now() - startedAt >= MIN_OBSERVATION_MS && work.state() === "idle" && state() === "unchanged" && safe()) {
            const remaining = Math.min(SETTLE_MS, until - Date.now());
            if (remaining <= 0) return undefined;
            const restored = await look.settle(remaining);
            listener?.flush();
            if (state() === "advanced") return "advanced";
            if (restored !== false && work.state() === "idle" && request.healthy?.() === true && !request.begunSince()
              && [...signals].every((signal) => signal === "change") && state() === "unchanged" && safe() && Date.now() < until) {
              const fault = new PaginationFault("list_unchanged", "The detected list loader was pressed once; supported work settled with the original list and page unchanged apart from status notices, and no request or other effect was observed.");
              faults.set(fault, proof);
              return fault;
            }
            return undefined;
          }
          await new Promise<void>((resolve) => setTimeout(resolve, POLL_MS));
        }
        return undefined;
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
