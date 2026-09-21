import { STORE_TIMINGS } from "./timings.js";

/**
 * The browser check's script. Its button reads "Checking your browser..." and
 * is disabled until `softCheckButton`; then it reads "Continue shopping" and
 * passes the check. A shopper who simply waits is passed at `softCheckAuto`.
 * Either way the page reloads onto what was asked for.
 */
export function softCheckScript(): string {
  return `const SOFT = ${JSON.stringify({ timings: STORE_TIMINGS })};
${SOFT_BODY}`;
}

const SOFT_BODY = String.raw`
const proceed = document.querySelector('[data-continue]');
let passing = false;
async function pass() {
  if (passing) return;
  passing = true;
  await mutate('pass-soft-check', {});
  location.reload();
}
setTimeout(() => { proceed.disabled = false; proceed.textContent = 'Continue shopping'; }, SOFT.timings.softCheckButton);
proceed.addEventListener('click', pass);
setTimeout(pass, SOFT.timings.softCheckAuto);
`;
