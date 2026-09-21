/**
 * The Talentloom form's behaviour: the location lookup, the manual CV entry,
 * the answer pills, validation, and Talentloom Shield -- the "checking you
 * are a person" step every first submission passes through, which clears
 * three seconds later on a press of "I'm a person". While the shield is up,
 * any click outside it is ignored.
 *
 * Once stored, the page moves to the confirmation the ATS names in its
 * activity log; a refused submission leaves the form where it is with an
 * error. Expects `mutate` in scope.
 */
export function formScript(jobKey: string): string {
  return `
const JOB_KEY = ${JSON.stringify(jobKey)};
const form = document.querySelector('form');
const field = (name) => form.elements.namedItem(name);
const shield = document.querySelector('.tl-shield');
const locationInput = field('location_text');
const locationId = field('location_id');
const suggest = document.querySelector('.tl-suggest');
const fileInput = field('resume');
let lookupTimer = 0;
let shieldPassed = false;
let sending = false;

document.addEventListener('click', (event) => {
  if (!shield.hidden && !shield.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);

function renderPlaces(places) {
  suggest.textContent = '';
  places.forEach((place) => {
    const option = document.createElement('div');
    option.className = 'tl-option';
    option.textContent = place.label;
    option.addEventListener('mousedown', (event) => event.preventDefault());
    option.addEventListener('click', () => { locationInput.value = place.label; locationId.value = place.id; suggest.hidden = true; });
    suggest.appendChild(option);
  });
  suggest.hidden = places.length === 0;
}
locationInput.addEventListener('input', () => {
  locationId.value = '';
  clearTimeout(lookupTimer);
  const query = locationInput.value.trim();
  if (query.length < 2) { suggest.hidden = true; return; }
  lookupTimer = setTimeout(async () => {
    try {
      const response = await fetch('places?q=' + encodeURIComponent(query));
      if (!response.ok) throw new Error('lookup answered ' + response.status);
      renderPlaces(await response.json());
    } catch (error) { console.warn('location lookup failed', error); }
  }, 300);
});
locationInput.addEventListener('blur', () => setTimeout(() => { suggest.hidden = true; }, 200));

document.querySelector('.tl-manual').addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelector('.tl-resume').hidden = true;
  field('resume_text').hidden = false;
  field('resume_text').focus();
});
document.querySelector('.tl-attach').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { document.querySelector('.tl-filename').textContent = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : ''; });

document.querySelectorAll('.tl-toggle').forEach((group) => {
  const answer = group.parentElement.querySelector('input[type=hidden]');
  group.querySelectorAll('.tl-opt').forEach((option) => option.addEventListener('click', () => {
    group.querySelectorAll('.tl-opt').forEach((other) => other.classList.remove('tl-on'));
    option.classList.add('tl-on');
    answer.value = option.textContent.trim().toLowerCase();
  }));
});

function validate() {
  const problems = [];
  const need = (name, message) => { if (!String(field(name).value).trim()) problems.push([name, message]); };
  need('first_name', 'Enter your first name.');
  need('last_name', 'Enter your last name.');
  if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(field('email').value.trim())) problems.push(['email', 'Enter a valid email address.']);
  if (!locationId.value) problems.push(['location_text', 'Choose your location from the list.']);
  if (!field('resume_text').value.trim() && !(fileInput.files && fileInput.files.length)) problems.push(['resume', 'Attach your CV or enter it manually.']);
  if (!field('right_to_work').value) problems.push(['right_to_work', 'Answer this question.']);
  need('sponsorship', 'Answer this question.');
  need('notice', 'Answer this question.');
  const salary = field('salary_expectation').value.trim();
  if (!salary) problems.push(['salary_expectation', 'Enter your expected salary.']);
  else if (!/^\\d+$/.test(salary)) problems.push(['salary_expectation', 'Enter your expected salary as a whole number, without commas or currency symbols.']);
  need('source', 'Tell us how you heard about this job.');
  if (!field('privacy').checked) problems.push(['privacy', 'You must accept the candidate privacy notice.']);
  return problems;
}
function showProblems(problems) {
  document.querySelectorAll('.tl-error').forEach((note) => note.remove());
  document.querySelector('.tl-errors').textContent = problems.length ? 'Please fix ' + problems.length + ' problem' + (problems.length === 1 ? '' : 's') + ' before submitting.' : '';
  problems.forEach(([name, message]) => {
    const control = field(name);
    const row = control && control.closest ? (control.closest('.tl-row') || control.closest('.tl-check')) : null;
    if (!row) return;
    const note = document.createElement('p');
    note.className = 'tl-error';
    note.textContent = message;
    row.appendChild(note);
  });
}
function runShield() {
  const button = shield.querySelector('button');
  shield.hidden = false;
  button.disabled = true;
  let left = 3;
  button.textContent = 'Please wait ' + left;
  const tick = () => {
    left -= 1;
    if (left <= 0) { button.disabled = false; button.textContent = "I'm a person"; return; }
    button.textContent = 'Please wait ' + left;
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
}
shield.querySelector('button').addEventListener('click', () => { shield.hidden = true; shieldPassed = true; send(); });

async function send() {
  sending = true;
  const submit = form.querySelector('button[type=submit]');
  submit.disabled = true;
  submit.textContent = 'Submitting...';
  const payload = {
    jobKey: JOB_KEY,
    firstName: field('first_name').value,
    lastName: field('last_name').value,
    email: field('email').value,
    phoneCountry: field('phone_country').value,
    phoneNumber: field('phone').value,
    placeId: locationId.value,
    resumeText: field('resume_text').value,
    resumeFile: fileInput.files && fileInput.files[0] ? fileInput.files[0].name : '',
    website: field('website').value,
    rightToWork: field('right_to_work').value,
    sponsorship: field('sponsorship').value,
    notice: field('notice').value,
    salary: field('salary_expectation').value,
    source: field('source').value,
    talentPool: field('talent_pool').checked,
    privacy: field('privacy').checked,
    confirmEmail: field('confirm_email').value,
  };
  let stored = null;
  try {
    const snapshot = await mutate('submit-application', payload);
    const activity = snapshot.state.activity;
    stored = /^application (app-\\d+)/.exec(activity[activity.length - 1] || '');
  } catch (error) { console.warn('application was not sent', error); }
  if (stored) { location.assign('confirmation?app=' + stored[1]); return; }
  sending = false;
  submit.disabled = false;
  submit.textContent = 'Submit application';
  document.querySelector('.tl-errors').textContent = "We couldn't submit your application. Please check your answers and try again.";
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (sending) return;
  const problems = validate();
  showProblems(problems);
  if (problems.length) return;
  if (!shieldPassed) { runShield(); return; }
  send();
});
`;
}
