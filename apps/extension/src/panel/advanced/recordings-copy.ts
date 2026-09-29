// The Recordings tab's words (UI audit, section 4, "What moves to Advanced"):
// where the list came from, and one row per recording. The row never falls back
// to the raw recording id, and a missing step count is left out rather than
// shown as "events unknown".

import type { CoreRecordingSummary } from "../../shared/protocol";

/** One recording row: its title, its status in words, and "n steps · date" when either is known. */
export type RecordingRowCopy = { readonly title: string; readonly pill: string; readonly line?: string };

const PILLS: Readonly<Record<string, string>> = { saved: "Saved", recording: "Recording" };

/** The row for `summary`; `formatDate` renders the recording's date. */
export function recordingRowCopy(summary: CoreRecordingSummary, formatDate: (at: number) => string = defaultDate): RecordingRowCopy {
  const title = summary.title?.trim() || "Untitled recording";
  const parts: string[] = [];
  if (typeof summary.eventCount === "number") parts.push(summary.eventCount === 1 ? "1 step" : `${summary.eventCount} steps`);
  const at = summary.endedAt ?? summary.updatedAt ?? summary.startedAt;
  if (typeof at === "number") parts.push(formatDate(at));
  const line = parts.length === 0 ? undefined : parts.join(" · ");
  return line === undefined ? { title, pill: pillWords(summary.status) } : { title, pill: pillWords(summary.status), line };
}

/** "From 127.0.0.1:3000" for the address the list was read from, or undefined when it has no host. */
export function recordingsSourceLine(sourceUrl: string | undefined): string | undefined {
  if (!sourceUrl) return undefined;
  let host: string;
  try {
    host = new URL(sourceUrl).host;
  } catch (error) {
    // `new URL` throws TypeError for text that is not a URL, which names no host.
    if (error instanceof TypeError) return undefined;
    throw error;
  }
  return host === "" ? undefined : `From ${host}`;
}

function pillWords(status: string | undefined): string {
  const raw = status?.trim().toLowerCase() ?? "";
  if (raw === "") return "Saved";
  const known = PILLS[raw];
  if (known !== undefined) return known;
  const words = raw.replace(/[_-]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function defaultDate(at: number): string {
  return new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
