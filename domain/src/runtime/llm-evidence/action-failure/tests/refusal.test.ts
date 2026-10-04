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
import { WEB_LLM_TOOL_REJECTION_REASONS } from "../../tool-rejection";
import { webActionFailureRefusal } from "../refusal";

/** The words the page put in its own comparison text, none of which may reach a refusal. */
const PAGE_WORDS = ["Tidewell", "sage green", ".product-row td", "Brightaisle"] as const;

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
  [WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE, "invalid_input", "node_not_runnable_here"],
  [WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED, "invalid_input", "node_not_runnable_here"],
  [WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER, "invalid_input", "parameter_not_readable"],
  // t174 F40: the page refused the press and said so. Both arrived as a bare
  // `action_failed` -- the coupon's busy line at run-muqk4u32 step 0021 read
  // "Didn't work: the step wasn't accepted" -- and the colour Add to cart
  // refused had no code of its own at all.
  ["web.action.refused_by_page", "refused_by_page", "page_needs_something_first"],
  [WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, "refused_by_page", "page_busy_try_later"]
];

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
