import { open, readFile } from "node:fs/promises";
import path from "node:path";
import { logRecords } from "./log-records.js";
import { tableBlocks } from "./table-blocks.js";

/**
 * The largest LevelDB file read whole to be decoded. Chromium's extension
 * storage writes tables of about 2 MiB and logs of a few MiB, so this is far
 * above what a run leaves; a larger file is still searched raw, in chunks.
 */
const DECODE_MAX_BYTES = 33_554_432;
const SEARCH_CHUNK_BYTES = 1_048_576;

/** What `searchLevelDbFile` read: whether a needle was found, how many bytes, and whether the file's structure was decoded too. */
export type LevelDbFileSearch = { found: boolean; bytes: number; decoded: boolean };

/**
 * Searches one LevelDB file for any of `needles` (a literal's UTF-8 and UTF-16LE
 * bytes) byte for byte, never skipping it as binary.
 *
 * - Every file is searched raw, whole.
 * - A log (`*.log`, `MANIFEST-*`) is also searched record by record, reassembled
 *   across its 32 KiB block boundaries (`logRecords`). Log records are never
 *   compressed.
 * - A table (`*.ldb`, `*.sst`) is also searched block by block after
 *   decompression (`tableBlocks`). A table's blocks may be Snappy-compressed, and
 *   a Snappy copy can replace part of a literal with a back-reference, so the raw
 *   search alone is best effort for a table.
 *
 * `decoded` is false for a log or table whose structure this reader could not
 * walk to its end, or that is over `DECODE_MAX_BYTES`: only the raw search covered
 * it, and for a Snappy table that is not a guarantee of absence. The caller
 * counts such files rather than failing on them, because the reader is not a
 * complete LevelDB implementation. Other names (`CURRENT`, `LOCK`, `LOG`) have no
 * structure to decode and report `decoded: true`.
 *
 * Throws when the file cannot be read, which the caller treats as unscanned.
 */
export async function searchLevelDbFile(file: string, needles: readonly Buffer[]): Promise<LevelDbFileSearch> {
  const name = path.basename(file);
  const structure = /\.(?:ldb|sst)$/u.test(name) ? "table" : /\.log$|^MANIFEST-/u.test(name) ? "log" : "none";
  const handle = await open(file, "r");
  let size: number;
  try { size = (await handle.stat()).size; }
  finally { await handle.close(); }
  if (size > DECODE_MAX_BYTES) {
    const raw = await searchInChunks(file, needles);
    return { ...raw, decoded: structure === "none" };
  }
  const bytes = await readFile(file);
  const contains = (buffer: Buffer): boolean => needles.some(needle => buffer.includes(needle));
  let found = contains(bytes);
  let decoded = true;
  if (structure === "log") {
    const read = logRecords(bytes);
    decoded = read.complete;
    found ||= read.records.some(contains);
  } else if (structure === "table") {
    const read = tableBlocks(bytes);
    decoded = read.decoded;
    if (read.decoded) found ||= read.blocks.some(contains);
  }
  return { found, bytes: bytes.length, decoded };
}

/** The raw search for a file too large to decode, one chunk at a time with an overlap a needle cut by a chunk boundary still spans. */
async function searchInChunks(file: string, needles: readonly Buffer[]): Promise<{ found: boolean; bytes: number }> {
  const overlap = Math.max(...needles.map(needle => needle.length)) - 1;
  const buffer = Buffer.alloc(overlap + SEARCH_CHUNK_BYTES);
  const handle = await open(file, "r");
  try {
    let carried = 0; let bytes = 0; let found = false;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, carried, SEARCH_CHUNK_BYTES, null);
      if (bytesRead === 0) return { found, bytes };
      bytes += bytesRead;
      const filled = carried + bytesRead;
      if (!found) found = needles.some(needle => buffer.subarray(0, filled).includes(needle));
      carried = Math.min(overlap, filled);
      buffer.copyWithin(0, filled - carried, filled);
    }
  } finally {
    await handle.close();
  }
}
