type PressPosition = {
  box: { left: number; top: number; width: number; height: number };
  connected: boolean; focused: boolean; visibility: string;
  viewport: { width: number; height: number; dpr: number; scale: number; offsetLeft: number; offsetTop: number };
  centerHitsButton: boolean; pointHitsButton: boolean; centerTag: string | null;
};
type PressEvents = { down: { seen: boolean; hit: boolean }; up: { seen: boolean; hit: boolean }; click: { seen: boolean; hit: boolean } };

/** What the panel saw of the press, with generic geometry/event evidence when delivery missed. */
export type PressSeen = { seen: boolean; trusted: boolean; activation: boolean; observation?: { before: PressPosition; after: PressPosition; events: PressEvents } };

export type PanelTargetStep = { step: "locate"; label: string; key: string } | { step: "confirm"; key: string } | { step: "forget"; key: string };

/**
 * `locate`: the button's centre in the view's CSS pixels, or why there is no
 * button to press there. `confirm` and `forget`: what the watch saw, `null`
 * when no watch is held under that key.
 */
export type PanelTargetAnswer = { found: true; x: number; y: number } | { found: false; reason: string; scroll?: ReturnType<typeof panelScrollPlan> } | PressSeen | null;

/**
 * Runs inside the side panel's own document (`Runtime.evaluate` in its target),
 * with the self-contained scroll planner supplied explicitly as source text.
 *
 * `locate` finds the button the chat driver has always pressed -- exact
 * trimmed text, enabled -- among those with a box, checks that its centre
 * hits it rather than something drawn over it, and
 * starts a watch: a capturing `click` listener on the window, which runs
 * before any of the panel's own, records whether the click reached the button,
 * whether it was trusted, and whether the view had a person's activation then.
 * `confirm` reads the watch and ends it once it saw the click; `forget` ends it
 * whatever it saw.
 */
export function inPanelTarget(input: PanelTargetStep, planScroll: typeof panelScrollPlan): PanelTargetAnswer {
  const scope = globalThis as unknown as Window & Record<string, unknown>;
  if (input.step !== "locate") {
    const watch = scope[input.key] as (PressSeen & { stop(): void; observe(): NonNullable<PressSeen["observation"]> }) | undefined;
    if (!watch) return null;
    if (input.step === "forget" || watch.seen) {
      watch.stop();
      delete scope[input.key];
    }
    return { seen: watch.seen, trusted: watch.trusted, activation: watch.activation, observation: watch.observe() };
  }
  const document = scope.document;
  const button = Array.from(document.querySelectorAll("button")).find(candidate => candidate.textContent?.trim() === input.label && !candidate.disabled && candidate.getClientRects().length > 0);
  if (!button) return { found: false, reason: "not shown yet" };
  const position = (at?: { x: number; y: number }): PressPosition => {
    const box = button.getBoundingClientRect();
    const center = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    const point = at ? document.elementFromPoint(at.x, at.y) : center;
    return { box: { left: box.left, top: box.top, width: box.width, height: box.height }, connected: button.isConnected, focused: document.hasFocus(), visibility: document.visibilityState,
      viewport: { width: scope.innerWidth, height: scope.innerHeight, dpr: scope.devicePixelRatio, scale: scope.visualViewport?.scale ?? 1, offsetLeft: scope.visualViewport?.offsetLeft ?? 0, offsetTop: scope.visualViewport?.offsetTop ?? 0 },
      centerHitsButton: !!center && button.contains(center), pointHitsButton: !!point && button.contains(point), centerTag: center?.tagName.toLowerCase() ?? null };
  };
  const before = position();
  const x = before.box.left + before.box.width / 2;
  const y = before.box.top + before.box.height / 2;
  if (!before.centerHitsButton) {
    const scroll = planScroll(button, scope);
    return scroll ? { found: false, reason: `scrolling the "${input.label}" button into view`, scroll } : { found: false, reason: `the "${input.label}" button is covered at its centre by ${before.centerTag ?? "nothing"}` };
  }
  const pressed: HTMLButtonElement = button;
  const events: PressEvents = { down: { seen: false, hit: false }, up: { seen: false, hit: false }, click: { seen: false, hit: false } };
  const listen = (event: Event): void => {
    const kind = event.type === "mousedown" ? "down" : event.type === "mouseup" ? "up" : event.type === "click" ? "click" : null;
    if (!kind) return;
    const hit = pressed.contains(event.target as Node);
    events[kind] = { seen: true, hit };
    if (kind !== "click" || watch.seen || !hit) return;
    watch.seen = true;
    watch.trusted = event.isTrusted;
    watch.activation = (scope.navigator as Navigator & { userActivation?: { isActive?: boolean } }).userActivation?.isActive === true;
  };
  const watch = { seen: false, trusted: false, activation: false, observe: () => ({ before, after: position({ x, y }), events }), stop: () => {
    for (const type of ["mousedown", "mouseup", "click"]) scope.removeEventListener(type, listen, true);
  } };
  for (const type of ["mousedown", "mouseup", "click"]) scope.addEventListener(type, listen, true);
  scope[input.key] = watch;
  return { found: true, x, y };
}
import type { panelScrollPlan } from "./scroll-plan.js";

