/** What the panel saw of the press it was told to watch for. */
export type PressSeen = { seen: boolean; trusted: boolean; activation: boolean };

export type PanelTargetStep = { step: "locate"; label: string; key: string } | { step: "confirm"; key: string } | { step: "forget"; key: string };

/**
 * `locate`: the button's centre in the view's CSS pixels, or why there is no
 * button to press there. `confirm` and `forget`: what the watch saw, `null`
 * when no watch is held under that key.
 */
export type PanelTargetAnswer = { found: true; x: number; y: number } | { found: false; reason: string } | PressSeen | null;

/**
 * Runs inside the side panel's own document (`Runtime.evaluate` in its target),
 * so it is self-contained: it is sent as its source text.
 *
 * `locate` finds the button the chat driver has always pressed -- exact
 * trimmed text, enabled -- among those with a box, scrolls it to the middle,
 * checks that its centre hits it rather than something drawn over it, and
 * starts a watch: a capturing `click` listener on the window, which runs
 * before any of the panel's own, records whether the click reached the button,
 * whether it was trusted, and whether the view had a person's activation then.
 * `confirm` reads the watch and ends it once it saw the click; `forget` ends it
 * whatever it saw.
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
  button.scrollIntoView({ block: "center", inline: "nearest" });
  const box = button.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
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
