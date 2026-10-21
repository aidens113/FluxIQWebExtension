// The extension's production content code, as the snapshot page runs it
// outside the e2e harness (the offline-trial experiment's tier 2, P5): the
// content script and page-world bundles the extension's own build wrote under
// `apps/extension/dist/<target>/` (`apps/extension/scripts/build-extension.mjs`,
// entries `content/index.js` and `page-world/index.js`), and the domain's
// `executeActionMessage`, the builder the background sends a tab its action
// with. Nothing is rebuilt here: a missing bundle, or one older than any file
// under the extension's `src/`, is refused with the command that makes it, so
// an offline read never runs content code the source has moved past.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { executeActionMessage } from "@fluxiq-web-extension/domain/node";
import type { SnapshotContentCode } from "./page-options.js";

const BUILD_COMMAND = "pnpm --filter @fluxiq-web-extension/extension build";
const BUNDLES = { contentScript: path.join("content", "index.js"), pageWorldScript: path.join("page-world", "index.js") } as const;

export async function loadExtensionContentCode(input: {
  /** The extension package's directory (`apps/extension`). */
  extensionDir: string;
  /** The build target whose bundles are read; `chrome`, the production Chromium build, by default. */
  target?: string | undefined;
}): Promise<SnapshotContentCode> {
  const targetDir = path.join(input.extensionDir, "dist", input.target ?? "chrome");
  const built = new Map<keyof typeof BUNDLES, { file: string; mtimeMs: number }>();
  for (const [name, relative] of Object.entries(BUNDLES) as [keyof typeof BUNDLES, string][]) {
    const file = path.join(targetDir, relative);
    const found = await stat(file).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (found === undefined) throw new Error(`The extension's built ${relative.replaceAll("\\", "/")} is missing under ${targetDir}; build it with \`${BUILD_COMMAND}\``);
    built.set(name, { file, mtimeMs: found.mtimeMs });
  }
  const oldest = Math.min(...[...built.values()].map((bundle) => bundle.mtimeMs));
  const newer = await newestSourceAfter(path.join(input.extensionDir, "src"), oldest);
  if (newer !== undefined) {
    throw new Error(`The extension's bundles under ${targetDir} are older than ${path.relative(input.extensionDir, newer).replaceAll("\\", "/")}; rebuild them with \`${BUILD_COMMAND}\``);
  }
  return Object.freeze({
    contentScript: await readFile(built.get("contentScript")!.file, "utf8"),
    pageWorldScript: await readFile(built.get("pageWorldScript")!.file, "utf8"),
    actionMessage: executeActionMessage,
  });
}

/** The newest file under `dir` modified after `after`, or `undefined` when none was. */
async function newestSourceAfter(dir: string, after: number): Promise<string | undefined> {
  let newest: { file: string; mtimeMs: number } | undefined;
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    const { mtimeMs } = await stat(file);
    if (mtimeMs > after && (newest === undefined || mtimeMs > newest.mtimeMs)) newest = { file, mtimeMs };
  }
  return newest?.file;
}
