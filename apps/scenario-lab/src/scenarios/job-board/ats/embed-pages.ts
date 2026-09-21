import { escapeHtml, fixtureClient } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { postingByKey, SUBMITTED_DATE_TEXT } from "../catalog/index.js";
import type { JobBoardState, Posting, SubmittedApplication } from "../types.js";
import { DIALLING_CODES, NOTICE_OPTIONS, SOURCE_OPTIONS } from "./application.js";
import { formScript } from "./form-script.js";

/** Talentloom's embed is framed by employer sites on the lab's other loopback port. */
export const EMBED_CSP = "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors http://127.0.0.1:*";

const EMBED_STYLE = `
[hidden]{display:none!important}
body{margin:0;font:15px/1.5 Helvetica,Arial,sans-serif;color:#1c1c1c;background:#fff}
.tl{padding:22px 26px}.tl h1{font-size:22px;margin:0 0 4px}.tl-sub{color:#666;margin:0 0 18px}
.tl-req{font-size:13px;color:#666}
.tl-row{margin:0 0 18px;border:0;padding:0;position:relative}
.tl-row label,.tl-row legend{display:block;font-weight:600;margin-bottom:5px;padding:0}
.tl-row input[type=text],.tl-row input[type=email],.tl-row input[type=tel],.tl-row input[type=url],.tl-row select,.tl-row textarea{width:100%;box-sizing:border-box;padding:9px;border:1px solid #bbb;border-radius:4px;font:inherit}
.tl-phone{display:flex;gap:8px}.tl-phone select{width:210px!important;flex:none}
.tl-suggest{position:absolute;left:0;right:0;top:100%;background:#fff;border:1px solid #bbb;z-index:4;box-shadow:0 6px 16px #0002}
.tl-option{padding:8px 10px;cursor:pointer}.tl-option:hover{background:#eef2ff}
.tl-resume{display:flex;gap:10px;align-items:center}.tl-attach{padding:7px 14px;border:1px solid #bbb;background:#f6f6f6;border-radius:4px;cursor:pointer;font:inherit}
.tl-toggle{display:flex;gap:10px}.tl-opt{border:1px solid #bbb;border-radius:18px;padding:5px 22px;cursor:pointer}.tl-on{background:#1f3a8a;color:#fff;border-color:#1f3a8a}
.tl-check{display:flex;gap:10px;align-items:flex-start;margin:0 0 14px}.tl-check label{font-weight:400}
.tl-hint{font-size:13px;color:#666;margin:4px 0 0}
.tl-error{color:#b91c1c;font-size:13px;margin:4px 0 0}.tl-errors{color:#b91c1c;font-weight:600;min-height:1em}
.tl-submit{background:#1f3a8a;color:#fff;border:0;border-radius:4px;padding:12px 26px;font:inherit;font-weight:700;cursor:pointer}
.tl-hp{position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden}
.tl-shield{position:fixed;inset:0;background:#ffffffe6;display:flex;align-items:flex-end;justify-content:center;padding-bottom:160px;z-index:9}
.tl-shield div{border:1px solid #ccc;border-radius:8px;padding:22px 28px;background:#fff;max-width:360px;text-align:center;box-shadow:0 8px 30px #0002}
.tl-shield button{font:inherit;padding:9px 20px;border-radius:4px;border:0;background:#1f3a8a;color:#fff}.tl-shield button:disabled{background:#9ca3af}
.tl-receipt{display:grid;grid-template-columns:140px 1fr;gap:6px 14px;background:#f6f7fb;border-radius:6px;padding:16px 20px}.tl-receipt dt{color:#666}.tl-receipt dd{margin:0;font-weight:600}
.tl-foot{color:#888;font-size:12px;margin-top:28px}`;

function embedDocument(title: string, body: string, script: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>${escapeHtml(title)}</title><style>${EMBED_STYLE}</style></head><body>${body}<p class="tl-foot" style="padding:0 26px">Powered by Talentloom · Candidate privacy notice</p>${script ? `<script type="module">${script}</script>` : ""}</body></html>`;
}

const options = (entries: ReadonlyArray<{ value: string; label: string }>, placeholder?: string) =>
  `${placeholder === undefined ? "" : `<option value="">${placeholder}</option>`}${entries.map((entry) => `<option value="${entry.value}">${escapeHtml(entry.label)}</option>`).join("")}`;

/**
 * Talentloom's application form for `posting`. Its field names are the ATS's
 * own contract and stay put; everything a person has to get right is in the
 * answers: the phone field opens on the United States, the location must be
 * picked from a lookup that offers American Bristols first, the CV is attached
 * or typed in after pressing "Enter manually", the work-rights question is a
 * pair of unlabelled pills, the salary must be a bare number, the talent
 * community box arrives ticked, and a field labelled "Confirm email" sits off
 * screen as a honeypot: filling it gets the application quietly discarded.
 */
export function renderApplicationForm(context: RenderContext, posting: Posting): string {
  const body = `<main class="tl"><h1>${escapeHtml(posting.title)}</h1><p class="tl-sub">${escapeHtml(posting.company)} · ${escapeHtml(posting.location)}</p>
<form novalidate>
<p class="tl-req">* Required</p>
<div class="tl-row"><label for="first_name">First name *</label><input type="text" id="first_name" name="first_name" autocomplete="given-name"></div>
<div class="tl-row"><label for="last_name">Last name *</label><input type="text" id="last_name" name="last_name" autocomplete="family-name"></div>
<div class="tl-row"><label for="email">Email *</label><input type="email" id="email" name="email" autocomplete="email"></div>
<div class="tl-hp" aria-hidden="true"><label for="confirm_email">Confirm email</label><input type="email" id="confirm_email" name="confirm_email" tabindex="-1" autocomplete="off"></div>
<div class="tl-row"><label for="phone">Phone</label><div class="tl-phone"><select name="phone_country" aria-label="Country">${options(DIALLING_CODES)}</select><input type="tel" id="phone" name="phone" autocomplete="tel-national"></div></div>
<div class="tl-row"><label for="location_text">Location (city) *</label><input type="text" id="location_text" name="location_text" autocomplete="off"><input type="hidden" name="location_id"><div class="tl-suggest" hidden></div></div>
<div class="tl-row"><label>Resume/CV *</label><div class="tl-resume"><button type="button" class="tl-attach">Attach</button><input type="file" name="resume" hidden accept=".pdf,.doc,.docx,.txt"><span class="tl-filename"></span><span>or</span><a href="#" class="tl-manual">Enter manually</a></div><textarea name="resume_text" rows="7" hidden></textarea></div>
<div class="tl-row"><label for="website">Website or portfolio</label><input type="url" id="website" name="website"></div>
<fieldset class="tl-row"><legend>Are you legally authorised to work in the United Kingdom? *</legend><div class="tl-toggle"><div class="tl-opt">Yes</div><div class="tl-opt">No</div></div><input type="hidden" name="right_to_work"></fieldset>
<div class="tl-row"><label for="sponsorship">Will you now or in the future require sponsorship for employment visa status? *</label><select id="sponsorship" name="sponsorship"><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option></select></div>
<div class="tl-row"><label for="notice">What is your notice period? *</label><select id="notice" name="notice">${options(NOTICE_OPTIONS, "Select...")}</select></div>
<div class="tl-row"><label for="salary_expectation">What are your salary expectations? *</label><input type="text" id="salary_expectation" name="salary_expectation" inputmode="numeric"><p class="tl-hint">Annual, in pounds sterling.</p></div>
<div class="tl-row"><label for="source">How did you hear about this job? *</label><select id="source" name="source">${options(SOURCE_OPTIONS, "Select...")}</select></div>
<div class="tl-check"><input type="checkbox" id="talent_pool" name="talent_pool" checked><label for="talent_pool">Keep me in ${escapeHtml(posting.company)}'s talent community and share my profile with Talentloom partner employers hiring for similar roles.</label></div>
<div class="tl-check"><input type="checkbox" id="privacy" name="privacy"><label for="privacy">I have read and accept the candidate privacy notice. *</label></div>
<p class="tl-errors" role="alert"></p>
<button type="submit" class="tl-submit">Submit application</button>
</form>
<div class="tl-shield" hidden><div><strong>Talentloom Shield</strong><p>Checking that this application is being sent by a person. This only takes a moment.</p><button type="button" disabled>Please wait</button></div></div>
</main>`;
  return embedDocument(`Apply for ${posting.title}`, body, `${fixtureClient(context.runToken, "job-board")}\n${formScript(posting.key)}`);
}

/** What the embed shows for a requisition that takes no applications. */
export function renderEmbedClosed(): string {
  return embedDocument("Position closed", `<main class="tl"><h1>This job is no longer accepting applications</h1><p>The position may have been filled or withdrawn.</p></main>`, "");
}

/**
 * The thank-you page. A genuine application gets a receipt with its
 * reference; one whose honeypot was filled gets the same thanks and nothing
 * else, which is how an ATS drops spam without telling the sender.
 */
export function renderConfirmation(state: JobBoardState, id: string): string | undefined {
  const application: SubmittedApplication | undefined = state.applications.find((candidate) => candidate.id === id);
  const posting = application ? postingByKey(application.answers.jobKey) : undefined;
  if (!application || !posting) return undefined;
  const receipt = application.reference === null ? "" : `<dl class="tl-receipt"><dt>Role</dt><dd>${escapeHtml(posting.title)}</dd><dt>Company</dt><dd>${escapeHtml(posting.company)}</dd><dt>Reference</dt><dd data-testid="application-reference">${application.reference}</dd><dt>Submitted</dt><dd>${SUBMITTED_DATE_TEXT}</dd></dl><p>Keep your reference for any questions about this application.</p>`;
  const body = `<main class="tl"><h1>Thank you for applying, ${escapeHtml(application.answers.firstName)}!</h1><p>Your application for ${escapeHtml(posting.title)} at ${escapeHtml(posting.company)} has been received. The hiring team will review it and be in touch.</p>${receipt}</main>`;
  return embedDocument("Application received", body, "");
}
