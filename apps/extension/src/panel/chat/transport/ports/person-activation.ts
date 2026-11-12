/**
 * Whether the panel holds a person's live user activation now: a trusted press
 * or key in the last few seconds (`navigator.userActivation.isActive`). Where
 * the browser cannot say (no `userActivation`), the answer is no.
 */
export function personActivationIsActive(): boolean {
  const navigator = (globalThis as { navigator?: { userActivation?: { isActive?: unknown } } }).navigator;
  return navigator?.userActivation?.isActive === true;
}
