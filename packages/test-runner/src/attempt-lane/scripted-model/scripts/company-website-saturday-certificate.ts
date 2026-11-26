import { scriptedTaskProcess } from "./processing-declarations.js";
// `company-website-saturday-certificate`: every free Saturday CP12 slot at Wrenfield across the three weeks the
// booking calendar shows, read one row per slot (date and time), with nothing booked or paid.
//
// The honest path, in the words the fixture's own recorded path uses (`qualification/saturday-certificate/workflow.ts`):
// clear what covers the page, open the booking, choose Wrenfield and Next, choose the CP12 service and Next, and read
// the calendar. A week is drawn as seven day columns of slot buttons, so the read names detection's `cells` handle
// (one row per slot, each with its day's heading), collects every slot with its heading and its disabled mark (the
// processing declaration keeps the free Saturday ones), and takes the date from the slot's `data-date` and the time from its words. The calendar's Later control
// moves a week on and the read is made again, each week's rows added to the result; the third week has no Later.
// The widget redraws whole on every press, so each week is detected again before it is read.
//
// Every handle, field key and mark id is read from the request's own evidence, never written here. Attempt 1
// explores and completes; attempts 2 to 4 run the saved Flow, so a decision reaching this script after the Flow's
// run is refused by name. The judge throws unless the result is exactly the oracle's two rows.
import type { ScriptedModelScript, ScriptedReply } from "../script.js";
import type { ScriptedModelRequest } from "../wire-request.js";
import { COMPANY_WEBSITE_COVERS } from "./company-website-apprentices.js";
import { currentPageOf, latestOf, pageLine, pressOf, toolCall } from "./evidence.js";
import { scriptedJudgement } from "./judgement.js";

const startAttempt: ScriptedReply = (request) => ({ do: "flow.createHere", with: { instruction: request.message }, process: scriptedTaskProcess("company-website-saturday-certificate") });

/** The weeks the calendar shows. */
const WEEKS = 3;

type Field = { key: string; sample?: string; label?: string };
type Mark = { id: string; label?: string; kind?: string };
type Cells = { handle?: string; fields?: readonly Field[]; fieldMarks?: readonly Mark[] };

/** The calls this decision's evidence says were made, by call id. */
const callsMade = (request: ScriptedModelRequest): ReadonlySet<string> => new Set((request.payload ? JSON.stringify(request.payload).match(/"callId":"[^"]+"/gu) ?? [] : []).map((text) => text.slice(10, -1)));

/** The columns of the cells, from what the detection says they hold: the slot's own date and words, its day's heading, and its disabled mark. */
function cellColumns(cells: Cells): { date: string; time: string; heading: string; disabled: string } {
  const fields = cells.fields ?? [];
  const describe = fields.map((field) => `${field.key}=${field.label ?? ""}:${field.sample ?? ""}`).join("; ");
  const keyOf = (holds: (field: Field) => boolean, what: string): string => {
    const found = fields.find(holds);
    if (!found) throw new Error(`The cells' fields hold no ${what}: ${describe}`);
    return found.key;
  };
  const date = keyOf((field) => /^\d{4}-\d\d-\d\d$/u.test(field.sample ?? ""), "slot date");
  const mark = (cells.fieldMarks ?? []).find((candidate) => /disabled/iu.test(`${candidate.kind ?? ""} ${candidate.label ?? ""}`));
  if (!mark) throw new Error(`The cells carry no disabled mark: ${JSON.stringify(cells.fieldMarks ?? [])}`);
  return {
    date,
    time: keyOf((field) => /^\d\d:\d\d$/u.test(field.sample ?? "") && field.key !== date, "slot time"),
    heading: keyOf((field) => /heading/iu.test(field.label ?? ""), "group heading"),
    disabled: mark.id,
  };
}

/** The read of the calendar's week on show: the free Saturday slots, one row each, added to the result. */
function readWeek(request: ScriptedModelRequest, week: number): Record<string, unknown> {
  const structure = latestOf(request, "web.detect_repeating_structure");
  const cells = structure?.value.cells as Cells | undefined;
  if (!cells || typeof cells.handle !== "string") throw new Error(`The detection offers no cells to read the slots by: ${JSON.stringify(structure?.value ?? null).slice(0, 400)}`);
  const columns = cellColumns(cells);
  return toolCall(`Read the free Saturday slots of week ${week}.`, `read-week-${week}`, "core.run_node", {
    node: "web.output.dom-extract_list",
    parameters: {
      extractList: {
        handle: cells.handle,
        // Every slot is collected with its day's heading and its disabled mark; the processing declaration keeps the free Saturday ones.
        fields: { date: columns.date, time: columns.time, "group heading": columns.heading, disabled: columns.disabled },
        minItems: 0,
      },
      recordOutput: {
        datasetId: "saturday-slots",
        schema: { schemaVersion: "0.1", fields: ["date", "time"].map((id) => ({ id, label: id, valueType: "string" })) },
        writeMode: "append",
      },
    },
    consequences: [],
  }, true);
}

/** A slot of the calendar on show, by the words a person sees: a time of day on a button. */
const SLOT = /^t\d+ button "\d\d:\d\d"/u;

/** Detect the week on show (the widget redrew), then read it. */
function weekStep(request: ScriptedModelRequest, page: string, made: ReadonlySet<string>, week: number): Record<string, unknown> {
  if (!made.has(`detect-week-${week}`)) {
    const slot = pageLine(page, SLOT);
    if (!slot) throw new Error(`The calendar shows no slot to detect the week's cells from (week ${week})`);
    return toolCall(`See the shape of week ${week}'s slots.`, `detect-week-${week}`, "web.detect_repeating_structure", { target: slot.handle });
  }
  if (latestOf(request, "web.detect_repeating_structure")?.callId !== `detect-week-${week}`) throw new Error(`The newest detection is not week ${week}'s`);
  return readWeek(request, week);
}

const decide: ScriptedReply = (request) => {
  const note = latestOf(request, "core.attempt_note")?.value.flowRun as { stoppedAt?: number; happened?: string } | undefined;
  if (note) throw new Error(`The saved Flow's run did not end the attempt, stopped at step ${note.stoppedAt ?? "none"}: ${note.happened ?? "no reason given"}`);
  const page = currentPageOf(request);
  const made = callsMade(request);
  if (made.has(`read-week-${WEEKS}`)) return { kind: "evidence_tool_decision", summary: "All three weeks are read.", decision: { kind: "complete", result: { summary: "Listed every free Saturday CP12 slot at Wrenfield across the three weeks, with nothing booked." } } };
  for (const cover of COMPANY_WEBSITE_COVERS) {
    if (!made.has(cover.callId) && pageLine(page, cover.words)) return pressOf(request, cover.summary, cover.callId, cover.words);
  }
  if (!made.has("open-booking")) return pressOf(request, "Open the booking.", "open-booking", /link "Book a service"/u);
  if (!made.has("choose-branch")) return pressOf(request, "Choose the Wrenfield branch.", "choose-branch", /^t\d+ (?!link )[^"]*"Wrenfield\b/u);
  if (!made.has("branch-next")) return pressOf(request, "Go on to the service.", "branch-next", /button "Next"/u);
  if (!made.has("choose-service")) return pressOf(request, "Choose the landlord certificate (CP12).", "choose-service", /"Landlord certificate \(CP12\)/u);
  if (!made.has("service-next")) return pressOf(request, "Go on to the date and time.", "service-next", /button "Next"/u);
  // Weeks in turn: read the one on show, then press Later to the next.
  for (let week = 1; week <= WEEKS; week += 1) {
    if (made.has(`read-week-${week}`)) continue;
    if (week > 1 && !made.has(`later-${week - 1}`)) return pressOf(request, `Move to week ${week} with Later.`, `later-${week - 1}`, /"Later/u);
    return weekStep(request, page, made, week);
  }
  throw new Error("Every week is read but the decision did not complete");
};

/** The oracle's rows: every free Saturday CP12 slot, earliest first. */
const EXPECTED_SLOTS: readonly string[] = ["2026-10-03 11:30", "2026-10-17 09:00"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The slots the result holds, as `date time`, from the record sets Core put in the summary, and how many rows those sets say they hold. */
export function resultSlots(request: ScriptedModelRequest): { slots: string[]; held: number } {
  const context = request.payload?.context;
  const summary = isRecord(context) && isRecord(context.resultSummary) ? context.resultSummary : undefined;
  const sets = summary && Array.isArray(summary.recordSets) ? summary.recordSets.filter(isRecord) : [];
  const held = sets.reduce((sum, set) => sum + (typeof set.recordCount === "number" ? set.recordCount : 0), 0);
  const slots = sets.flatMap((set) => (Array.isArray(set.sampleRows) ? set.sampleRows.filter(isRecord) : []).map((row) => `${String(row.date ?? "")} ${String(row.time ?? "")}`.trim()));
  return { slots, held };
}

/** The judge: yes only to exactly the oracle's two rows, so a Flow that lost a week or its conditions fails loudly. */
const exactlyTheOracleRows: ScriptedReply = (request) => {
  const { slots, held } = resultSlots(request);
  if (held !== EXPECTED_SLOTS.length || slots.join("|") !== EXPECTED_SLOTS.join("|")) {
    throw new Error(`The result is not the two free Saturday slots: ${held} rows held, rows read: ${slots.join("; ") || "none"}; expected ${EXPECTED_SLOTS.join("; ")}`);
  }
  return scriptedJudgement(request, { answersRequest: "yes", summary: "The rows are the free Saturday CP12 slots at Wrenfield across the three weeks." });
};

/** Attempts in the Lab's default series (`lab attempt --attempts 4`): one exploring attempt and three of the saved Flow. */
const SERIES_ATTEMPTS = 4;
/** Enough decisions for one exploring attempt, few enough that a loop fails it. */
const MOST_DECISIONS = 60;

/** The script for the task; it has one form. */
export function companyWebsiteSaturdayCertificateScript(form: string = "plain"): ScriptedModelScript {
  if (form !== "plain") throw new Error(`This script has no form "${form}". It has plain.`);
  return Object.freeze({
    taskId: "company-website-saturday-certificate",
    replies: {
      panel_command: Array.from({ length: SERIES_ATTEMPTS }, () => startAttempt),
      evidence_tool_decision: Array.from({ length: MOST_DECISIONS }, () => decide),
      loop_verification: Array.from({ length: SERIES_ATTEMPTS * 2 }, () => exactlyTheOracleRows),
    },
  });
}
