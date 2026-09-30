import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { decodeSnappy, isLevelDbFile, logRecords, searchLevelDbFile, tableBlocks } from "../index.js";

const literal = "synthetic-redaction-password-0001";
const needles = [Buffer.from(literal, "utf8"), Buffer.from(literal, "utf16le")];

function varint(value: number): Buffer {
  const bytes: number[] = [];
  do { let byte = value & 0x7f; value >>>= 7; if (value) byte |= 0x80; bytes.push(byte); } while (value);
  return Buffer.from(bytes);
}

/** A Snappy literal element (length 1..60). */
function snappyLiteral(bytes: Buffer): Buffer { return Buffer.concat([Buffer.from([(bytes.length - 1) << 2]), bytes]); }
/** A Snappy copy element with a two-byte offset. */
function snappyCopy(length: number, offset: number): Buffer { const element = Buffer.alloc(3); element[0] = ((length - 1) << 2) | 2; element.writeUInt16LE(offset, 1); return element; }

/**
 * `prefix + "-password-0001|" + literal` Snappy-compressed so that the literal's
 * tail "-password-0001" is a copy of the prefix's: the compressed bytes never
 * hold the literal whole, only the decoded block does.
 */
function snappySplittingLiteral(): { compressed: Buffer; plain: Buffer } {
  const head = Buffer.from("abcd-password-0001|synthetic-redaction", "utf8");
  const plain = Buffer.concat([head, Buffer.from("-password-0001", "utf8")]);
  const compressed = Buffer.concat([varint(plain.length), snappyLiteral(head), snappyCopy(14, head.length - 4)]);
  return { compressed, plain };
}

/** A block of LevelDB entries with no shared key prefixes and one restart point. */
function block(entries: Array<[Buffer, Buffer]>): Buffer {
  const body = entries.map(([key, value]) => Buffer.concat([varint(0), varint(key.length), varint(value.length), key, value]));
  const tail = Buffer.alloc(8); tail.writeUInt32LE(0, 0); tail.writeUInt32LE(1, 4);
  return Buffer.concat([...body, tail]);
}

/** A one-data-block sorted table laid out as leveldb doc/table_format.md specifies, the data block stored with `compression`. */
function table(dataContents: Buffer, compression: number): Buffer {
  const trailer = (type: number) => Buffer.from([type, 0, 0, 0, 0]);
  const data = Buffer.concat([dataContents, trailer(compression)]);
  const metaIndexContents = block([]);
  const metaIndexOffset = data.length;
  const metaIndex = Buffer.concat([metaIndexContents, trailer(0)]);
  const indexContents = block([[Buffer.from("k"), Buffer.concat([varint(0), varint(dataContents.length)])]]);
  const indexOffset = metaIndexOffset + metaIndex.length;
  const index = Buffer.concat([indexContents, trailer(0)]);
  const handles = Buffer.concat([varint(metaIndexOffset), varint(metaIndexContents.length), varint(indexOffset), varint(indexContents.length)]);
  const footer = Buffer.concat([handles, Buffer.alloc(40 - handles.length), Buffer.from([0x57, 0xfb, 0x80, 0x8b, 0x24, 0x75, 0x47, 0xdb])]);
  return Buffer.concat([data, metaIndex, index, footer]);
}

/** A LevelDB log of `records`, fragmented across 32 KiB blocks with seven-byte headers (checksums left zero). */
function logFile(records: Buffer[]): Buffer {
  const parts: Buffer[] = [];
  let offset = 0;
  for (const record of records) {
    let rest = record; let first = true;
    for (;;) {
      const left = 32_768 - (offset % 32_768);
      if (left < 7) { parts.push(Buffer.alloc(left)); offset += left; continue; }
      const take = Math.min(rest.length, left - 7);
      const last = take === rest.length;
      const header = Buffer.alloc(7); header.writeUInt16LE(take, 4); header[6] = first ? (last ? 1 : 2) : (last ? 4 : 3);
      parts.push(header, rest.subarray(0, take)); offset += 7 + take;
      rest = rest.subarray(take); first = false;
      if (last) break;
    }
  }
  return Buffer.concat(parts);
}

async function tempFile(t: test.TestContext, name: string, contents: Buffer): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fluxiq-leveldb-search-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, name);
  await writeFile(file, contents);
  return file;
}

test("LevelDB's own file names are recognised and nothing else is", () => {
  for (const name of ["000003.log", "000005.ldb", "000007.sst", "MANIFEST-000001", "CURRENT", "LOCK", "LOG", "LOG.old"]) assert.equal(isLevelDbFile(name), true, name);
  for (const name of ["events.log", "notes.txt", "MANIFEST", "LOG.txt", "000005.ldb.bak"]) assert.equal(isLevelDbFile(name), false, name);
});

test("a Snappy block decodes literal runs and overlapping copies, and a malformed one throws", () => {
  const { compressed, plain } = snappySplittingLiteral();
  assert.deepEqual(decodeSnappy(compressed), plain);
  assert.equal(compressed.includes(Buffer.from(literal)), false);
  const run = Buffer.concat([varint(8), snappyLiteral(Buffer.from("ab")), snappyCopy(6, 2)]);
  assert.equal(decodeSnappy(run).toString(), "abababab");
  assert.throws(() => decodeSnappy(Buffer.concat([varint(8), snappyLiteral(Buffer.from("ab")), snappyCopy(6, 3)])));
  assert.throws(() => decodeSnappy(Buffer.concat([varint(9), snappyLiteral(Buffer.from("ab"))])));
});

test("a log record fragmented across a block boundary is reassembled whole", () => {
  const filler = Buffer.alloc(32_768 - 7 - 7 - 10, 0x61);
  const record = Buffer.concat([Buffer.from("value="), Buffer.from(literal)]);
  const file = logFile([filler, record]);
  assert.equal(file.includes(Buffer.from(literal)), false, "the block header must split the literal in the raw file");
  const read = logRecords(file);
  assert.equal(read.complete, true);
  assert.deepEqual(read.records, [filler, record]);
  assert.equal(logRecords(Buffer.concat([Buffer.from([0, 0, 0, 0, 0xff, 0x7f, 1])])).complete, false);
});

test("a table's Snappy data block is decompressed, and an unknown compression or missing magic is not decoded", () => {
  const { compressed } = snappySplittingLiteral();
  const snappy = table(compressed, 1);
  const read = tableBlocks(snappy);
  assert.ok(read.decoded);
  assert.equal(read.blocks.some(each => each.includes(Buffer.from(literal))), true);
  assert.equal(tableBlocks(table(compressed, 2)).decoded, false);
  assert.equal(tableBlocks(snappy.subarray(0, snappy.length - 1)).decoded, false);
});

test("the search finds a literal a Snappy copy split, and a literal in UTF-8 or UTF-16LE in a log", async t => {
  const { compressed } = snappySplittingLiteral();
  const split = await searchLevelDbFile(await tempFile(t, "000005.ldb", table(compressed, 1)), needles);
  assert.deepEqual(split, { found: true, bytes: table(compressed, 1).length, decoded: true });
  const utf8 = await searchLevelDbFile(await tempFile(t, "000003.log", logFile([Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(literal, "utf8")])])), needles);
  assert.equal(utf8.found, true);
  const utf16 = await searchLevelDbFile(await tempFile(t, "000004.log", logFile([Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(literal, "utf16le")])])), needles);
  assert.equal(utf16.found, true);
  const clean = await searchLevelDbFile(await tempFile(t, "000006.log", logFile([Buffer.from([0, 1, 2, 0, 255])])), needles);
  assert.deepEqual(clean, { found: false, bytes: 7 + 5, decoded: true });
  const opaque = await searchLevelDbFile(await tempFile(t, "000008.ldb", Buffer.from([0, 1, 2, 3, 0, 0, 0])), needles);
  assert.deepEqual(opaque, { found: false, bytes: 7, decoded: false });
});
