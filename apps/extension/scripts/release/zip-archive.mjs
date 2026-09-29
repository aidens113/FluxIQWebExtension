// A minimal, dependency-free ZIP writer and reader for the store packages.
//
// The stores take a plain ZIP with manifest.json at its root. Node ships
// deflate and CRC-32 (zlib.crc32, Node 22.2+), so the format is written here
// rather than adding an archiver dependency. Output is reproducible: entries are
// sorted by name and every timestamp is the DOS epoch, so the same build always
// yields the same bytes and the same SHA-256. The reader exists so the packaging
// step can verify the archive it wrote rather than the directory it came from.

import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const DOS_EPOCH_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
const DOS_EPOCH_TIME = 0;
const UTF8_FLAG = 0x0800;

/**
 * @param {readonly { name: string, data: Buffer }[]} entries  names use "/" and are relative to the archive root
 * @returns {Buffer}
 */
export function writeZip(entries) {
  const sorted = [...entries].sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of sorted) {
    if (!name || name.startsWith("/") || name.includes("\\") || name.split("/").includes("..")) {
      throw new Error(`zip: refusing entry name "${name}"`);
    }
    const nameBytes = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const stored = compressed.length >= data.length;
    const body = stored ? data : compressed;
    const method = stored ? 0 : 8;
    const checksum = crc32(data) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_HEADER, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_EPOCH_TIME, 10);
    local.writeUInt16LE(DOS_EPOCH_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_HEADER, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_EPOCH_TIME, 12);
    central.writeUInt16LE(DOS_EPOCH_DATE, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += local.length + nameBytes.length + body.length;
  }
  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
  end.writeUInt16LE(sorted.length, 8);
  end.writeUInt16LE(sorted.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, end]);
}

/**
 * Reads every file entry of a ZIP written by `writeZip` (or any ZIP without
 * ZIP64 or encryption), verifying each entry's CRC-32.
 *
 * @param {Buffer} archive
 * @returns {{ name: string, data: Buffer }[]}
 */
export function readZip(archive) {
  const endOffset = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endOffset < 0) throw new Error("zip: no end-of-central-directory record");
  const count = archive.readUInt16LE(endOffset + 10);
  let cursor = archive.readUInt32LE(endOffset + 16);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(cursor) !== CENTRAL_HEADER) throw new Error(`zip: bad central header at ${cursor}`);
    const method = archive.readUInt16LE(cursor + 10);
    const checksum = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const name = archive.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;

    if (archive.readUInt32LE(localOffset) !== LOCAL_HEADER) throw new Error(`zip: bad local header for ${name}`);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const body = archive.subarray(start, start + compressedSize);
    if (name.endsWith("/")) continue;
    let data;
    if (method === 0) data = Buffer.from(body);
    else if (method === 8) data = inflateRawSync(body);
    else throw new Error(`zip: ${name} uses unsupported compression method ${method}`);
    if ((crc32(data) >>> 0) !== checksum) throw new Error(`zip: CRC mismatch for ${name}`);
    entries.push({ name, data });
  }
  return entries;
}
