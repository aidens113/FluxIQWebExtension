// A fresh copy of a copied workspace's `.fluxiq` store for one offline trial,
// so no two runs read what another wrote: the trial's host applies Core's
// migrations and writes the trial's session, rows and trace into its copy.
//
// The copy goes to `<work>/fluxiq-root/.fluxiq`, beside nothing else: the
// workspace's identity, sessions and browser profile live outside `.fluxiq`
// and are never copied, and `.fluxiq/security` (sign-in attempt counters) is
// left out. `<work>` must lie under a `test-runs` directory, which the
// repository ignores, and must not exist yet. Nothing is read from the files.

import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const LEFT_OUT = new Set(["security"]);

export type FreshStoreCopy = Readonly<{
  /** The workspace root a host is opened on. */
  rootDir: string;
  /** Its `.fluxiq` store. */
  fluxiqDir: string;
}>;

export function freshStoreCopyRefusal(work: string): string | null {
  if (!path.resolve(work).split(path.sep).includes("test-runs")) return "--work holds a copy of the workspace store, which holds page content: put it under a test-runs directory";
  return null;
}

export async function freshStoreCopy(input: { sourceFluxiqDir: string; work: string }): Promise<FreshStoreCopy> {
  const refusal = freshStoreCopyRefusal(input.work);
  if (refusal !== null) throw new Error(refusal);
  if (await exists(input.work)) throw new Error(`${input.work} exists already: each offline trial runs on a copy of its own`);
  const source = path.resolve(input.sourceFluxiqDir);
  const rootDir = path.join(path.resolve(input.work), "fluxiq-root");
  const fluxiqDir = path.join(rootDir, ".fluxiq");
  await mkdir(rootDir, { recursive: true });
  await cp(source, fluxiqDir, {
    recursive: true,
    errorOnExist: true,
    filter: (from) => !LEFT_OUT.has(path.relative(source, from).split(path.sep)[0] ?? ""),
  });
  return Object.freeze({ rootDir, fluxiqDir });
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
