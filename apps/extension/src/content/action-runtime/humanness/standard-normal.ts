// One draw from the standard normal distribution, made from two uniform draws
// of a command's generator (the Box-Muller transform). Two draws every time, so
// the generator's sequence, and every choice after this one, stays reproducible.

/** A standard normal number (mean 0, standard deviation 1) from two draws of `random`. */
export function standardNormal(random: () => number): number {
  // `1 - u` lies in (0, 1], so the logarithm is finite.
  const radius = Math.sqrt(-2 * Math.log(1 - random()));
  return radius * Math.cos(2 * Math.PI * random());
}
