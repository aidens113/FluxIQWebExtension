/** What the browser's confirmation asks before an address leaves the list, when `confirm-unsubscribe` is armed. */
export const UNSUBSCRIBE_CONFIRM_TEXT = "Unsubscribe from Kestrel Lane offers and reminders? Your 10% code will stop working.";

/**
 * The newsletter page's form and its "Unsubscribe" buttons. Each posts to the
 * server and reloads the page, which lists the addresses the list now holds.
 *
 * With `confirmUnsubscribe`, "Unsubscribe" asks `window.confirm` first. A yes
 * posts the unsubscribe and takes the row off the page where it stands, with
 * a status line saying so; a no posts only the answer and leaves the page as
 * it was.
 */
export function newsletterScript(confirmUnsubscribe = false): string {
  return `
const newsletterForm = document.querySelector('[data-newsletter-form]');
newsletterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = newsletterForm.querySelector('input[name="email"]').value.trim();
  const error = newsletterForm.querySelector('[data-newsletter-error]');
  const at = email.indexOf('@');
  if (at < 1 || email.indexOf('.', at) < at + 2 || email.endsWith('.') || email.includes(' ')) { error.textContent = 'Enter a valid email address.'; return; }
  error.textContent = '';
  await mutate('subscribe-newsletter', { email });
  location.reload();
});
const confirmUnsubscribe = ${JSON.stringify(confirmUnsubscribe)};
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-unsubscribe]');
  if (!button) return;
  const email = button.getAttribute('data-unsubscribe');
  if (!confirmUnsubscribe) {
    await mutate('unsubscribe-newsletter', { email });
    location.reload();
    return;
  }
  if (!window.confirm(${JSON.stringify(UNSUBSCRIBE_CONFIRM_TEXT)})) {
    await mutate('unsubscribe-declined', { email });
    return;
  }
  await mutate('unsubscribe-newsletter', { email });
  const row = button.closest('tr');
  const status = document.querySelector('[data-unsubscribe-status]');
  if (status) status.textContent = 'Unsubscribed. We will not email ' + email + ' again.';
  if (row) row.remove();
});
`;
}
