import { readVarint } from "./read-varint.js";

/**
 * Decodes one raw Snappy block (github.com/google/snappy, format_description.txt),
 * the compression LevelDB applies to each block of a sorted table: a varint
 * uncompressed length, then literal runs and back-references (copies) into what
 * has been decoded so far. A copy is what can split a literal in the compressed
 * bytes, which is why a table is decoded before it is searched.
 *
 * Throws on a malformed block: a truncated element, a copy reaching before the
 * start, or a result longer or shorter than the declared length.
 */
export function decodeSnappy(input: Buffer): Buffer {
  const header = readVarint(input, 0);
  const output = Buffer.alloc(header.value);
  let position = header.next;
  let written = 0;
  const need = (count: number): void => { if (position + count > input.length) throw new Error("Truncated Snappy block"); };
  while (position < input.length) {
    const tag = input[position++]!;
    const kind = tag & 3;
    if (kind === 0) {
      let length = (tag >> 2) + 1;
      if (length > 60) {
        const bytes = length - 60;
        need(bytes);
        length = input.readUIntLE(position, bytes) + 1;
        position += bytes;
      }
      need(length);
      if (written + length > output.length) throw new Error("Snappy block longer than declared");
      input.copy(output, written, position, position + length);
      position += length; written += length;
      continue;
    }
    let length: number; let offset: number;
    if (kind === 1) { need(1); length = 4 + ((tag >> 2) & 7); offset = ((tag >> 5) << 8) | input[position++]!; }
    else if (kind === 2) { need(2); length = (tag >> 2) + 1; offset = input.readUInt16LE(position); position += 2; }
    else { need(4); length = (tag >> 2) + 1; offset = input.readUInt32LE(position); position += 4; }
    if (offset === 0 || offset > written) throw new Error("Snappy copy reaches before the block");
    if (written + length > output.length) throw new Error("Snappy block longer than declared");
    for (let index = 0; index < length; index += 1, written += 1) output[written] = output[written - offset]!;
  }
  if (written !== output.length) throw new Error("Snappy block shorter than declared");
  return output;
}
