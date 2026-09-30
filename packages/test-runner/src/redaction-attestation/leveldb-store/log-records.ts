/** LevelDB's log block size: a record never spans a block without being fragmented. */
const LOG_BLOCK_BYTES = 32_768;
const LOG_HEADER_BYTES = 7;

/**
 * The logical records of a LevelDB log file (a `.log` write-ahead log or a
 * `MANIFEST-*`), reassembled from their fragments (leveldb doc/log_format.md).
 *
 * The file is a sequence of 32 KiB blocks, each record fragment preceded by a
 * seven-byte header (checksum, length, type), and a record that crosses a block
 * boundary is split into FIRST, MIDDLE and LAST fragments. A literal a boundary
 * cuts therefore has a header's bytes inside it in the raw file, and is found
 * only in the reassembled record.
 *
 * `complete` is false when a header claims more bytes than its block holds or a
 * fragment arrives out of sequence: the records up to there are returned, and
 * the rest of the file is left to the raw byte search. Checksums are not
 * verified; a torn tail is still searched.
 */
export function logRecords(file: Buffer): { records: Buffer[]; complete: boolean } {
  const records: Buffer[] = [];
  let pending: Buffer[] | undefined;
  let position = 0;
  while (position < file.length) {
    const blockEnd = Math.min(file.length, (Math.floor(position / LOG_BLOCK_BYTES) + 1) * LOG_BLOCK_BYTES);
    if (blockEnd - position < LOG_HEADER_BYTES) { position = blockEnd; continue; }
    const length = file.readUInt16LE(position + 4);
    const type = file[position + 6]!;
    const start = position + LOG_HEADER_BYTES;
    if (type === 0 && length === 0) { position = blockEnd; continue; } // preallocated zeroes
    if (start + length > blockEnd) return { records, complete: false };
    const payload = file.subarray(start, start + length);
    position = start + length;
    if (type === 1 && pending === undefined) records.push(payload);
    else if (type === 2 && pending === undefined) pending = [payload];
    else if (type === 3 && pending !== undefined) pending.push(payload);
    else if (type === 4 && pending !== undefined) { pending.push(payload); records.push(Buffer.concat(pending)); pending = undefined; }
    else return { records, complete: false };
  }
  if (pending !== undefined) records.push(Buffer.concat(pending));
  return { records, complete: true };
}
