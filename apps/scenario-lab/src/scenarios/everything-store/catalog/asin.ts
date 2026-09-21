const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

/** A ten-character listing id in the store's `B0` form, drawn from `random`. */
export function asin(random: () => number): string {
  let id = "B0";
  for (let index = 0; index < 8; index += 1) id += ALPHABET[Math.floor(random() * ALPHABET.length)] ?? "X";
  return id;
}
