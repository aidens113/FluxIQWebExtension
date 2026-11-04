/** What a person reads after Forget. They must never believe a trust ended when Core has not heard. */
export function forgetOutcomeWords(reachedCore: boolean | undefined): string {
  if (reachedCore === false) return "This browser forgot its pairing, but FluxIQ could not be reached, so it still trusts this browser. It will be told when this browser can reach it. To end it now, revoke this browser under Connected browsers in FluxIQ.";
  return "Pairing forgotten. Connect again to pair this browser.";
}
