/**
 * A conversation's composer.
 *
 * "Send" appears once the message box holds text; Enter sends too. What goes
 * to the server is the box's text and whatever the hidden field holds, and the
 * server decides: a filled hidden field blocks the account, and the "Action
 * Blocked" notice says so. A message the server accepts shows at once; the
 * reply it drew shows after the other side's typing indicator.
 */
export const DIRECT_SCRIPT = String.raw`
const TYPING_MS = 1800;
const form = document.querySelector('.' + H.dmComposer);
const box = form && form.querySelector('[contenteditable]');
const sendButton = form && Array.from(form.querySelectorAll('[role="button"]')).find((control) => textOf(control) === 'Send');
const thread = FL.page.thread;
const messageArea = document.querySelector('.' + H.conversation + ' > div');
let shown = FL.page.sent || 0;

function syncSend() { const empty = box.textContent.trim() === ''; sendButton.hidden = empty; }

async function send() {
  const text = box.innerText.trim();
  if (text === '') return;
  const trap = form.querySelector('input[name="subject"]').value;
  const state = await act('send-message', { thread, text, trap });
  if (state.blocked) {
    const shade = scrim('<div class="' + C.dialog + '" role="alertdialog" aria-modal="true"><div class="' + C.dialogBody + '" style="text-align:center"><h2 style="margin:0">Action Blocked</h2><p>We restrict certain activity to protect our community. Tell us if you think we made a mistake.</p><div role="button" tabindex="0" class="' + C.secondary + '">Tell us</div><div role="button" tabindex="0" class="' + C.secondary + '">OK</div></div></div>');
    shade.addEventListener('click', (event) => { if (event.target.closest('[role="button"]')) shade.remove(); });
    return;
  }
  box.textContent = '';
  syncSend();
  const response = await fetch(ROOT + 'direct/t/' + thread + '/messages?from=' + shown);
  const fresh = await response.json();
  shown += fresh.length;
  for (const message of fresh) {
    if (message.mine) { messageArea.insertAdjacentHTML('beforeend', message.html); continue; }
    const typing = el('<div class="' + C.typing + '">' + esc(thread) + ' is typing…</div>');
    messageArea.appendChild(typing);
    await wait(TYPING_MS);
    typing.remove();
    messageArea.insertAdjacentHTML('beforeend', message.html);
  }
}

if (form) {
  box.addEventListener('input', syncSend);
  box.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } });
  sendButton.addEventListener('click', send);
  form.addEventListener('submit', (event) => event.preventDefault());
}
`;
