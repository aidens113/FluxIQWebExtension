/**
 * How the "A few more questions" section behaves, the way a real ATS's
 * longer form does:
 *
 * - the count of people who report to you refuses any key but digits' own;
 * - the hours a day the hiring team fixed are put straight back on any edit,
 *   and the assessment day refuses edits before they land;
 * - the referral code and the agency reference came with the link the
 *   candidate followed: an edit is put back, the referral code once the site
 *   has looked it up (a short timer), the agency reference straight after the
 *   change (a microtask), each with a note saying so;
 * - the profile widget behind "Preferred name" (on each keystroke) and
 *   "Days a week you could be in the office" (on change) re-renders its field
 *   as a new element holding the saved answer, so an edit does not stick;
 * - changing "Current employer" opens a dialog over the whole form offering
 *   to hide the application from that employer. Focus stays where it was.
 *
 * Appended to `formScript`, whose `form` and `field` it uses.
 */
export function extendedQuestionsScript(): string {
  return `
field('reports_count').addEventListener('keydown', (event) => {
  if (['.', ',', 'e', 'E', '+', '-'].includes(event.key)) event.preventDefault();
});
const fixedHours = field('hours_per_day');
fixedHours.addEventListener('input', () => { fixedHours.value = fixedHours.defaultValue; });
field('assessment_day').addEventListener('beforeinput', (event) => event.preventDefault());

function keepLinkedCode(name, message, schedule) {
  const code = field(name);
  const note = code.closest('.tl-row').querySelector('.tl-note');
  code.addEventListener('change', () => {
    if (code.value === code.defaultValue) return;
    schedule(() => {
      code.value = code.defaultValue;
      note.textContent = message;
    });
  });
}
keepLinkedCode('referral_code', 'This code came with the referral link you followed, so it stays as it is.', (restore) => setTimeout(restore, 10));
keepLinkedCode('agency_reference', 'Your agency set this reference. Ask them if it needs to change.', (restore) => queueMicrotask(restore));

function rerenderFromProfile(control, eventName) {
  control.addEventListener(eventName, () => {
    if (!control.isConnected) return;
    const rendered = control.cloneNode();
    rendered.value = control.defaultValue;
    control.replaceWith(rendered);
    rerenderFromProfile(rendered, eventName);
  });
}
rerenderFromProfile(field('preferred_name'), 'input');
rerenderFromProfile(field('office_days'), 'change');

function offerToHide(employer) {
  if (document.querySelector('.tl-hide')) return;
  const dialog = document.createElement('div');
  dialog.className = 'tl-hide';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'tl-hide-title');
  const card = document.createElement('div');
  const title = document.createElement('h2');
  title.id = 'tl-hide-title';
  title.textContent = 'Hide this application from ' + employer + '?';
  const body = document.createElement('p');
  body.textContent = 'Talentloom can make sure recruiters at your current employer never see this application or your profile.';
  const choose = (label, answer) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      field('hide_from_employer').value = answer;
      dialog.remove();
    });
    return button;
  };
  card.append(title, body, choose('Hide it from them', 'yes'), choose('No thanks', 'no'));
  dialog.append(card);
  document.body.append(dialog);
}
const employerField = field('current_employer');
employerField.addEventListener('change', () => {
  const employer = employerField.value.trim();
  if (employer) setTimeout(() => offerToHide(employer), 10);
});
`;
}
