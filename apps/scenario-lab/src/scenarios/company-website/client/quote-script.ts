import type { QuoteDrawerIds } from "../pages/index.js";
import type { SiteClasses } from "../styles.js";

/** How long the human check spins before it offers its checkbox. */
export const HUMAN_CHECK_DELAY_MS = 2_200;

/**
 * The quote drawer's behaviour. Continue checks the step it is on and shows
 * the errors a real form shows; the service list opens on a click or Enter;
 * pressing the submit control starts a human check that spins, then asks for
 * a click, and only then posts. What the server says decides where the
 * visitor lands: with a reference, the confirmation for it; without one, the
 * generic thank-you a spam filter hides behind.
 */
export function quoteScript(ids: QuoteDrawerIds, c: SiteClasses, receivedPath: string): string {
  return `
const q = ${JSON.stringify(ids)};
const qc = ${JSON.stringify({ stepActive: c.stepActive, spinner: c.spinner, verifyCheck: c.verifyCheck, muted: c.muted, toast: c.toast })};
const byId = (id) => document.getElementById(id);
const drawer = byId(q.root);
const form = byId(q.form);
let step = 0;
function openQuote() { drawer.hidden = false; showStep(step); }
function closeQuote() { drawer.hidden = true; }
document.addEventListener('click', (event) => { if (event.target.closest('[data-open-quote]')) { event.preventDefault(); openQuote(); } });
byId(q.close).addEventListener('click', closeQuote);
drawer.firstElementChild.addEventListener('click', closeQuote);
if (location.hash === '#quote') openQuote();

function showStep(index) {
  step = index;
  q.steps.forEach((id, at) => { byId(id).hidden = at !== index; byId(q.dots[at]).classList.toggle(qc.stepActive, at <= index); });
  byId(q.back).disabled = index === 0;
  byId(q.next).hidden = index === 2;
  for (const id of [q.send, q.draft]) { const control = byId(id); if (control) control.hidden = index !== 2; }
}
function setError(name, message) { const slot = byId(q.errors[name]); if (slot) slot.textContent = message; return message === ''; }
function value(name) { const field = form.elements.namedItem(name); return field && 'value' in field ? String(field.value).trim() : ''; }
function checkStep(index) {
  if (index === 0) {
    const results = [
      setError('fullName', value('fullName') ? '' : 'Enter your full name'),
      setError('email', /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(value('email')) ? '' : 'Enter an email address like name@example.com'),
      setError('phone', value('phone').replace(/\\D/g, '').length >= 10 ? '' : 'Enter a UK phone number'),
      setError('postcode', /^[A-Za-z]{1,2}\\d[A-Za-z\\d]?\\s*\\d[A-Za-z]{2}$/.test(value('postcode')) ? '' : 'Enter a full postcode'),
    ];
    return results.every(Boolean);
  }
  if (index === 1) return setError('service', value('service') ? '' : 'Choose what you need');
  return setError('privacy', form.elements.namedItem('privacy').checked ? '' : 'Tick the box so we can contact you about this request');
}
byId(q.next).addEventListener('click', () => { if (checkStep(step)) showStep(step + 1); });
byId(q.back).addEventListener('click', () => { if (step > 0) showStep(step - 1); });

const select = byId(q.select);
const list = byId(q.list);
select.addEventListener('click', () => { list.hidden = !list.hidden; });
select.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); list.hidden = !list.hidden; } });
list.addEventListener('click', (event) => {
  const option = event.target.closest('[data-value]');
  if (!option) return;
  form.elements.namedItem('service').value = option.getAttribute('data-value');
  select.textContent = option.textContent;
  list.hidden = true;
  setError('service', '');
});

function startHumanCheck() {
  if (!checkStep(2)) return;
  const box = byId(q.verify);
  box.hidden = false;
  box.innerHTML = '<div><span class="' + qc.spinner + '"></span><p>Checking you are human&hellip;</p><p class="' + qc.muted + '">Protected by Shieldline</p></div>';
  setTimeout(() => {
    box.innerHTML = '<div><div class="' + qc.verifyCheck + '"><span style="width:1.2rem;height:1.2rem;border:2px solid #555;display:inline-block"></span> Confirm you are human</div><p class="' + qc.muted + '">Protected by Shieldline</p></div>';
    box.querySelector('.' + qc.verifyCheck).addEventListener('click', submitQuote, { once: true });
  }, ${HUMAN_CHECK_DELAY_MS});
}
async function submitQuote() {
  const contact = form.querySelector('input[name="contactBy"]:checked');
  const result = await mutate('submit-quote', {
    fullName: value('fullName'), email: value('email'), phone: value('phone'), postcode: value('postcode'),
    companyWebsite: form.elements.namedItem('companyWebsite').value,
    service: value('service'), details: value('details'), contactBy: contact ? contact.value : '',
    marketing: form.elements.namedItem('marketing').checked, privacy: form.elements.namedItem('privacy').checked, verified: true,
  });
  const reference = result && result.state && result.state.lastSubmission ? result.state.lastSubmission.reference : null;
  location.href = ${JSON.stringify(receivedPath)} + (reference ? '?ref=' + encodeURIComponent(reference) : '');
}
for (const id of [q.send, q.headerSend]) { const control = byId(id); if (control) control.addEventListener('click', startHumanCheck); }
const draft = byId(q.draft);
if (draft) draft.addEventListener('click', async () => {
  await mutate('save-quote-draft', {});
  closeQuote();
  const toast = document.createElement('div');
  toast.className = qc.toast;
  toast.setAttribute('role', 'status');
  toast.textContent = 'Saved. We will email you a link so you can finish your request later.';
  document.body.append(toast);
  setTimeout(() => toast.remove(), 5000);
});
`;
}
