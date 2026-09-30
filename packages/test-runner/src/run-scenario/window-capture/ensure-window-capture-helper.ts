import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { WINDOW_CAPTURE_SOURCE } from "./window-capture-source.js";

const execFileAsync = promisify(execFile);

export type WindowCaptureHelperOptions = { cacheDirectory?: string; windowsDirectory?: string };

/**
 * The compiled window-capture helper's path, compiling it on first use.
 *
 * The executable is cached outside the repository under a name carrying the
 * source's digest, so every run on a machine after the first starts it in
 * about 0.1 s, and an edit to the source compiles a new one rather than
 * running a stale one. Four live lanes may start at once, so each compiles to
 * a name of its own and renames into place; a lane that loses that race finds
 * the winner's executable and uses it.
 *
 * The compiler is the .NET Framework's `csc.exe`, present on every Windows 10
 * install. A machine without it rejects here, and the run falls back to a
 * Playwright capture of the tab in front.
 */
export async function ensureWindowCaptureHelper(options: WindowCaptureHelperOptions = {}): Promise<string> {
  const directory = options.cacheDirectory ?? path.join(os.tmpdir(), "fluxiq-window-capture");
  const digest = createHash("sha256").update(WINDOW_CAPTURE_SOURCE).digest("hex").slice(0, 16);
  const executable = path.join(directory, `window-capture-${digest}.exe`);
  if (await exists(executable)) return executable;
  const compiler = await findCompiler(options.windowsDirectory ?? process.env.WINDIR ?? "C:\\Windows");
  await mkdir(directory, { recursive: true });
  const unique = `${process.pid}-${randomBytes(4).toString("hex")}`;
  const source = path.join(directory, `window-capture-${digest}-${unique}.cs`);
  const staged = path.join(directory, `window-capture-${digest}-${unique}.exe`);
  try {
    await writeFile(source, WINDOW_CAPTURE_SOURCE, "utf8");
    await execFileAsync(compiler, ["-nologo", "-optimize+", "-target:exe", `-out:${staged}`, "-r:System.Drawing.dll", "-r:System.Management.dll", source], { windowsHide: true, timeout: 60_000 });
    try { await rename(staged, executable); }
    catch (error) {
      // Another lane renamed its build into place first, and Windows refuses to replace an executable that is running.
      if (!(await exists(executable))) throw error;
    }
    return executable;
  } finally {
    await rm(source, { force: true });
    await rm(staged, { force: true });
  }
}

async function findCompiler(windowsDirectory: string): Promise<string> {
  for (const framework of ["Framework64", "Framework"]) {
    const candidate = path.join(windowsDirectory, "Microsoft.NET", framework, "v4.0.30319", "csc.exe");
    if (await exists(candidate)) return candidate;
  }
  throw new Error(`No .NET Framework compiler was found under ${windowsDirectory}\\Microsoft.NET`);
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
