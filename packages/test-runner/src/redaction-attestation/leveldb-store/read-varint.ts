/**
 * Reads one little-endian base-128 varint, as LevelDB and Snappy write lengths
 * and offsets, and says where the next field starts. Throws when the varint
 * runs off the end or exceeds 32 bits, which no field read here may.
 */
export function readVarint(input: Buffer, start: number): { value: number; next: number } {
  let value = 0;
  for (let index = 0; index < 5; index += 1) {
    const byte = input[start + index];
    if (byte === undefined) throw new Error("Truncated varint");
    value += (byte & 0x7f) * 2 ** (7 * index);
    if ((byte & 0x80) === 0) {
      if (value > 0xffff_ffff) throw new Error("Varint exceeds 32 bits");
      return { value, next: start + index + 1 };
    }
  }
  throw new Error("Varint exceeds 32 bits");
}
