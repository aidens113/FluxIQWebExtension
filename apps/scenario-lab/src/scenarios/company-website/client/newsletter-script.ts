/**
 * The newsletter page's form and its "Unsubscribe" buttons. Each posts to the
 * server and reloads the page, which lists the addresses the list now holds.
 */
export function newsletterScript(): string {
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
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-unsubscribe]');
  if (!button) return;
  await mutate('unsubscribe-newsletter', { email: button.getAttribute('data-unsubscribe') });
  location.reload();
});
`;
}
