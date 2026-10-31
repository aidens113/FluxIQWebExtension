// What a failed page action tells the model, held to two properties.
//
// **A failure the page explained must reach the model explained.** The defect
// pinned here is `run-mulryg6h-ff241a12`, 2026-09-28: `web.dom.extract_list`
// failed three times, the extension computed a full account of why each time,
// and the model was told the single word `action_failed` with no detail at all,
// three times over, in 6,149 byte-identical bytes. It had nothing to change, so
// it changed an argument, got the same answer, and the build ran out of
// iterations with no Flow. Every assertion below fails if that detail is
// dropped again.
//
// **And a refusal still says nothing about the page.** Each value carried is a
// count, one word of a closed set, or a field key the call itself declared, so
// the last test walks the whole detail and refuses anything else.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../../failure";
import { rejectionDetail, WEB_LLM_TOOL_REJECTION_REASONS } from "../../tool-rejection";
import { repeatedRejectionDetail } from "../../repeated-refusal";
import { webActionFailureRefusal } from "../refusal";

/** The words the page put in its own comparison text, none of which may reach a refusal. */
const PAGE_WORDS = ["Tidewell", "sage green", ".product-row td", "Brightaisle"] as const;

test("current typed actionability wins the covered distinction without overriding failure or person authority", () => {
  const failure = { code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE, actual: "hidden: legacy words" };
  assert.equal(webActionFailureRefusal({ status: "failed", failure, payload: { actionability: { actionable: false, cause: "covered" } } }).code, "target_covered");
  const covered = { code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE, actual: "covered: legacy words" };
  for (const actionability of [{ actionable: true }, { actionable: false, cause: "hidden" }, { actionable: false, cause: "disabled" }]) {
    assert.equal(webActionFailureRefusal({ status: "failed", failure: covered, payload: { actionability } }).code, "target_not_actionable");
  }
  assert.equal(webActionFailureRefusal({ status: "failed", failure: covered }).code, "target_covered");
  assert.equal(webActionFailureRefusal({ status: "failed", failure: covered, payload: { actionability: { actionable: true, extra: "bad" } } }).code, "target_covered");
  assert.equal(webActionFailureRefusal({ status: "timed_out", failure: covered, payload: { actionability: { actionable: false, cause: "covered" } } }).code, "action_timed_out");
  const person = webActionFailureRefusal({ status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED }, payload: { actionability: { actionable: false, cause: "covered" } } });
  assert.equal(person.code, "needs_person");
  assert.equal(person.personNeeded, true);
});

test("only the closed incomplete_text prefix on an unobserved output gives disclosure recovery, never its page text", () => {
  const actual = `incomplete_text: ${PAGE_WORDS.join(" ")}`;
  const refused = webActionFailureRefusal({ status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, actual } });
  assert.equal(refused.code, "output_not_observed");
  assert.equal(refused.detail?.reason, "incomplete_text");
  assert.match(refused.detail?.next ?? "", /narrow the conditions so that row is not kept/u);
  assert.equal(repeatedRejectionDetail(refused.detail, 2)?.next, refused.detail?.next);
  const account = failedRead(summary({ listPresence: "appeared", itemsSeen: 1 }));
  const withAccount = webActionFailureRefusal({ status: account.status, payload: account.payload, failure: { code: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, actual } });
  assert.equal(withAccount.detail?.reason, "incomplete_text", "a positive incomplete-field marker must not become generic read shortfall");
  for (const words of PAGE_WORDS) assert.equal(JSON.stringify(refused).includes(words), false);
  for (const code of [WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, WEB_AUTOMATION_FAILURE_CODES.TIMEOUT]) {
    assert.notEqual(webActionFailureRefusal({ status: "failed", failure: { code, actual } }).detail?.reason, "incomplete_text");
  }
  for (const text of ["incomplete_textual: not the closed prefix", "prefix incomplete_text: elsewhere", "incomplete_text", undefined]) {
    assert.notEqual(webActionFailureRefusal({ status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, actual: text } }).detail?.reason, "incomplete_text");
  }
  assert.notEqual(webActionFailureRefusal({ status: "timed_out", failure: { code: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, actual } }).detail?.reason, "incomplete_text");
});

// social rerun 3 (steps 0029, 0056, 0083, 0186, 0241): the field was dropped,
// so the build sent the same field again. It is named now, but only when it is
// a key of the `extractList.fields` this domain sent.
test("an incomplete text refusal names the field only when it is a key of the fields the request sent", () => {
  const actual = "incomplete_text: field summary contains unexpanded text; then read full text";
  const failure = { code: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, actual };
  const sent = { actionType: "web.dom.extract_list", parameters: { extractList: { item: "t4", fields: { title: "h3", summary: "p" } } } };
  const named = webActionFailureRefusal({ status: "failed", failure }, sent);
  assert.equal(named.detail?.reason, "incomplete_text");
  assert.deepEqual(named.detail?.missing, ["summary"]);
  assert.match(named.detail?.next ?? "", /the field `summary`/u);
  assert.match(named.detail?.next ?? "", /leave that field out/iu);
  assert.equal(repeatedRejectionDetail(named.detail, 2)?.next, named.detail?.next, "a repeat names the field again");
  const unsent = webActionFailureRefusal({ status: "failed", failure: { ...failure, actual: "incomplete_text: field secretColumn contains unexpanded text" } }, sent);
  assert.equal(unsent.detail?.reason, "incomplete_text");
  assert.equal(unsent.detail?.missing, undefined);
  assert.equal(JSON.stringify(unsent).includes("secretColumn"), false, "a key the request never sent is never echoed");
  const noRequest = webActionFailureRefusal({ status: "failed", failure });
  assert.equal(noRequest.detail?.missing, undefined);
  assert.equal(JSON.stringify(noRequest).includes("summary"), false, "without the request nothing is named");
  const otherRequest = webActionFailureRefusal({ status: "failed", failure }, { actionType: "web.dom.extract_list", parameters: { extractList: { item: "t4", fields: ["summary"] } as unknown as JsonObject } });
  assert.equal(otherRequest.detail?.missing, undefined, "fields that are not a key map name nothing");
});

test("target ambiguity retains a closed distinct reason without exposing the failure's page text", () => {
  const ambiguous = webActionFailureRefusal({
    status: "failed",
    failure: { code: WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS, actual: PAGE_WORDS.join(" ") }
  });
  assert.equal(ambiguous.code, "target_not_found");
  assert.equal(ambiguous.detail?.reason, "target_ambiguous");
  assert.equal(WEB_LLM_TOOL_REJECTION_REASONS.some((reason: string) => reason === "target_ambiguous"), true);
  for (const privateText of PAGE_WORDS) assert.equal(JSON.stringify(ambiguous).includes(privateText), false);
  const missing = webActionFailureRefusal({ status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND } });
  assert.deepEqual(missing, { code: "target_not_found", detail: undefined });
});

type Summary = Record<string, unknown>;

/** A well-formed extraction summary: the shape `actions/extraction/summary.ts` copies. */
function summary(fields: Summary): Summary {
  return { recordCount: 0, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["item", "quantity", "price"], ...fields };
}

/** The result a failed list read arrives as: the code on the record, the account on the payload. */
function failedRead(extraction: Summary, code: string = WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED) {
  return {
    status: "failed",
    failure: { code, actual: `0 records from 1 page; the item selector ${PAGE_WORDS[2]} named nothing` },
    payload: { extraction } as unknown as JsonObject
  };
}

test("a read that came back short reaches the model with the reason the page computed, never a bare action_failed", () => {
  // The selector named nothing. Changing the fields or the conditions cannot
  // help, and only this reason says so.
  const never = webActionFailureRefusal(failedRead(summary({ listPresence: "never_appeared", itemsSeen: 0, listWait: { stoppedOn: "window_elapsed", waitedMs: 11_204, waitedFor: 1 } })));
  assert.equal(never.code, "output_not_observed");
  assert.equal(never.detail?.reason, "list_never_appeared");
  assert.equal(never.detail?.recordsRead, 0);
  assert.equal(never.detail?.itemsSeen, 0);
  assert.equal(never.detail?.waitStoppedOn, "window_elapsed");

  // The list was there and the wait gave up before it finished drawing.
  const late = webActionFailureRefusal(failedRead(summary({ listPresence: "appeared", itemsSeen: 0, listWait: { stoppedOn: "page_settled", waitedMs: 2_089, waitedFor: 2 } })));
  assert.equal(late.detail?.reason, "list_did_not_finish_loading");
  assert.equal(late.detail?.waitStoppedOn, "page_settled");

  // The read's own conditions emptied it: the page is not the problem.
  const filtered = webActionFailureRefusal(failedRead(summary({ listPresence: "appeared", itemsSeen: 20, conditions: { applied: 20, kept: 0, rejected: [20, 3], unfiltered: false } })));
  assert.equal(filtered.detail?.reason, "conditions_kept_nothing");
  assert.equal(filtered.detail?.itemsSeen, 20);

  // Rows found, every one empty: the fields are read off the wrong element.
  const hollow = webActionFailureRefusal(failedRead(summary({ recordCount: 12, emptyRecords: 12, listPresence: "appeared", itemsSeen: 12 })));
  assert.equal(hollow.detail?.reason, "records_have_no_fields");
  assert.equal(hollow.detail?.recordsRead, 12);
  assert.equal(hollow.detail?.emptyRecords, 12);

  // A declared column some record had nothing in, named in the call's own words.
  const short = webActionFailureRefusal(failedRead(summary({ recordCount: 9, emptyRecords: 0, missingFields: ["price"], listPresence: "appeared", itemsSeen: 9 })));
  assert.equal(short.detail?.reason, "required_fields_missing");
  assert.deepEqual(short.detail?.missingFields, ["price"]);

  // Whole rows, just not enough of them.
  const few = webActionFailureRefusal(failedRead(summary({ recordCount: 1, emptyRecords: 0, listPresence: "appeared", itemsSeen: 1 })));
  assert.equal(few.detail?.reason, "fewer_records_than_required");

  // A page that simply held nothing, with no wait to blame it on.
  const empty = webActionFailureRefusal(failedRead(summary({ listPresence: "appeared", itemsSeen: 3 })));
  assert.equal(empty.detail?.reason, "no_records_read");
});

test("the read's account is carried whatever code the page failed under, including a timeout", () => {
  // The extraction that cost `run-mulryg6h-ff241a12` its Flow burned 11 to 14
  // seconds a call, which is the shape of a read that ran out of time. Reading
  // the account only for one code would have left that one bare again.
  const refusal = webActionFailureRefusal({
    status: "timed_out",
    failure: { code: WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, actual: "the time ran out before the list ended" },
    payload: { extraction: summary({ listPresence: "never_appeared", itemsSeen: 0 }) } as unknown as JsonObject
  });
  assert.equal(refusal.code, "action_timed_out");
  assert.equal(refusal.detail?.reason, "list_never_appeared");
});

/** Every code that used to fall through to `action_failed`, against what it says now. */
const NAMED: ReadonlyArray<readonly [string, string, string | undefined]> = [
  // The code alone says the whole of this one; which shortfall it was comes off
  // the read's own account, tested above.
  [WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, "output_not_observed", undefined],
  [WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH, "output_not_observed", "state_not_as_asserted"],
  [WEB_AUTOMATION_FAILURE_CODES.BROWSER_PERMISSION_DENIED, "not_permitted_here", "page_not_scriptable"],
  [WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT, "action_failed", "channel_to_page_failed"],
  [WEB_AUTOMATION_FAILURE_CODES.NO_EFFECT, "action_failed", "press_had_no_effect"],
  [WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE, "invalid_input", "node_not_runnable_here"],
  [WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED, "invalid_input", "node_not_runnable_here"],
  [WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER, "invalid_input", "parameter_not_readable"],
  // t174 F40: the page refused the press and said so. Both arrived as a bare
  // `action_failed` -- the coupon's busy line at run-muqk4u32 step 0021 read
  // "Didn't work: the step wasn't accepted" -- and the colour Add to cart
  // refused had no code of its own at all.
  ["web.action.refused_by_page", "refused_by_page", "page_needs_something_first"],
  [WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, "refused_by_page", "page_busy_try_later"],
  // t743: a press answered by nothing but the page's own live-region notice.
  [WEB_AUTOMATION_FAILURE_CODES.PAGE_REPORTED_FAILURE, "refused_by_page", "page_reported_press_failed"],
  // t509: a select sent an option it does not offer, and was told only `output_not_observed`.
  [WEB_AUTOMATION_FAILURE_CODES.OPTION_NOT_OFFERED, "output_not_observed", "option_not_offered"]
];

test("a no-effect refusal explains that automatic retries finished without claiming success", () => {
  const refusal = webActionFailureRefusal({ status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.NO_EFFECT } });
  assert.equal(refusal.detail?.reason, "press_had_no_effect");
  assert.match(refusal.detail?.next ?? "", /Automatic retries have finished/);
  assert.match(refusal.detail?.next ?? "", /effect has not been established/);
});

test("a press the page reported failed says the retries finished and points at the notice, never claiming success (t743)", () => {
  const refusal = webActionFailureRefusal({ status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.PAGE_REPORTED_FAILURE } });
  assert.equal(refusal.code, "refused_by_page");
  assert.equal(refusal.detail?.reason, "page_reported_press_failed");
  assert.match(refusal.detail?.next ?? "", /Automatic retries have finished/);
  assert.match(refusal.detail?.next ?? "", /status or alert region/);
  assert.match(refusal.detail?.next ?? "", /effect has not been established/);
});

test("every failure code the page can send is named, and only the two that name nothing stay bare", () => {
  const refusalFor = (code: string) => webActionFailureRefusal({ status: "failed", failure: { code } });
  for (const [code, expectedCode, expectedReason] of NAMED) {
    const refusal = refusalFor(code);
    assert.equal(refusal.code, expectedCode, `${code} should be refused as ${expectedCode}`);
    assert.equal(refusal.detail?.reason, expectedReason, `${code} should say ${String(expectedReason)}`);
  }

  // The two that are bare on purpose: `web.action.failed` is defined as the
  // failure no other code names, and `web.action.unknown` is the page saying it
  // does not know. Inventing a reason for either would be this domain claiming
  // to know something the page said it does not.
  assert.deepEqual(refusalFor(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED), { code: "action_failed", detail: undefined });
  assert.deepEqual(refusalFor(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN), { code: "action_failed", detail: undefined });

  // Every reason the table can produce is one of the closed set, so a refusal
  // can never carry a word somebody wrote about the page.
  for (const code of Object.values(WEB_AUTOMATION_FAILURE_CODES)) {
    const reason = refusalFor(code).detail?.reason;
    if (reason !== undefined) assert.ok(WEB_LLM_TOOL_REJECTION_REASONS.includes(reason), `${code} answered with an unlisted reason ${reason}`);
  }
});

test("a page's refusal says which kind it was in words Core's repeat guard reads one way each, and none of the page's own", () => {
  // Core's repeat guard lets a call be made again on the same page only when its
  // result code or reason says to try later (`RETRY_LATER` in
  // `AS/runtime/llm/repeat-guard/outcomes.ts`, restated here). A busy page may be
  // pressed again; a page that needs a choice first is answered the same way
  // until the choice is made, so its words must not say "later".
  const RETRY_LATER = /rate[_-]?limit|too[_-]?many|throttl|retry|disabled|busy|not[_-]?ready|loading|timed[_-]?out|timeout|try[_-]?again/iu;
  const needs = webActionFailureRefusal({ status: "failed", failure: { code: "web.action.refused_by_page", actual: "Please select a Color." } });
  const busy = webActionFailureRefusal({ status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, actual: "Network busy, please try again" } });
  assert.equal(RETRY_LATER.test(`web.action.rejected.${needs.code} ${needs.detail?.reason ?? ""}`), false);
  assert.equal(RETRY_LATER.test(`web.action.rejected.${busy.code} ${busy.detail?.reason ?? ""}`), true);
  for (const refusal of [needs, busy]) {
    const said = JSON.stringify(refusal);
    assert.equal(/select a color|network busy/iu.test(said), false, `a refusal repeated the page's notice: ${said}`);
    assert.equal(refusal.personNeeded, undefined);
  }
});

test("a select asked for an option it does not offer is told where the options are and how to name one, in none of the page's words (t509)", () => {
  // Live (`run-mv6qrcdu-a31b44b8`, steps 0020, 0030, 0032), a distance select
  // was sent its option's visible words where it wanted the option's value and
  // was answered a bare `output_not_observed` three times, the repeat guard
  // refusing the copies in between. The client's sentence names the options,
  // which are the page's words, so the refusal says where they are shown.
  const refusal = webActionFailureRefusal({ status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.OPTION_NOT_OFFERED, actual: "no option matched; the select offers \"10\" (Ten leagues)" } });
  assert.equal(refusal.code, "output_not_observed");
  assert.equal(refusal.detail?.reason, "option_not_offered");
  assert.match(refusal.detail?.next ?? "", /no option of this select/u);
  assert.match(refusal.detail?.next ?? "", /page view lists its options/u);
  assert.match(refusal.detail?.next ?? "", /describe_element/u);
  assert.equal(/leagues/iu.test(JSON.stringify(refusal)), false, "the page's option words do not ride on the refusal");
});

test("a malformed or absent account leaves the code alone rather than inventing counts", () => {
  // An action that counts nothing -- a click whose post-condition did not hold.
  const clicked = webActionFailureRefusal({ status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED } });
  assert.equal(clicked.code, "output_not_observed");
  assert.equal(clicked.detail, undefined);

  // A summary the closed copy refuses drops whole -- here a missing field that
  // is not one of the read's own -- and nothing is guessed from the half of it
  // that was well formed.
  const broken = webActionFailureRefusal(failedRead({ recordCount: 0, pagesRead: 1, truncated: false, missingFields: ["price"], fieldNames: ["item"] }));
  assert.equal(broken.detail, undefined);
});

test("nothing the page said rides out on a refusal", () => {
  const refusal = webActionFailureRefusal(failedRead(summary({
    recordCount: 4,
    emptyRecords: 0,
    itemsSeen: 20,
    missingFields: ["price"],
    listPresence: "appeared",
    listWait: { stoppedOn: "list_present", waitedMs: 340, waitedFor: 2 },
    conditions: { applied: 20, kept: 4, rejected: [16], unfiltered: false }
  })));
  const said = JSON.stringify(refusal);
  for (const word of PAGE_WORDS) assert.equal(said.includes(word), false, `a refusal repeated ${word} from the page`);
  // Counts, one closed word, and the call's own declared keys. Nothing else has
  // a place here, so a member added without deciding that fails this.
  assert.deepEqual(
    Object.keys(refusal.detail ?? {}).sort(),
    ["emptyRecords", "itemsSeen", "missingFields", "reason", "recordsRead", "waitStoppedOn"]
  );
});

test("a target the page has and does not show is still refused to the model as target_not_actionable, whatever its words", () => {
  // t193-1002m: the gate's `hidden` refusal has its own code, Core's
  // `target_not_found`, so a Flow run routes by state. Exploration is unchanged:
  // the model reads the same word it read when the code was
  // `web.target.not_actionable`, and no reason is invented for it.
  const code = WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN;
  for (const failure of [{ code, actual: "hidden: the element's display is none" }, { code, actual: "covered: never written with this code" }, { code }]) {
    const actual = "actual" in failure ? failure.actual : undefined;
    const refusal = webActionFailureRefusal({ status: "failed", failure });
    assert.equal(refusal.code, "target_not_actionable", String(actual));
    assert.equal(refusal.detail, undefined, String(actual));
    assert.equal(refusal.personNeeded, undefined);
  }
  // Disabled and covered keep their code and their words.
  assert.equal(webActionFailureRefusal({ status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE, actual: "disabled: the element is disabled" } }).code, "target_not_actionable");
  assert.equal(webActionFailureRefusal({ status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE, actual: "covered: the point 1,2 landed on div.scrim" } }).code, "target_covered");
});

// t626: a Next page step that pressed nothing because its Next would leave the
// filters the page shows applied says so, with the count the extension wrote
// as a field of its answer, and a repeat of the refusal says it again.

test("a page fault whose Next would drop applied filters names it and the count, and nothing else", () => {
  const failure = { code: WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, actual: "page_fault: The pager's Next leads to an address that leaves out 2 query parameters this page shows applied, Brightaisle" };
  const refused = webActionFailureRefusal({ status: "failed", failure, payload: { nextPage: { outcome: "failed", stop: "page_fault", filtersDropped: 2 } } });
  assert.equal(refused.code, "action_failed");
  assert.equal(refused.detail?.reason, "next_leaves_filtered_list");
  assert.equal(WEB_LLM_TOOL_REJECTION_REASONS.includes("next_leaves_filtered_list"), true);
  assert.equal(refused.detail?.filtersDropped, 2);
  assert.equal(refused.detail?.paginationStop, "page_fault");
  assert.match(refused.detail?.next ?? "", /filtersDropped/u);
  for (const privateText of PAGE_WORDS) assert.equal(JSON.stringify(refused).includes(privateText), false);
  const repeated = repeatedRejectionDetail(refused.detail, 2);
  assert.equal(repeated.reason, "next_leaves_filtered_list");
  assert.equal(repeated.filtersDropped, 2);
  assert.equal(repeated.next, refused.detail?.next);
});

test("a page fault with no count, a count beside another word, or a count in the sentence alone stays bare action_failed", () => {
  const failure = { code: WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, actual: "page_fault: leaves out 2 query parameters" };
  for (const nextPage of [{ outcome: "failed", stop: "page_fault" }, { outcome: "failed", stop: "list_unchanged", filtersDropped: 2 }, { outcome: "failed", stop: "page_fault", filtersDropped: 0 }, undefined]) {
    const result = nextPage === undefined ? { status: "failed", failure } : { status: "failed", failure, payload: { nextPage } };
    assert.deepEqual(webActionFailureRefusal(result), { code: "action_failed", detail: undefined }, JSON.stringify(nextPage));
  }
  // The count is read only beside the code its word maps to.
  const other = webActionFailureRefusal({ status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED }, payload: { nextPage: { outcome: "failed", stop: "page_fault", filtersDropped: 2 } } });
  assert.notEqual(other.detail?.reason, "next_leaves_filtered_list");
});

// t640: a step whose parameter had no value when it ran is told so by the
// closed words leading INVALID_PARAMETER's `actual`, and only by them.
test("a parameter with no value is named by its closed words on INVALID_PARAMETER alone, and no other sentence becomes one", () => {
  const refused = (code: string, actual: unknown, status = "failed") => webActionFailureRefusal({ status, failure: { code, actual } });
  const invalid = WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER;
  assert.deepEqual(refused(invalid, "no value: url had no value when the step ran"), { code: "invalid_input", detail: { reason: "parameter_has_no_value", missing: ["url"] } });
  assert.equal(WEB_LLM_TOOL_REJECTION_REASONS.includes("parameter_has_no_value"), true);
  // Another code with the same words, a sentence without them, or a name that is no identifier keeps the old answer.
  assert.equal(refused(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, "no value: url").detail, undefined);
  assert.equal(refused(invalid, "url is not text").detail?.reason, "parameter_not_readable");
  assert.equal(refused(invalid, "no value: https://shop.test/").detail?.reason, "parameter_not_readable");
  assert.equal(refused(invalid, "no value: url-x").detail?.reason, "parameter_not_readable");
  assert.equal(refused(invalid, undefined).detail?.reason, "parameter_not_readable");
});

// t738, social `run-mvgf7ij5-a9747575`: a scroll refused INVALID_PARAMETER was
// told only `parameter_not_readable`. The keys are read off the request this
// domain sent, never off the client's sentence.
test("an unreadable scroll names its missing and unknown keys and the closed key list, from the request sent alone", () => {
  const invalid = { status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER, actual: `scroll request refused near ${PAGE_WORDS[0]}` } };
  const refused = webActionFailureRefusal(invalid, { actionType: "web.dom.scroll", parameters: { scroll: { direction: "down", amount: 3 } } });
  assert.equal(refused.code, "invalid_input");
  assert.equal(refused.detail?.reason, "parameter_not_readable");
  assert.deepEqual(refused.detail?.missing, ["mode"]);
  assert.deepEqual(refused.detail?.instead, ["web.scroll.key.missing.mode", "web.scroll.key.unknown.direction", "web.scroll.key.unknown.amount"]);
  const next = refused.detail?.next ?? "";
  assert.match(next, /missing: mode; not taken: direction, amount/u);
  assert.match(next, /takes only the keys mode, x, y and maxScrolls/u);
  assert.match(next, /untilStable requires maxScrolls/u);
  for (const word of PAGE_WORDS) assert.equal(JSON.stringify(refused).includes(word), false);
  assert.equal(repeatedRejectionDetail(refused.detail, 2)?.next, next, "a repeat says the same keys");

  // untilStable without its bound, and a bad bound, are named; a key that is no name is counted, not quoted.
  const unbounded = webActionFailureRefusal(invalid, { actionType: "web.dom.scroll", parameters: { scroll: { mode: "untilStable" } } });
  assert.deepEqual(unbounded.detail?.missing, ["maxScrolls"]);
  const odd = webActionFailureRefusal(invalid, { actionType: "web.dom.scroll", parameters: { scroll: { mode: "untilStable", maxScrolls: 0, "a b<c>": 1 } } });
  assert.deepEqual(odd.detail?.instead, ["web.scroll.key.unknown", "web.scroll.key.invalid.maxScrolls"]);
  assert.equal(odd.detail?.missing, undefined);
  assert.equal(JSON.stringify(odd).includes("a b<c>"), false);
  assert.match(odd.detail?.next ?? "", /not taken: a key that is no name; not readable: maxScrolls/u);

  // No request, another node, a readable request or another code keeps the old answer.
  assert.deepEqual(webActionFailureRefusal(invalid), { code: "invalid_input", detail: { reason: "parameter_not_readable" } });
  assert.deepEqual(webActionFailureRefusal(invalid, { actionType: "web.dom.click", parameters: { scroll: { direction: "down" } } }).detail, { reason: "parameter_not_readable" });
  assert.deepEqual(webActionFailureRefusal(invalid, { actionType: "web.dom.scroll", parameters: { scroll: { mode: "untilStable", maxScrolls: 20 } } }).detail, { reason: "parameter_not_readable" });
  assert.deepEqual(webActionFailureRefusal(invalid, { actionType: "web.dom.scroll", parameters: { x: 0 } }).detail, { reason: "parameter_not_readable" });
  const other = webActionFailureRefusal({ status: "failed", failure: { code: WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED } }, { actionType: "web.dom.scroll", parameters: { scroll: {} } });
  assert.equal(other.detail, undefined);
});

// t741 C1b, live run `run-mvgo9wzn-fad4e050` step 0116: a press the site
// refused for now reached the model as `page_busy_try_later`, and the model was
// not told how long the site asked it to wait or that the tab had been taken
// back to the page the press was made on, so it could not tell when the same
// press would be worth making or that a menu it had opened was now closed. The
// actual sentence below is the extension's own shape
// (`apps/extension/src/runtime/click-landing.ts`) on a library catalogue page.
const RATE_LIMITED_RETURNED =
  "the server answered HTTP 429 for /catalogue/available: the site refused the load for now and nothing was loaded; " +
  "the tab was taken back to the page the click was pressed on (/catalogue); the same click may be made again after 5000 ms";

/**
 * A failed result whose record carries the extension's `retryAfterMs`. Built
 * apart from the call, as a real record arrives, because `WebFailedActionResult`
 * (`../result.ts`) declares only the record's code and sentence.
 */
function withRecord(status: string, failure: { code: string; actual?: string; retryAfterMs?: unknown }): { status: string; failure: typeof failure } {
  return { status, failure };
}

test("a press the site refused for now names the wait the site asked for and that the tab was taken back, and nothing of the page", () => {
  const refusal = webActionFailureRefusal(withRecord("failed", { code: WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, actual: RATE_LIMITED_RETURNED, retryAfterMs: 5000 }));
  assert.equal(refusal.code, "refused_by_page");
  assert.equal(refusal.detail?.reason, "page_busy_try_later");
  assert.equal(refusal.detail?.retryAfterMs, 5000);
  assert.equal(refusal.detail?.tabReturned, true);
  assert.match(refusal.detail?.next ?? "", /The site asked to wait 5 seconds/u);
  assert.match(refusal.detail?.next ?? "", /The tab was taken back to the page it showed before the press/u);
  // A repeat of the same refusal says the wait and the return again.
  const repeated = repeatedRejectionDetail(refusal.detail, 2);
  assert.equal(repeated.retryAfterMs, 5000);
  assert.equal(repeated.tabReturned, true);
  assert.equal(repeated.next, refusal.detail?.next);
  const said = JSON.stringify(refusal);
  assert.equal(said.includes("/catalogue"), false, `a refusal repeated the page's path: ${said}`);
});

test("a refused press with no wait and no confirmed return is told what it was told before, and only RATE_LIMITED is read for either", () => {
  const bare = webActionFailureRefusal(withRecord("failed", { code: WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED }));
  assert.deepEqual(bare.detail, { reason: "page_busy_try_later" });
  // A tab the extension could not confirm was the pressed page is not said to be returned.
  const unconfirmed = webActionFailureRefusal(withRecord("failed", {
    code: WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED,
    actual: "the server answered HTTP 429 for /a: the site refused the load for now and nothing was loaded; the tab was taken back to /b, but whether that is the page the click was pressed on is unconfirmed, because the address before the click went unread; the same click may be made again after 2000 ms",
    retryAfterMs: 2000
  }));
  assert.equal(unconfirmed.detail?.tabReturned, undefined);
  assert.equal(unconfirmed.detail?.retryAfterMs, 2000);
  assert.match(unconfirmed.detail?.next ?? "", /wait 2 seconds/u);
  // A wait that is not a whole positive count is not passed on.
  for (const retryAfterMs of [-1, 1.5, Number.NaN, "5000"]) {
    assert.equal(webActionFailureRefusal(withRecord("failed", { code: WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, retryAfterMs })).detail?.retryAfterMs, undefined);
  }
  // Another code carrying the same words and wait says neither.
  const other = webActionFailureRefusal(withRecord("failed", { code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN, actual: RATE_LIMITED_RETURNED, retryAfterMs: 5000 }));
  assert.equal(other.detail?.retryAfterMs, undefined);
  assert.equal(other.detail?.tabReturned, undefined);
  assert.equal(webActionFailureRefusal(withRecord("timed_out", { code: WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, actual: RATE_LIMITED_RETURNED, retryAfterMs: 5000 })).detail?.retryAfterMs, undefined);
});

test("a repeat of a covered press keeps the covering layer's own controls and says them again (t792)", () => {
  const covered = rejectionDetail({
    reason: "covered_by_layer",
    target: "t4",
    instead: ["t5"],
    closeWith: [],
    layerControls: ["t6 (a control with no words in the layer's header)", "t7 (a button)"]
  });
  const repeated = repeatedRejectionDetail(covered, 2);
  assert.deepEqual(repeated.layerControls, covered.layerControls);
  assert.equal(repeated.next, covered.next);
  assert.match(repeated.next ?? "", /t6/u);
});
