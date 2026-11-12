// A human delay: right-skewed around its mean, as reaction and keystroke times
// are -- most a little under the mean, a few well over it, none below zero. A
// log-normal draw with the given mean.

import { standardNormal } from "./standard-normal";

/** A log-normal delay whose mean is `meanMs`; `spread` is the log's standard deviation. Two draws of `random`. */
export function skewedDelayMs(random: () => number, meanMs: number, spread: number): number {
  return meanMs * Math.exp(spread * standardNormal(random) - (spread * spread) / 2);
}
