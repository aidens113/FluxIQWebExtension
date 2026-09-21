import { escapeHtml, fixtureClient } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { companyBySlug, POSTINGS, type Company } from "../catalog/index.js";
import type { JobBoardState, Posting } from "../types.js";

export const CAREERS_ROOT = "/scenarios/job-board/careers";
export const EMBED_ROOT = "/scenarios/job-board/embed";

/** The title of the frame Talentloom's application form is embedded in. */
export const APPLICATION_FRAME_TITLE = "Talentloom job application";

/** The postings that take applications on a company's careers site under the armed rendering. */
export function openCompanyPostings(state: JobBoardState, company: Company): Posting[] {
  return POSTINGS.filter((posting) => posting.apply.kind === "company" && posting.apply.careersSlug === company.slug && !posting.closed && !(state.mode === "posting-closed" && posting.id === "m1"));
}

/**
 * A company's own careers page for one requisition. It is the employer's
 * site, not Rolefinch's: its own look, its own cookie bar (which sits over the
 * bottom of the window and never goes away until answered), and the
 * application form embedded from Talentloom on a different origin, as ATS
 * embeds are. A requisition that is no longer open says so and lists the
 * roles that are.
 */
export function renderCareersJobPage(state: JobBoardState, context: RenderContext, slug: string, requisition: string): string | undefined {
  const company = companyBySlug(slug);
  if (!company) return undefined;
  const posting = POSTINGS.find((candidate) => candidate.apply.kind === "company" && candidate.apply.careersSlug === slug && candidate.apply.requisition === requisition);
  if (!posting) return undefined;
  const open = openCompanyPostings(state, company).includes(posting);
  const frameOrigin = context.alternateOrigin ?? "";
  const main = open
    ? `<p class="crumb"><a href="${CAREERS_ROOT}/${slug}">All open roles</a></p><h1>${escapeHtml(posting.title)}</h1><p class="where">${escapeHtml(posting.location)} · ${posting.jobType}</p>
${posting.description.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
<p><a class="jump" href="#application">Apply now</a></p>
<section id="application"><h2>Apply for this job</h2><iframe title="${APPLICATION_FRAME_TITLE}" src="${frameOrigin}${EMBED_ROOT}/job_app?for=${slug}&amp;token=${encodeURIComponent(requisition)}" scrolling="no"></iframe></section>`
    : `<h1>This position has been filled</h1><p>Thank you for your interest in ${escapeHtml(posting.title)}. We are no longer accepting applications for this role.</p>${rolesList(state, company)}`;
  return careersDocument(state, context, company, `${posting.title} · ${company.name} Careers`, main);
}

/** A company's list of open roles on its careers site. */
export function renderCareersIndex(state: JobBoardState, context: RenderContext, slug: string): string | undefined {
  const company = companyBySlug(slug);
  if (!company) return undefined;
  return careersDocument(state, context, company, `Careers at ${company.name}`, `<h1>Careers at ${escapeHtml(company.name)}</h1><p>${escapeHtml(company.about)}</p>${rolesList(state, company)}`);
}

function rolesList(state: JobBoardState, company: Company): string {
  const roles = openCompanyPostings(state, company);
  return `<h2>Open roles</h2><ul class="roles">${roles.map((posting) => posting.apply.kind === "company" ? `<li><a href="${CAREERS_ROOT}/${company.slug}/jobs/${posting.apply.requisition}">${escapeHtml(posting.title)}</a> <span>${escapeHtml(posting.location)}</span></li>` : "").join("")}</ul>`;
}

function careersDocument(state: JobBoardState, context: RenderContext, company: Company, title: string, main: string): string {
  const cookieBar = state.careersConsent ? "" : `<div class="cookies"><p>We use cookies to understand how people use our careers site and to improve it.</p><button type="button">Accept</button><button type="button">Decline</button></div>`;
  return `<!doctype html>
<html lang="en-GB">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>${escapeHtml(title)}</title>
<style>
body{margin:0;font:16px/1.6 Georgia,"Times New Roman",serif;color:#222;background:#fbfaf7}
header{display:flex;gap:28px;align-items:center;padding:18px 40px;background:#20233a;color:#f5f1e8}
header strong{font-size:22px;letter-spacing:.5px}header a{color:#f5f1e8}
main{max-width:860px;margin:0 auto;padding:28px 40px 200px}
.crumb{font-size:14px}.where{color:#555}
.jump{display:inline-block;background:#b45309;color:#fff;padding:10px 20px;border-radius:3px;text-decoration:none}
iframe{width:100%;height:1760px;border:1px solid #ddd;background:#fff}
.cookies{position:fixed;left:0;right:0;bottom:0;background:#20233a;color:#f5f1e8;padding:22px 40px;display:flex;gap:16px;align-items:center;z-index:10;min-height:120px}
.cookies p{flex:1;margin:0}.cookies button{font:inherit;padding:8px 18px;border:1px solid #f5f1e8;background:transparent;color:#f5f1e8;cursor:pointer}
.roles li{margin:6px 0}
</style></head>
<body>
<header><strong>${escapeHtml(company.name)}</strong><a href="${CAREERS_ROOT}/${company.slug}">Careers</a><a href="#">Life at ${escapeHtml(company.name)}</a><a href="#">Benefits</a></header>
<main>${main}</main>
${cookieBar}
<script type="module">
${fixtureClient(context.runToken, "job-board")}
const bar = document.querySelector('.cookies');
if (bar) bar.querySelectorAll('button').forEach((button) => button.addEventListener('click', async () => {
  try { await mutate('careers-consent'); } catch (error) { console.warn('cookie choice was not recorded', error); }
  bar.remove();
}));
</script>
</body>
</html>`;
}
