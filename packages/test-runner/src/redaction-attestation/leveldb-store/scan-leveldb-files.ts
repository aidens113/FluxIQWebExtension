import path from "node:path";
import type { SecretLeakFindingCategory } from "../../secret-leak-attestation.js";
import { searchLevelDbFile } from "./search-leveldb-file.js";

/** What `scanLevelDbFiles` read and found. Paths are relative and unredacted; the caller redacts them. */
export type LevelDbScan = { scannedFiles: number; scannedBytes: number; undecodedFiles: number; findings: Array<{ path: string; category: SecretLeakFindingCategory }> };

/**
 * Searches each LevelDB file (`relatives`, `/`-separated under `root`) once for
 * every literal, in UTF-8 and UTF-16LE: Chromium's `chrome.storage` keeps JSON as
 * UTF-8, and IndexedDB serializes a two-byte string as UTF-16LE (a one-byte one
 * as Latin-1, which for an ASCII literal is its UTF-8). A file it finds a literal
 * in is a `secret-literal` finding, one it cannot read an `unscanned-store`. A log
 * or table whose structure `searchLevelDbFile` could not walk is counted in
 * `undecodedFiles` rather than failed on: its raw bytes were still searched, and
 * the reader is not a complete LevelDB implementation.
 *
 * The literals are held to the text scan's minimum length, eight characters, so
 * a short one cannot match every file.
 */
export async function scanLevelDbFiles(root: string, relatives: readonly string[], literals: readonly string[]): Promise<LevelDbScan> {
  if (literals.some(literal => literal.length < 8)) throw new Error("A redaction literal must be at least eight characters");
  const needles = literals.flatMap(literal => [Buffer.from(literal, "utf8"), Buffer.from(literal, "utf16le")]);
  const result: LevelDbScan = { scannedFiles: 0, scannedBytes: 0, undecodedFiles: 0, findings: [] };
  for (const relative of relatives) {
    let search;
    try { search = await searchLevelDbFile(path.join(root, ...relative.split("/")), needles); }
    catch { result.findings.push({ path: relative, category: "unscanned-store" }); continue; }
    result.scannedFiles += 1;
    result.scannedBytes += search.bytes;
    if (!search.decoded) result.undecodedFiles += 1;
    if (search.found) result.findings.push({ path: relative, category: "secret-literal" });
  }
  return result;
}
