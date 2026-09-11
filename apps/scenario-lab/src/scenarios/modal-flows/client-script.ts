import { fixtureClient } from "../../html.js";
import { pageLogic } from "./page-logic.js";
import type { ModalFlowsState } from "./state.js";

/** `pageLogic` as a script expression, so the page formats and validates exactly as the server does. */
const PAGE_LOGIC_SOURCE = `{\n${Object.entries(pageLogic).map(([name, logic]) => `  ${name}: ${logic.toString()}`).join(",\n")}\n}`;

/** The native confirm() text guarding Delete draft, for the Phase 1.2 dialog action. */
const DELETE_PROMPT = "Delete this draft? This cannot be undone.";

/**
 * The page script. Mutations are serialised in click order. The invite
 * dialog and the offer are modal: the page shell goes inert, Tab cycles
 * inside the dialog, and focus returns to the opener on close. While the
 * offer is open every page handler returns early, and the reducer ignores
 * page operations too.
 */
export function modalFlowsClientScript(runToken: string, state: ModalFlowsState): string {
  return `${fixtureClient(runToken, "modal-flows")}
const logic = ${PAGE_LOGIC_SOURCE};
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
const byTestId = (id) => document.querySelector('[data-testid="' + id + '"]');
const shell = byTestId('page-shell');
const opener = byTestId('open-invite');
const inviteBackdrop = byTestId('invite-backdrop');
const inviteDialog = byTestId('invite-dialog');
const inviteForm = byTestId('invite-form');
const inviteEmail = byTestId('invite-email');
const inviteError = byTestId('invite-error');
const banner = byTestId('consent-banner');
const addSection = byTestId('add-section');
const deleteDraft = byTestId('delete-draft');
let interstitial = ${JSON.stringify(state.interstitial)};
let activeDialog = null;
let returnFocusTo = null;
let queue = Promise.resolve();

function send(operation, payload = {}) {
  const result = queue.then(() => mutate(operation, payload));
  queue = result.catch(() => undefined);
  return result;
}
const blocked = () => interstitial === 'open';

function openDialog(backdrop, returnTo) {
  returnFocusTo = returnTo;
  backdrop.hidden = false;
  shell.inert = true;
  activeDialog = backdrop.querySelector('[role="dialog"]');
  activeDialog.querySelector(FOCUSABLE)?.focus();
}
function closeDialog(backdrop) {
  if (backdrop.dataset.testid === 'interstitial-backdrop') backdrop.remove(); else backdrop.hidden = true;
  activeDialog = null;
  shell.inert = false;
  returnFocusTo?.focus();
  returnFocusTo = null;
}
document.addEventListener('keydown', (event) => {
  if (!activeDialog) return;
  if (event.key === 'Escape' && activeDialog === inviteDialog) { event.preventDefault(); void cancelInvite(); return; }
  if (event.key !== 'Tab') return;
  const items = [...activeDialog.querySelectorAll(FOCUSABLE)];
  const first = items[0];
  const last = items[items.length - 1];
  if (!first) return;
  const outside = !activeDialog.contains(document.activeElement);
  if (event.shiftKey && (outside || document.activeElement === first)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (outside || document.activeElement === last)) { event.preventDefault(); first.focus(); }
});

function resetInvite() {
  inviteForm.reset();
  inviteError.textContent = '';
  inviteEmail.removeAttribute('aria-invalid');
}
async function cancelInvite() {
  closeDialog(inviteBackdrop);
  resetInvite();
  await send('cancel-invite');
}
opener.addEventListener('click', () => { if (!blocked()) openDialog(inviteBackdrop, opener); });
byTestId('invite-cancel').addEventListener('click', () => { void cancelInvite(); });
inviteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = inviteEmail.value.trim();
  if (!logic.isInviteEmail(email)) {
    inviteError.textContent = 'Enter a valid email address.';
    inviteEmail.setAttribute('aria-invalid', 'true');
    inviteEmail.focus();
    return;
  }
  const role = byTestId('invite-role').value;
  closeDialog(inviteBackdrop);
  resetInvite();
  const snapshot = await send('send-invite', { email, role });
  byTestId('invite-result').textContent = logic.inviteResult(snapshot.state.invites.at(-1));
});

async function decideConsent(operation) {
  if (blocked()) return;
  banner.remove();
  await send(operation);
}
if (banner) {
  byTestId('consent-accept').addEventListener('click', () => { void decideConsent('accept-cookies'); });
  byTestId('consent-reject').addEventListener('click', () => { void decideConsent('reject-cookies'); });
}

byTestId('publish-draft').addEventListener('click', async () => {
  if (blocked()) return;
  const snapshot = await send('publish');
  byTestId('publish-result').textContent = logic.publishResult(snapshot.state.publishCount);
});

function showSections(count) {
  byTestId('section-count').textContent = logic.sectionCount(count);
  byTestId('section-list').replaceChildren(...Array.from({ length: count }, (_, index) => {
    const item = document.createElement('li');
    item.dataset.testid = 'section-item';
    item.textContent = logic.sectionTitle(index + 1);
    return item;
  }));
}
function openInterstitial(backdrop, returnTo) {
  interstitial = 'open';
  backdrop.querySelector('[data-testid="interstitial-close"]').addEventListener('click', async () => {
    interstitial = 'closed';
    closeDialog(backdrop);
    await send('close-interstitial');
  });
  openDialog(backdrop, returnTo);
}
addSection.addEventListener('click', async () => {
  if (blocked()) return;
  // Armed: the offer shows before this add is sent, so the next click already meets it.
  if (interstitial === 'armed') {
    document.body.append(document.getElementById('interstitial-template').content.cloneNode(true));
    openInterstitial(byTestId('interstitial-backdrop'), addSection);
  }
  const snapshot = await send('add-section');
  showSections(snapshot.state.sectionCount);
});
if (interstitial === 'open') openInterstitial(byTestId('interstitial-backdrop'), null);

deleteDraft.addEventListener('click', async () => {
  if (blocked()) return;
  const confirmed = window.confirm(${JSON.stringify(DELETE_PROMPT)});
  const snapshot = await send('delete-draft', { confirmed });
  byTestId('draft-status').textContent = logic.draftStatus(snapshot.state.draft);
  deleteDraft.disabled = snapshot.state.draft === 'deleted';
});`;
}
