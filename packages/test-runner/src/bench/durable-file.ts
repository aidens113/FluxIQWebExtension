import { link, mkdir, open, rename, rm, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const TEMPORARY_ATTEMPTS = 8;
const WINDOWS_RENAME_DELAYS_MS = [10, 20, 40, 80] as const;
const WINDOWS_SHARING_ERRORS = new Set(["EACCES", "EBUSY", "EPERM"]);
const UNSUPPORTED_DIRECTORY_SYNC_ERRORS = new Set(["EACCES", "EBADF", "EISDIR", "EINVAL", "ENOTSUP", "EPERM"]);
const writesByTarget = new Map<string, Promise<void>>();

export type DurableFileStage =
  | "temporary-created"
  | "content-written"
  | "file-synced"
  | "file-closed"
  | "target-published"
  | "before-directory-sync"
  | "directory-synced";

export type DurableFileHandle = Pick<FileHandle, "close" | "sync" | "writeFile">;

/** Injectable filesystem boundary used only by focused fault tests. */
export type DurableFileSystem = {
  mkdir(directory: string, options: { recursive: true }): Promise<string | undefined | void>;
  open(file: string, flags: string, mode?: number): Promise<DurableFileHandle>;
  rename(source: string, target: string): Promise<void>;
  link(source: string, target: string): Promise<void>;
  remove(file: string, options: { force: true }): Promise<void>;
};

export type DurableFileOptions = {
  fileSystem?: DurableFileSystem;
  platform?: NodeJS.Platform;
  randomSuffix?: () => string;
  sleep?: (milliseconds: number) => Promise<void>;
  checkpoint?: (stage: DurableFileStage, paths: { target: string; temporary: string }) => void | Promise<void>;
};

const defaultFileSystem: DurableFileSystem = {
  mkdir: (directory, options) => mkdir(directory, options),
  open: (file, flags, mode) => open(file, flags, mode),
  rename,
  link,
  remove: (file, options) => rm(file, options),
};

/** Atomically replaces `target` with complete, file-synced UTF-8 content. */
export function writeDurableText(target: string, contents: string, options: DurableFileOptions = {}): Promise<void> {
  return serializeTarget(target, () => publish(target, contents, "replace", options));
}

/** Atomically replaces `target` with pretty-printed, newline-terminated JSON. */
export function writeDurableJson(target: string, value: unknown, options: DurableFileOptions = {}): Promise<void> {
  return writeDurableText(target, `${JSON.stringify(value, null, 2)}\n`, options);
}

/** Publishes complete, file-synced UTF-8 content only when `target` is absent. */
export function createDurableText(target: string, contents: string, options: DurableFileOptions = {}): Promise<void> {
  return serializeTarget(target, () => publish(target, contents, "create", options));
}

/** Publishes complete JSON only when `target` is absent; duplicates fail with `EEXIST`. */
export function createDurableJson(target: string, value: unknown, options: DurableFileOptions = {}): Promise<void> {
  return createDurableText(target, `${JSON.stringify(value, null, 2)}\n`, options);
}

async function serializeTarget(target: string, operation: () => Promise<void>): Promise<void> {
  const key = path.resolve(target);
  const previous = writesByTarget.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  writesByTarget.set(key, current);
  try {
    await current;
  } finally {
    if (writesByTarget.get(key) === current) writesByTarget.delete(key);
  }
}

async function publish(target: string, contents: string, mode: "create" | "replace", options: DurableFileOptions): Promise<void> {
  const fileSystem = options.fileSystem ?? defaultFileSystem;
  const absoluteTarget = path.resolve(target);
  const parent = path.dirname(absoluteTarget);
  await fileSystem.mkdir(parent, { recursive: true });

  const { handle, temporary } = await createTemporary(absoluteTarget, fileSystem, options.randomSuffix);
  let openHandle: DurableFileHandle | undefined = handle;
  let published = false;
  const checkpoint = async (stage: DurableFileStage): Promise<void> => options.checkpoint?.(stage, { target: absoluteTarget, temporary });

  try {
    await checkpoint("temporary-created");
    await handle.writeFile(contents, "utf8");
    await checkpoint("content-written");
    await handle.sync();
    await checkpoint("file-synced");
    await handle.close();
    openHandle = undefined;
    await checkpoint("file-closed");

    if (mode === "create") await fileSystem.link(temporary, absoluteTarget);
    else await renameWithSharingRetries(temporary, absoluteTarget, fileSystem, options);
    published = true;
    await checkpoint("target-published");

    if (mode === "create") await removeOwnedTemporary(fileSystem, temporary);
    await checkpoint("before-directory-sync");
    await syncParentDirectory(parent, fileSystem, options.platform ?? process.platform);
    await checkpoint("directory-synced");
  } finally {
    if (openHandle) await openHandle.close().catch(() => undefined);
    if (!published || mode === "create") await removeOwnedTemporary(fileSystem, temporary);
  }
}

async function createTemporary(target: string, fileSystem: DurableFileSystem, randomSuffix = defaultRandomSuffix): Promise<{ handle: DurableFileHandle; temporary: string }> {
  const parent = path.dirname(target);
  const basename = path.basename(target);
  for (let attempt = 0; attempt < TEMPORARY_ATTEMPTS; attempt += 1) {
    const temporary = path.join(parent, `.${basename}.${process.pid}.${randomSuffix()}.tmp`);
    try {
      return { handle: await fileSystem.open(temporary, "wx", 0o600), temporary };
    } catch (error) {
      if (errorCode(error) !== "EEXIST" || attempt === TEMPORARY_ATTEMPTS - 1) throw error;
    }
  }
  throw new Error("Unreachable temporary-file allocation state");
}

async function renameWithSharingRetries(source: string, target: string, fileSystem: DurableFileSystem, options: DurableFileOptions): Promise<void> {
  const platform = options.platform ?? process.platform;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fileSystem.rename(source, target);
      return;
    } catch (error) {
      if (platform !== "win32" || !WINDOWS_SHARING_ERRORS.has(errorCode(error) ?? "") || attempt >= WINDOWS_RENAME_DELAYS_MS.length) throw error;
      await sleep(WINDOWS_RENAME_DELAYS_MS[attempt]!);
    }
  }
}

async function syncParentDirectory(parent: string, fileSystem: DurableFileSystem, platform: NodeJS.Platform): Promise<void> {
  if (platform === "win32") return;
  let handle: DurableFileHandle | undefined;
  try {
    handle = await fileSystem.open(parent, "r");
    await handle.sync();
  } catch (error) {
    if (!UNSUPPORTED_DIRECTORY_SYNC_ERRORS.has(errorCode(error) ?? "")) throw error;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function removeOwnedTemporary(fileSystem: DurableFileSystem, temporary: string): Promise<void> {
  await fileSystem.remove(temporary, { force: true }).catch(() => undefined);
}

function defaultRandomSuffix(): string {
  return randomBytes(8).toString("hex");
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;
}
