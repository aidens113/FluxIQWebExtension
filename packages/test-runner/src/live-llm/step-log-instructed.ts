// What the creation build read the person's instructions to ask for, from the
// run's own step log.
//
// Core publishes a build's instructed consequences only on its proposal
// (`metadata.bootstrap`), so a build that ended without one -- refused, or
// stopped at its spending limit -- reported `instructedConsequences: null`
// while its step log held the reading (`run-murzln6g-11debe1d`, `S/0015`).
// The reading is a model step of the creation build in phase `read`, whose
// `decision.json` holds Core's parsed answer: a `complete` decision whose
// result lists each consequence with the person's words it quoted. Only those
// two strings are read, and only from that step; no request, other answer or
// page content.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type LiveLlmStepLogInstructed = ReadonlyArray<Readonly<{ consequence: string; quote: string }>>;

const STEP_FOLDER = /^\d{4,}-/u;
/** A consequence class as Core names one (`modify_existing`, `create_new`, ...): kept as written, never interpreted. */
const CONSEQUENCE = /^[a-z][a-z0-9_]{0,63}$/u;

/**
 * The instructed consequences of the creation build's last complete reading
 * of its instructions, or `null` when the log holds none: no log, no reading
 * step, or one whose answer was not a reading Core could use. A step folder
 * without its `meta.json` is still being written and is skipped, as Core
 * treats it. An empty list is a reading that found no lasting consequence.
 */
export async function readLiveLlmStepLogInstructed(stepsDirectory: string): Promise<LiveLlmStepLogInstructed | null> {
  let names: string[];
  try {
    names = (await readdir(stepsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory() && STEP_FOLDER.test(entry.name)).map((entry) => entry.name).sort();
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
  let found: LiveLlmStepLogInstructed | null = null;
  for (const name of names) {
    const meta = await readJson(path.join(stepsDirectory, name, "meta.json"));
    if (!meta || meta.part !== "creation" || meta.phase !== "read" || typeof meta.provider !== "string") continue;
    const reading = instructedOf(await readJson(path.join(stepsDirectory, name, "decision.json")));
    if (reading) found = reading;
  }
  return found;
}

/** The `instructed` list of a decision file's `complete` decision, each entry held to its shape; `null` for any other answer. */
function instructedOf(file: Record<string, unknown> | null): LiveLlmStepLogInstructed | null {
  const decision = recordOf(recordOf(file?.response)?.decision);
  if (decision?.kind !== "complete") return null;
  const instructed = recordOf(decision.result)?.instructed;
  if (!Array.isArray(instructed)) return null;
  const entries = instructed.flatMap((entry) => {
    const item = recordOf(entry);
    return item && typeof item.consequence === "string" && CONSEQUENCE.test(item.consequence) && typeof item.quote === "string" && item.quote.length > 0
      ? [Object.freeze({ consequence: item.consequence, quote: item.quote })]
      : [];
  });
  return entries.length === instructed.length ? Object.freeze(entries) : null;
}

async function readJson(file: string): Promise<Record<string, unknown> | null> {
  try {
    return recordOf(JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    if (isMissingFile(error) || error instanceof SyntaxError) return null;
    throw error;
  }
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}
