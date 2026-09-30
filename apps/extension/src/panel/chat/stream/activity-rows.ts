// The relay's activity events as the steps a person reads. No DOM.
//
// Rows. Only an event with a `detail` can be a row, and only when it is a
// step a person would recognise (`isInternalStep` drops Core's bookkeeping).
// Events of one unit of work that describe the same thing -- the same
// `activityId`, `detail.kind` and `ref` (or title, when there is no ref) -- are
// one row while it is open: a tool that `started` and then `succeeded` is one
// row that now says succeeded, where it first appeared. A decision
// (`thought`) and a step (`step`: "Build started", a run's "step 3") are
// never reopened: Core says when one starts and not when it ends, so each is
// its own row, done once anything after it in the same unit of work happened.
// Only the newest can still be under way.
// Every row's words come from `stepWords`, never from a raw id.
//
// Completeness. The relay keeps only its last `ACTIVITY_RECENT_LIMIT` events
// and forgets everything when its worker restarts, and the chat keeps at most
// `limit` rows, so a long build's first steps are gone. A unit of work is
// `partial` when its opening may be missing: rows of it were cut by `limit`,
// or the relay's window is full and its oldest event belongs to it, or its
// first step is a run step after the first -- unless its opening row itself
// (a build's "Build started", a run's step 1) is still here. A partial unit's
// step count would be a wrong number, so the summary leaves it out.

import { ACTIVITY_RECENT_LIMIT, type ClientGatewayActivity, type ExtensionActivityState } from "../../../shared/activity/index";
import { isInternalStep } from "./step-filter";
import { stepWords } from "./step-words";

type ActivityDetail = NonNullable<ClientGatewayActivity["detail"]>;

/** One activity row: one line of a fold's list. */
export type ActivityRow = {
  /** Stable for the row's life, so a re-render keeps it open. */
  key: string;
  /** The unit of work it belongs to (`ClientGatewayActivity.activityId`). */
  activityId: string;
  kind: ActivityDetail["kind"];
  /** In words, never a tool or node id. */
  title: string;
  /** Core's sentence under the title, in words; undefined when there is none. */
  text: string | undefined;
  status: ActivityDetail["status"];
  phase: ClientGatewayActivity["phase"];
  /** The row's first event's time, in ms. */
  at: number;
  /** The row's last event's time, in ms. */
  endAt: number;
  /** The last event folded into it. */
  sequence: number;
  /** True for the row that opens its unit of work: a build's start, a run's first step. */
  opens: boolean;
  /** False for a marker that is not itself a step ("Started building", "Run finished"). */
  counted: boolean;
};

/** The rows, and the units of work whose opening may be missing. */
export type ActivityRows = { rows: ActivityRow[]; partial: ReadonlySet<string> };

type Draft = {
  key: string;
  event: ClientGatewayActivity;
  detail: ActivityDetail;
  status: ActivityDetail["status"];
  text: string | undefined;
  at: number;
  endAt: number;
};

/** The rows for the relay's `recent` events, at most `limit` of them (the newest). */
export function activityRows(recent: ExtensionActivityState["recent"], limit: number): ActivityRows {
  const ordered = [...recent].sort((a, b) => a.sequence - b.sequence);
  const drafts: Draft[] = [];
  const open = new Map<string, number>();
  // The row of each unit of work that Core started without saying it ended.
  const unended = new Map<string, number>();
  let lastAt = Number.NEGATIVE_INFINITY;
  for (const event of ordered) {
    const parsed = Date.parse(event.at);
    const at = Number.isFinite(parsed) ? parsed : lastAt;
    lastAt = at;
    // Anything after a decision or a step means it is over.
    const over = unended.get(event.activityId);
    if (over !== undefined) {
      const draft = drafts[over]!;
      draft.status = "succeeded";
      draft.endAt = Math.max(draft.endAt, at);
      unended.delete(event.activityId);
    }
    const detail = event.detail;
    if (detail === undefined || isInternalStep(detail)) continue;
    const identity = `${event.activityId}|${detail.kind}|${detail.ref ?? detail.title}`;
    const unending = detail.kind === "thought" || detail.kind === "step";
    const index = unending ? undefined : open.get(identity);
    const text = detail.text?.trim() || undefined;
    if (index !== undefined) {
      const draft = drafts[index]!;
      drafts[index] = { ...draft, event, detail, status: detail.status, text: text ?? draft.text, endAt: Math.max(draft.at, at) };
    } else {
      drafts.push({ key: `activity:${event.activityId}#${event.sequence}`, event, detail, status: detail.status, text, at, endAt: at });
    }
    const placed = index ?? drafts.length - 1;
    if (unending) {
      if (detail.status === "started") unended.set(event.activityId, placed);
    } else if (detail.status === "started") open.set(identity, placed);
    else open.delete(identity);
  }

  const kept = limit > 0 ? drafts.slice(-limit) : [];
  const rows = kept.map(rowOf);
  return { rows, partial: partialUnits(ordered, drafts.slice(0, drafts.length - kept.length), rows) };
}

function rowOf(draft: Draft): ActivityRow {
  const { event, detail, status } = draft;
  const current: ActivityDetail = {
    kind: detail.kind,
    title: detail.title,
    ...(status === undefined ? {} : { status }),
    ...(draft.text === undefined ? {} : { text: draft.text }),
    ...(detail.ref === undefined ? {} : { ref: detail.ref })
  };
  const words = stepWords(current, event.step);
  return {
    key: draft.key,
    activityId: event.activityId,
    kind: detail.kind,
    title: words.title,
    text: words.text,
    status,
    phase: event.phase,
    at: draft.at,
    endAt: draft.endAt,
    sequence: event.sequence,
    opens: opensUnit(draft),
    counted: detail.kind !== "step" || event.step !== undefined
  };
}

function opensUnit(draft: Draft): boolean {
  if (draft.event.step !== undefined) return draft.event.step.index === 1;
  return draft.event.subject.kind === "build" && draft.detail.kind === "step" && draft.event.phase === "building";
}

function partialUnits(ordered: readonly ClientGatewayActivity[], cut: readonly Draft[], rows: readonly ActivityRow[]): Set<string> {
  const suspect = new Set(cut.map((draft) => draft.event.activityId));
  const oldest = ordered[0];
  if (oldest !== undefined && ordered.length >= ACTIVITY_RECENT_LIMIT) suspect.add(oldest.activityId);
  const first = new Map<string, ClientGatewayActivity>();
  for (const event of ordered) if (event.detail?.kind === "step" && event.step !== undefined && !first.has(event.activityId)) first.set(event.activityId, event);
  for (const [activityId, event] of first) if ((event.step?.index ?? 1) > 1) suspect.add(activityId);
  const opened = new Set(rows.filter((row) => row.opens).map((row) => row.activityId));
  return new Set([...suspect].filter((activityId) => !opened.has(activityId)));
}
