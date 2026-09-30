import { decodeSnappy } from "./decode-snappy.js";
import { readVarint } from "./read-varint.js";
import type { TableRead } from "./table-read.js";

const FOOTER_BYTES = 48;
const BLOCK_TRAILER_BYTES = 5;
const TABLE_MAGIC = Buffer.from([0x57, 0xfb, 0x80, 0x8b, 0x24, 0x75, 0x47, 0xdb]);

/**
 * Every data block of a LevelDB sorted table (`.ldb` / `.sst`), decompressed
 * (leveldb doc/table_format.md): the footer names the index block, each index
 * entry's value is the handle (offset, size) of one data block, and each block
 * is followed by a one-byte compression type and a checksum. Type 0 is stored
 * as is and type 1 is Snappy (`decodeSnappy`).
 *
 * Returns `decoded: false`, with the reason, for a table this reader cannot
 * decode -- no table magic, a handle outside the file, a malformed block, or a
 * compression type other than none or Snappy (LevelDB 1.23 added zstd as type
 * 2). The caller then has only the raw byte search for that table, which a
 * Snappy copy can defeat.
 */
export function tableBlocks(file: Buffer): TableRead {
  try {
    if (file.length < FOOTER_BYTES || !file.subarray(file.length - TABLE_MAGIC.length).equals(TABLE_MAGIC)) return { decoded: false, reason: "no table footer magic" };
    const footer = file.subarray(file.length - FOOTER_BYTES);
    const metaIndex = readHandle(footer, 0);
    const index = readHandle(footer, metaIndex.next);
    const indexBlock = readBlock(file, index);
    if (indexBlock === undefined) return { decoded: false, reason: "index block unreadable or of an unknown compression" };
    const blocks: Buffer[] = [];
    for (const value of blockValues(indexBlock)) {
      const block = readBlock(file, readHandle(value, 0));
      if (block === undefined) return { decoded: false, reason: "data block unreadable or of an unknown compression" };
      blocks.push(block);
    }
    return { decoded: true, blocks };
  } catch (error) {
    return { decoded: false, reason: error instanceof Error ? error.message : "malformed table" };
  }
}

function readHandle(input: Buffer, start: number): { offset: number; size: number; next: number } {
  const offset = readVarint(input, start);
  const size = readVarint(input, offset.next);
  return { offset: offset.value, size: size.value, next: size.next };
}

function readBlock(file: Buffer, handle: { offset: number; size: number }): Buffer | undefined {
  const end = handle.offset + handle.size;
  if (end + BLOCK_TRAILER_BYTES > file.length) return undefined;
  const contents = file.subarray(handle.offset, end);
  const type = file[end];
  if (type === 0) return contents;
  if (type === 1) return decodeSnappy(contents);
  return undefined;
}

/**
 * The values of a block's entries. An entry is `shared`, `non_shared` and
 * `value_length` varints, the unshared key bytes, then the value; the block ends
 * with its restart offsets and their count, which the entries stop before.
 */
function blockValues(block: Buffer): Buffer[] {
  if (block.length < 4) throw new Error("Truncated table block");
  const restarts = block.readUInt32LE(block.length - 4);
  const entriesEnd = block.length - 4 - restarts * 4;
  if (entriesEnd < 0) throw new Error("Table block restarts overrun it");
  const values: Buffer[] = [];
  let position = 0;
  while (position < entriesEnd) {
    const shared = readVarint(block, position);
    const unshared = readVarint(block, shared.next);
    const valueLength = readVarint(block, unshared.next);
    const valueStart = valueLength.next + unshared.value;
    position = valueStart + valueLength.value;
    if (position > entriesEnd) throw new Error("Table block entry overruns it");
    values.push(block.subarray(valueStart, position));
  }
  return values;
}
