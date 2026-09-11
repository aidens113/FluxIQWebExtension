import { fixtureClient } from "../../html.js";

/**
 * Browser behaviour for the keyboard-forms page. No handler reads
 * `isTrusted`, as real widgets do not. The profile form has no key handler:
 * Enter in a text field submits it only through native implicit submission,
 * or through an emulation of it. The combobox opens on keydown, filters on
 * every `input` event, and consumes Enter (`preventDefault`) when it chooses.
 * Mutations run one at a time so status lines never show an older response.
 */
export function keyboardFormsClientScript(runToken: string): string {
  return `${fixtureClient(runToken, "keyboard-forms")}
const byTestId = id => document.querySelector('[data-testid="' + id + '"]');
const statusTargets = { profile: 'profile-status', emailUpdates: 'email-updates-status', contactMethod: 'contact-method-status', country: 'country-status' };
let pending = Promise.resolve();
function save(operation, payload) {
  pending = pending.then(() => mutate(operation, payload)).then(snapshot => {
    for (const [key, testId] of Object.entries(statusTargets)) byTestId(testId).textContent = snapshot.state.status[key];
  }).catch(error => console.error(error));
  return pending;
}

byTestId('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  const submitter = event.submitter ? event.submitter.dataset.testid ?? null : null;
  save('save-profile', { displayName: byTestId('display-name').value, submitter });
});
byTestId('email-updates').addEventListener('change', event => save('set-email-updates', { enabled: event.target.checked }));
byTestId('contact-method').addEventListener('change', event => {
  if (event.target.name === 'contactMethod' && event.target.checked) save('set-contact-method', { method: event.target.value });
});

const combobox = byTestId('country');
const listbox = byTestId('country-listbox');
const options = [...listbox.querySelectorAll('[role="option"]')];
let active = null;
const shownOptions = () => options.filter(option => !option.hidden);
function highlight(option) {
  active = option;
  for (const candidate of options) candidate.setAttribute('aria-selected', String(candidate === option));
  if (option) combobox.setAttribute('aria-activedescendant', option.id);
  else combobox.removeAttribute('aria-activedescendant');
}
function openListbox() {
  if (shownOptions().length === 0) return false;
  listbox.hidden = false;
  combobox.setAttribute('aria-expanded', 'true');
  return true;
}
function closeListbox() {
  listbox.hidden = true;
  combobox.setAttribute('aria-expanded', 'false');
  highlight(null);
}
function applyFilter() {
  const prefix = combobox.value.trim().toLowerCase();
  for (const option of options) option.hidden = !option.textContent.toLowerCase().startsWith(prefix);
  highlight(null);
  if (shownOptions().length === 0) closeListbox();
}
function moveHighlight(step) {
  const shown = shownOptions();
  if (listbox.hidden) {
    if (openListbox()) highlight(step > 0 ? shown[0] : shown[shown.length - 1]);
    return;
  }
  const index = shown.indexOf(active);
  highlight(shown[index === -1 ? (step > 0 ? 0 : shown.length - 1) : (index + step + shown.length) % shown.length]);
}
function choose(option) {
  combobox.value = option.textContent;
  closeListbox();
  save('choose-country', { code: option.dataset.value });
}
combobox.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
  } else if (event.key === 'Enter' && !listbox.hidden && active) {
    event.preventDefault();
    choose(active);
  } else if (event.key === 'Escape' && !listbox.hidden) {
    event.preventDefault();
    closeListbox();
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    openListbox();
  }
});
combobox.addEventListener('input', applyFilter);
combobox.addEventListener('blur', closeListbox);
listbox.addEventListener('mousedown', event => event.preventDefault());
listbox.addEventListener('click', event => {
  const option = event.target.closest('[role="option"]');
  if (option && !option.hidden) choose(option);
});`;
}
