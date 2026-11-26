import assert from "node:assert/strict";
import test from "node:test";
import { scriptedModelScriptFor, scriptedTaskProcess, type ScriptedModelRequest } from "../../index.js";

const TASK = "company-website-saturday-certificate";

type Entry = Record<string, unknown>;
const made = (callId: string, toolId = "core.run_node"): Entry => ({ callId, toolId, value: { ok: true } });

function request(page: string, extra: readonly Entry[] = []): ScriptedModelRequest {
  const evidence = [...extra, { callId: "core.current_view", toolId: "core.current_view", value: { groups: [{ group: "top", callId: "x", value: { page } }] } }];
  return { kind: "evidence_tool_decision", ordinal: 1, model: "m", jsonText: true, message: "", payload: { taskKind: "evidence_tool_decision", context: { evidenceLoop: { evidence } } } };
}

type Decided = { decision: { kind: string; callId?: string; toolId?: string; add?: boolean; input?: { node?: string; target?: string; parameters?: Record<string, any> } } };
const script = scriptedModelScriptFor(TASK);
const decide = (page: string, extra: readonly Entry[] = []) => (script.replies.evidence_tool_decision![0]!(request(page, extra)) as Decided).decision;

const BOOKING = ['URL ~/book', 't11 link "Book a service" ~/book', 't20 clickable "Wrenfield 4 Mill Lane"', 't30 button "Next"', 't40 clickable "Landlord certificate (CP12) · £75.00"'].join("\n");
const CALENDAR = ['URL ~/book', 't290 clickable "Later ›"', 't295 button "09:00" disabled', 't296 button "11:30"', 't300 button "Next"'].join("\n");
const STEPS_BEFORE_CALENDAR = ["open-booking", "choose-branch", "branch-next", "choose-service", "service-next"].map((id) => made(id));

const CELLS = {
  handle: "extraction.9",
  itemCount: 21,
  fields: [{ key: "div_head", label: "group heading", sample: "Sat 03/10" }, { key: "data_date", label: "data-date", sample: "2026-10-03" }, { key: "item", label: "item", sample: "11:30" }],
  fieldMarks: [{ id: "item_disabled", label: "item (disabled)", kind: "disabled" }],
};
const detected = (week: number, cells: unknown = CELLS): Entry => ({ callId: `detect-week-${week}`, toolId: "web.detect_repeating_structure", value: { extraction: "extraction.1", cells } });

test("it opens the booking and walks the wizard, each press read from the page as it stands", () => {
  assert.equal(decide('URL ~/\nt11 link "Book a service" ~/book').input?.parameters?.target.handle, "t11");
  assert.equal(decide('URL ~/\nt77 link "Book a service" ~/book').input?.parameters?.target.handle, "t77");
  assert.equal(decide(BOOKING, [made("open-booking")]).input?.parameters?.target.handle, "t20");
  assert.equal(decide(BOOKING, [made("open-booking"), made("choose-branch")]).input?.parameters?.target.handle, "t30");
  assert.equal(decide(BOOKING, [made("open-booking"), made("choose-branch"), made("branch-next")]).input?.parameters?.target.handle, "t40");
  assert.equal(decide(CALENDAR, STEPS_BEFORE_CALENDAR.slice(0, 4)).input?.parameters?.target.handle, "t300");
});

test("it detects the week on show from a slot, and reads the cells with the Saturday and not-disabled conditions, adding to the result", () => {
  const detect = decide(CALENDAR, STEPS_BEFORE_CALENDAR);
  assert.equal(detect.toolId, "web.detect_repeating_structure");
  assert.equal((detect.input as { target?: string }).target, "t295");
  const read = decide(CALENDAR, [...STEPS_BEFORE_CALENDAR, detected(1)]);
  assert.equal(read.callId, "read-week-1");
  assert.equal(read.add, true);
  const list = read.input?.parameters?.extractList;
  assert.equal(list.handle, "extraction.9");
  assert.deepEqual(list.fields, { date: "data_date", time: "item", group_heading: "div_head", disabled: "item_disabled" });
  assert.equal(list.where, undefined, "every slot is collected; the processing declaration filters");
  assert.equal(read.input?.parameters?.recordOutput.writeMode, "append");
});

test("the handle and keys are the evidence's own", () => {
  const other = { ...CELLS, handle: "extraction.31", fields: [{ key: "k_head", label: "group heading", sample: "Sat 10/10" }, { key: "k_date", label: "data-date", sample: "2026-10-10" }, { key: "k_time", label: "item", sample: "09:00" }], fieldMarks: [{ id: "k_off", label: "item (disabled)", kind: "disabled" }] };
  const list = decide(CALENDAR, [...STEPS_BEFORE_CALENDAR, detected(1, other)]).input?.parameters?.extractList;
  assert.equal(list.handle, "extraction.31");
  assert.deepEqual(list.fields, { date: "k_date", time: "k_time", group_heading: "k_head", disabled: "k_off" });
});

test("a detection with no cells, or no disabled mark, fails loudly", () => {
  assert.throws(() => decide(CALENDAR, [...STEPS_BEFORE_CALENDAR, detected(1, null)]), /offers no cells/u);
  assert.throws(() => decide(CALENDAR, [...STEPS_BEFORE_CALENDAR, detected(1, { ...CELLS, fieldMarks: [] })]), /no disabled mark/u);
});

test("each week is read, then Later is pressed, the next week detected and read; the third week completes", () => {
  const week1 = [...STEPS_BEFORE_CALENDAR, detected(1), made("read-week-1")];
  const later = decide(CALENDAR, week1);
  assert.equal(later.callId, "later-1");
  assert.equal(later.input?.parameters?.target.handle, "t290");
  assert.equal(decide(CALENDAR, [...week1, made("later-1")]).toolId, "web.detect_repeating_structure");
  const week2 = [...week1, made("later-1"), detected(2), made("read-week-2")];
  assert.equal(decide(CALENDAR, [...week1, made("later-1"), detected(2)]).callId, "read-week-2");
  assert.equal(decide(CALENDAR, week2).callId, "later-2");
  assert.equal(decide(CALENDAR, [...week2, made("later-2"), detected(3)]).callId, "read-week-3");
  assert.equal(decide(CALENDAR, [...week2, made("later-2"), detected(3), made("read-week-3")]).kind, "complete");
});

test("a stale detection is never read as the next week's", () => {
  const week1 = [...STEPS_BEFORE_CALENDAR, detected(1), made("read-week-1"), made("later-1"), made("detect-week-2"), detected(1)];
  assert.throws(() => decide(CALENDAR, week1), /newest detection is not week 2/u);
});

test("a decision after the saved Flow's run is refused by name", () => {
  const note: Entry = { callId: "n", toolId: "core.attempt_note", value: { flowRun: { stoppedAt: 4, happened: "the pager was gone" } } };
  assert.throws(() => decide(CALENDAR, [...STEPS_BEFORE_CALENDAR, note]), /stopped at step 4: the pager was gone/u);
});

const judged = (recordSets: unknown, ordinal = 0) => script.replies.loop_verification![ordinal]!({ kind: "loop_verification", ordinal: ordinal + 1, model: "m", jsonText: true, message: "", payload: { context: { resultSummary: { recordSets } } } }) as { diagnosis: { answersRequest: string; checked: unknown[] } };
const slots = (...pairs: readonly [string, string][]) => [{ datasetId: "saturday-slots", recordCount: pairs.length, columns: ["date", "time"], sampleRows: pairs.map(([date, time]) => ({ date, time })) }];

test("the judge says yes to exactly the two oracle rows, and throws otherwise", () => {
  assert.equal(judged(slots(["2026-10-03", "11:30"], ["2026-10-17", "09:00"])).diagnosis.answersRequest, "yes");
  assert.throws(() => judged(slots(["2026-10-03", "11:30"])), /1 rows held/u);
  assert.throws(() => judged(slots(["2026-10-03", "11:30"], ["2026-10-17", "09:00"], ["2026-10-10", "09:00"])), /3 rows held/u);
  assert.throws(() => judged(slots(["2026-10-03", "11:30"], ["2026-10-10", "09:00"])), /expected 2026-10-03 11:30; 2026-10-17 09:00/u);
  assert.throws(() => judged(slots(["2026-10-17", "09:00"], ["2026-10-03", "11:30"])), /not the two free Saturday slots/u);
  assert.throws(() => judged([]), /0 rows held/u);
});

test("it answers four attempts", () => {
  assert.equal(script.replies.panel_command!.length, 4);
  assert.ok(script.replies.loop_verification!.length >= 8);
  assert.throws(() => scriptedModelScriptFor(TASK, "no-such-form"), /no form "no-such-form"/u);
});

/** The domain's rule for a record field key (`domain/src/actions/extraction/field-key.ts`), which the package does not export. */
const LEGAL_FIELD_KEY = /^[A-Za-z0-9_-]{1,100}$/u;

test("the heading column is written under a legal field key, and the processing declaration's words still bind it", () => {
  const list = decide(CALENDAR, [...STEPS_BEFORE_CALENDAR, detected(1)]).input?.parameters?.extractList;
  for (const key of Object.keys(list.fields)) assert.match(key, LEGAL_FIELD_KEY, `${key} is not a legal field key`);
  // Core's binding folds `_`, `-` and spaces to one space and ignores case, so the declaration's "group heading" reads it.
  const declared = (scriptedTaskProcess(TASK).where as unknown as Array<{ field: string }>)[0]!;
  assert.equal(declared.field, "group heading");
  const fold = (name: string) => name.replace(/[\s_-]+/gu, " ").trim().toLowerCase();
  assert.ok(Object.keys(list.fields).some((key) => fold(key) === fold(declared.field)));
});

test("a refused read stops the script at that read instead of pressing on", () => {
  const refused: Entry = { callId: "read-week-1", toolId: "core.run_node", value: { ok: false, code: "target_unobserved", detail: { reason: "malformed_handle", instead: ["web.handle.malformed:extractList.fields.2"] } } };
  assert.throws(() => decide(CALENDAR, [...STEPS_BEFORE_CALENDAR, detected(1), refused]), /read-week-1.*refused: target_unobserved; malformed_handle; web\.handle\.malformed:extractList\.fields\.2/u);
});
