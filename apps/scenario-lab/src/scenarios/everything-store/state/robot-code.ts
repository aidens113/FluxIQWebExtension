const ALPHABET = "ABCEFGHJKLMNPRTUXY";

/**
 * The characters the robot check shows for one image. Drawn from the lab seed
 * and the image number, from an alphabet without the letters a person
 * confuses (no O and 0, no I and 1), six at a time.
 */
export function robotCode(seed: number, image: number): string {
  let value = (Math.imul(seed ^ 0x5bd1e995, 0x01000193) + Math.imul(image + 1, 0x9e3779b1)) >>> 0;
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    value = Math.imul(value ^ (value >>> 13), 0x5bd1e995) >>> 0;
    code += ALPHABET[value % ALPHABET.length] ?? "K";
  }
  return code;
}
