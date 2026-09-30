import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * The directories of a Chromium profile that hold extension storage, as
 * absolute paths, for the `extension-storage` redaction scope:
 *
 * - `Default/Local Extension Settings/<id>`: `chrome.storage.local`, where the
 *   FluxIQ extension keeps its settings, pairing session, client id, connection
 *   draft and queued recording events (`apps/extension/src/background/storage.ts`).
 * - `Default/Sync Extension Settings/<id>`: `chrome.storage.sync`, unused today,
 *   scanned when present.
 * - `Default/IndexedDB/chrome-extension_<id>_*`: an extension origin's IndexedDB,
 *   unused today, scanned when present. Web origins' databases beside it are not
 *   the extension's and are left out.
 *
 * Every child of the two settings directories is taken, not only the FluxIQ
 * extension's: a Lab browser loads no other extension (`--disable-extensions-except`),
 * and a component extension's storage holding a declared literal would be a
 * leak too. `chrome.storage.session` is held in memory and never reaches disk.
 * Not covered: the panel page's `localStorage` (the Simple conversation draft),
 * which Chromium keeps in `Default/Local Storage/leveldb` shared with every web
 * origin the run visited.
 *
 * A directory that does not exist contributes nothing, since a browser that
 * never wrote extension storage has none. Any other read error throws, and the
 * caller's attestation fails closed on it.
 */
export async function chromiumExtensionStorageDirs(profileDir: string): Promise<string[]> {
  const profile = path.resolve(profileDir, "Default");
  const children = async (directory: string): Promise<string[]> => {
    try { return (await readdir(directory)).sort().map(name => path.join(directory, name)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  };
  const indexedDb = await children(path.join(profile, "IndexedDB"));
  return [
    ...await children(path.join(profile, "Local Extension Settings")),
    ...await children(path.join(profile, "Sync Extension Settings")),
    ...indexedDb.filter(directory => path.basename(directory).startsWith("chrome-extension_")),
  ];
}
