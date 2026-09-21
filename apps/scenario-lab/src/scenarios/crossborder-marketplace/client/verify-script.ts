/** The interstitial's check in the browser: press, wait two seconds, then load the address that was asked for. */
export function verifyScript(): string {
  return VERIFY;
}

const VERIFY = String.raw`
const check = document.querySelector('.' + css.verifyCheck);
let checking = false;
check.addEventListener('click', async () => {
  if (checking) return;
  checking = true;
  check.innerHTML = '<span class="' + css.spinner + '"></span><span>Checking your browser…</span>';
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await mutate('verify-human', {});
  check.innerHTML = '<span>✓ Verified. Taking you back…</span>';
  await new Promise((resolve) => setTimeout(resolve, 300));
  location.reload();
});
`;
