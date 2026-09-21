/** The bot check: continue after five seconds, or at once on Continue, to the address the visitor asked for. */
export function challengeClientScript(returnTo: string): string {
  return `const returnTo = ${JSON.stringify(returnTo)};
let leaving = false;
async function proceed() {
  if (leaving) return;
  leaving = true;
  await mutate('pass-challenge');
  location.replace(returnTo);
}
document.querySelector('button').addEventListener('click', proceed);
setTimeout(proceed, 5000);
`;
}
