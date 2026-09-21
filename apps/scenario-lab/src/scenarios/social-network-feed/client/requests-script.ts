/**
 * Friend requests: Confirm and Delete on each card, and the site's limit on
 * how fast Confirm may be pressed.
 *
 * The limit is a rolling window (`CONFIRM_RATE_LIMIT`). A press over it is
 * refused with a "You're going too fast" dialog that counts down to the moment
 * the window frees up. OK closes it and confirms nothing. When the count
 * reaches zero a "Try again" button appears beside OK, and it confirms the
 * request the refused press was for. So the limit is passed by waiting, and by
 * nothing else.
 *
 * A confirmed card keeps its place and its mutual-friends line, swaps its
 * buttons for "Request accepted" and a Message link, and says so again after a
 * reload; a deleted card says "Request removed".
 */
export const REQUESTS_SCRIPT = String.raw`
const confirmedAt = [];
function withinLimit(now) {
  while (confirmedAt.length && now - confirmedAt[0] >= CFG.rate.windowMs) confirmedAt.shift();
  return confirmedAt.length < CFG.rate.max;
}
function requestIdOf(card) {
  const link = card.querySelector('a[href*="/people/"]:not([aria-hidden])');
  const match = link && /\/people\/([^/]+)\//.exec(link.getAttribute('href') || '');
  return match ? CFG.requests[match[1]] : undefined;
}
async function answer(card, operation) {
  const id = requestIdOf(card);
  if (!id) return;
  await mutate(operation, { id });
  const actions = q('requestActions', card);
  const slug = /\/people\/([^/]+)\//.exec(card.querySelector('a[href*="/people/"]:not([aria-hidden])').getAttribute('href'))[1];
  for (const button of Array.from(actions.querySelectorAll('[role="button"]'))) button.remove();
  const status = operation === 'confirm-request'
    ? '<div class="' + C.requestStatus + '">Request accepted</div><a class="' + C.secondaryButton + '" href="' + CFG.root + 'messages/t/' + slug + '/">Message</a>'
    : '<div class="' + C.requestStatus + '">Request removed</div>';
  for (const node of fromHtml(status)) actions.appendChild(node);
}
function tooFast(card) {
  mutate('rate-limited', {});
  const retryAt = confirmedAt[0] + CFG.rate.windowMs;
  const scrim = mount(dialogHtml('You\'re going too fast', '<p style="margin:0">It looks like you were misusing this feature by going too fast. You\'ve been temporarily blocked from using it.</p><p class="' + C.muted + '" style="margin:0">You can try again in <span>' + Math.ceil((retryAt - Date.now()) / 1000) + '</span> seconds.</p>', '<div class="' + C.secondaryButton + '" role="button" tabindex="0">OK</div>', { role: 'alertdialog' }));
  const counter = scrim.querySelector('p span');
  onPress(q('secondaryButton', scrim), () => { clearInterval(timer); scrim.remove(); });
  const timer = setInterval(() => {
    const left = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
    counter.textContent = String(left);
    if (left > 0) return;
    clearInterval(timer);
    const [retry] = fromHtml('<div class="' + C.primaryButton + '" role="button" tabindex="0" aria-label="Try again">Try again</div>');
    q('dialogFoot', scrim).appendChild(retry);
    onPress(retry, () => { scrim.remove(); pressConfirm(card); });
  }, 250);
}
function pressConfirm(card) {
  const now = Date.now();
  if (!withinLimit(now)) { tooFast(card); return; }
  confirmedAt.push(now);
  answer(card, 'confirm-request');
}
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const button = target && target.closest('[role="button"]');
  const card = button && button.closest('.' + cls('requestCard'));
  if (!card || !button.closest('.' + cls('requestActions'))) return;
  const label = button.getAttribute('aria-label');
  if (label === 'Confirm') pressConfirm(card);
  else if (label === 'Delete') answer(card, 'delete-request');
});
`;
