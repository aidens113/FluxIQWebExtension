import { escapeHtml } from "../../../html.js";
import type { Posting } from "../types.js";

const STYLE = `
.tl-more{border-top:1px solid #ddd;margin:8px 0 22px;padding-top:18px}.tl-more h2{font-size:18px;margin:0 0 4px}
.tl-more input{width:100%;box-sizing:border-box;padding:9px;border:1px solid #bbb;border-radius:4px;font:inherit}
.tl-more input[readonly]{background:#f3f4f6;color:#555}.tl-note{color:#92400e;font-size:13px;margin:4px 0 0;min-height:1em}
.tl-hide{position:fixed;inset:0;background:#11182799;display:flex;align-items:center;justify-content:center;z-index:20}
.tl-hide>div{background:#fff;border-radius:8px;padding:22px 26px;max-width:380px;box-shadow:0 10px 32px #0004}.tl-hide h2{font-size:18px;margin:0 0 8px}
.tl-hide button{font:inherit;padding:8px 16px;margin:12px 10px 0 0;border-radius:4px;border:1px solid #1f3a8a;background:#fff;color:#1f3a8a;cursor:pointer}.tl-hide button:first-of-type{background:#1f3a8a;color:#fff}`;

const row = (name: string, label: string, control: string, hint = "") =>
  `<div class="tl-row"><label for="${name}">${label}</label>${control}${hint ? `<p class="tl-hint">${hint}</p>` : ""}</div>`;

const input = (name: string, type: string, extra = "") => `<input type="${type}" id="${name}" name="${name}"${extra}>`;

/**
 * The "A few more questions" section of Talentloom's longer form, for
 * `posting`, prefilled from the candidate's Talentloom profile. The values are
 * a made-up candidate's; the requisition number is the posting's own digits.
 * Its behaviour is `extendedQuestionsScript`.
 */
export function extendedQuestions(posting: Posting): string {
  const requisition = posting.apply.kind === "company" ? posting.apply.requisition.replace(/\D/gu, "") : "";
  const note = `<p class="tl-note" role="status"></p>`;
  return `<section class="tl-more"><style>${STYLE}</style><h2>A few more questions from ${escapeHtml(posting.company)}</h2><p class="tl-sub">We've filled in what your Talentloom profile already says. Check each answer before you submit.</p>
${row("requisition_number", "Requisition number", input("requisition_number", "number", ` value="${requisition}" readonly`))}
${row("years_experience", "Years of relevant experience", input("years_experience", "number", ` step="any" value="7"`), "Half years are fine, for example 3.5.")}
${row("reports_count", "How many people report to you today?", input("reports_count", "number", ` value="4"`), "Whole numbers only.")}
${row("start_date", "Earliest date you could start", input("start_date", "date", ` value="2026-09-01"`))}
${row("call_time", "Best time to call you", input("call_time", "time"))}
${row("qualification_month", "When did you finish your most recent qualification?", input("qualification_month", "month"))}
${row("interview_week", "Which week suits you for a first interview?", input("interview_week", "week"))}
${row("interview_slot", "Or choose an exact time for it", input("interview_slot", "datetime-local"))}
${row("hours_per_day", "Hours per working day", input("hours_per_day", "number", ` value="8"`), "This role is set at 8 hours a day.")}
${row("assessment_day", "Assessment day", input("assessment_day", "date", ` value="2026-09-01"`), "Every shortlisted candidate attends on this date.")}
${row("office_days", "Days a week you could be in the office", input("office_days", "number", ` value="3"`))}
${row("preferred_name", "Preferred name", input("preferred_name", "text", ` value="Sam" autocomplete="nickname"`))}
${row("current_employer", "Current employer", input("current_employer", "text", ` autocomplete="organization"`))}
${row("referral_code", "Referral code", `${input("referral_code", "text", ` value="RF-58213" autocomplete="off"`)}${note}`)}
${row("agency_reference", "Agency reference", `${input("agency_reference", "text", ` value="AG-30418" autocomplete="off"`)}${note}`)}
${row("account_password", "Create a password to track your application", input("account_password", "password", ` autocomplete="new-password"`), "At least 10 characters.")}
<input type="hidden" name="hide_from_employer" value="no">
</section>`;
}
