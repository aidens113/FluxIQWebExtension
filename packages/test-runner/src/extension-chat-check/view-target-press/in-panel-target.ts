/** What the panel saw of the press it was told to watch for. */
export type PressSeen = { seen: boolean; trusted: boolean; activation: boolean };

export type PanelTargetStep = { step: "locate"; label: string; key: string } | { step: "confirm"; key: string } | { step: "forget"; key: string };

/**
 * `locate`: the button's centre in the view's CSS pixels, or why there is no
 * button to press there (with the wheel turn that would bring it into view,
 * when it is only scrolled away). `confirm` and `forget`: what the watch saw,
 * `null` when no watch is held under that key.
 */
export type PanelTargetAnswer = { found: true; x: number; y: number } | { found: false; reason: string; wheel?: { x: number; y: number; deltaX: number; deltaY: number } } | PressSeen | null;

/**
 * Runs inside the side panel's own document (`Runtime.evaluate` in its target),
 * so it is self-contained: it is sent as its source text.
 *
 * `locate` finds the button the chat driver has always pressed -- exact
 * trimmed text, enabled -- among those with a box, and presses it where it
 * stands. It never scrolls the panel itself: the chat follows its newest
 * content and puts back any scroll that is not the person's own (Core's
 * `chat/view/scroll-follower.ts`), so a script's `scrollIntoView` moved the
 * button only until the chat's next frame, the hit test passed on the moved
 * button, and the mouse then landed where it had been, on whatever the chat
 * had scrolled back there (F16). A button scrolled out of the area that shows
 * -- the view, cut down by every ancestor that clips -- is answered with the
 * wheel turn a person would make, over the middle of that area, to bring it
 * there; the caller sends it as real wheel input, which the chat takes as the
 * person's own scrolling, and looks again.
 *
 * A button whose centre shows is checked to be what is under it rather than
 * something drawn over it, and a watch starts: a capturing `click` listener on
 * the window, which runs before any of the panel's own, records whether the
 * click reached the button, whether it was trusted, and whether the view had
 * a person's activation then. `confirm` reads the watch and ends it once it
 * saw the click; `forget` ends it whatever it saw.
 */
export function inPanelTarget(input: PanelTargetStep): PanelTargetAnswer {
  const scope = globalThis as unknown as Window & Record<string, unknown>;
  if (input.step !== "locate") {
    const watch = scope[input.key] as (PressSeen & { stop(): void }) | undefined;
    if (!watch) return null;
    if (input.step === "forget" || watch.seen) {
      watch.stop();
      delete scope[input.key];
    }
    return { seen: watch.seen, trusted: watch.trusted, activation: watch.activation };
  }
  const document = scope.document;
  const button = Array.from(document.querySelectorAll("button")).find(candidate => candidate.textContent?.trim() === input.label && !candidate.disabled && candidate.getClientRects().length > 0);
  if (!button) return { found: false, reason: "not shown yet" };
  const box = button.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  // What shows of the page: the view, cut down by every ancestor that clips what overflows it (the chat's own scroller among them).
  const shown = { left: 0, top: 0, right: scope.innerWidth, bottom: scope.innerHeight };
  for (let node = button.parentElement; node; node = node.parentElement) {
    const style = scope.getComputedStyle(node);
    if (style.overflowX === "visible" && style.overflowY === "visible") continue;
    const clip = node.getBoundingClientRect();
    shown.left = Math.max(shown.left, clip.left);
    shown.top = Math.max(shown.top, clip.top);
    shown.right = Math.min(shown.right, clip.right);
    shown.bottom = Math.min(shown.bottom, clip.bottom);
  }
  const acrossOut = x < shown.left || x > shown.right;
  const downOut = y < shown.top || y > shown.bottom;
  if (acrossOut || downOut) {
    // Only along the way it is out: the middle of what shows, where the wheel turns, is over the innermost scroller.
    const middle = { x: (shown.left + shown.right) / 2, y: (shown.top + shown.bottom) / 2 };
    return { found: false, reason: `the "${input.label}" button is scrolled out of view`, wheel: { x: middle.x, y: middle.y, deltaX: acrossOut ? Math.round(x - middle.x) : 0, deltaY: downOut ? Math.round(y - middle.y) : 0 } };
  }
  const hit = document.elementFromPoint(x, y);
  if (!hit || !button.contains(hit)) return { found: false, reason: `the "${input.label}" button is covered at its centre by ${hit ? hit.tagName.toLowerCase() : "nothing"}` };
  const pressed: HTMLButtonElement = button;
  const listen = (event: Event): void => {
    if (watch.seen || !pressed.contains(event.target as Node)) return;
    watch.seen = true;
    watch.trusted = event.isTrusted;
    watch.activation = (scope.navigator as Navigator & { userActivation?: { isActive?: boolean } }).userActivation?.isActive === true;
  };
  const watch = { seen: false, trusted: false, activation: false, stop: () => scope.removeEventListener("click", listen, true) };
  scope.addEventListener("click", listen, true);
  scope[input.key] = watch;
  return { found: true, x, y };
}
