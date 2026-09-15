import { createHash } from "node:crypto";
import { readdir, readFile, readlink } from "node:fs/promises";
import path from "node:path";

/**
 * A SHA-256 over every entry below `root` in a fixed order: each directory's
 * entries sorted by name, each file's relative path, size and bytes, and each
 * symbolic link's target text. `include` sees every entry's name at every
 * depth and prunes a directory with everything below it, the same way the
 * staged workspace's copy filter does.
 */
export async function hashDirectoryContents(root: string, include: (name: string) => boolean = () => true): Promise<string> {
  const hash = createHash("sha256");
  const visit = async (relative: string): Promise<void> => {
    const entries = (await readdir(path.join(root, relative), { withFileTypes: true }))
      .filter(entry => include(entry.name))
      .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    const contents = await Promise.all(entries.map(entry => (entry.isFile() ? readFile(path.join(root, relative, entry.name)) : undefined)));
    for (const [index, entry] of entries.entries()) {
      const entryPath = relative ? `${relative}/${entry.name}` : entry.name;
      const content = contents[index];
      if (entry.isFile() && content) {
        hash.update(`file\0${entryPath}\0${content.length}\0`);
        hash.update(content);
      } else if (entry.isDirectory()) {
        hash.update(`directory\0${entryPath}\0`);
        await visit(entryPath);
      } else if (entry.isSymbolicLink()) {
        hash.update(`link\0${entryPath}\0${await readlink(path.join(root, entryPath))}\0`);
      } else {
        hash.update(`other\0${entryPath}\0`);
      }
    }
  };
  await visit("");
  return hash.digest("hex");
}
