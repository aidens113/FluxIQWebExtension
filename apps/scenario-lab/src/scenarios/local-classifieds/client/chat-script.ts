/**
 * The chat window, on listing pages only.
 *
 * On the first listing page of a session a reply from Alex Rowe, about a road
 * bike the account asked after last week, pops open in the bottom-right corner
 * a moment after the page settles, which puts it over the listing's message
 * box and Make offer. A press anywhere on it lands on the chat and puts the
 * cursor in its reply box; nothing under it is reached.
 *
 * Its two header controls are as shipped: "Close chat" is named, the
 * minimise control is a bare dash with no name at all. Minimised, it shrinks
 * to a bar that still sits over the right-hand end of the action bar; closed,
 * it stays closed for the rest of the session. The server remembers which.
 */
export const CHAT_SCRIPT = String.raw`
(function chat() {
  const thread = [
    ['mine', 'Hi, is the road bike still available?'],
    ['theirs', 'Yes it is!'],
    ['mine', 'Would you take £180?'],
    ['theirs', 'Still keen on the road bike? I could do £200 if you collect this week.'],
  ];
  function show(minimised) {
    const dock = el('div', 'chatDock', { role: 'dialog', 'aria-labelledby': cfg.ids.chatTitle });
    if (minimised) dock.dataset.minimised = '';
    dock.innerHTML = '<div class="' + n.chatHead + '"><div class="' + n.avatar + '">AR</div>'
      + '<div class="' + n.chatName + '" id="' + cfg.ids.chatTitle + '">Alex Rowe<br><small>Road bike, 52cm, 18-speed</small></div>'
      + '<div class="' + n.chatControl + '" role="button" tabindex="0">&ndash;</div>'
      + '<div class="' + n.chatControl + '" role="button" tabindex="0" aria-label="Close chat">&times;</div></div>'
      + '<div class="' + n.chatBody + '">' + thread.map(([who, text]) => '<div class="' + n.chatBubble + (who === 'mine' ? ' ' + n.chatBubbleMine : '') + '">' + esc(text) + '</div>').join('') + '</div>'
      + '<div class="' + n.chatInput + '" role="textbox" contenteditable="true" aria-label="Message">Aa</div>';
    document.body.append(dock);
    const [minimise, close] = $$('chatControl', dock);
    const input = $('chatInput', dock);
    dock.addEventListener('click', (event) => {
      if (event.target === minimise || event.target === close) return;
      if ('minimised' in dock.dataset) { delete dock.dataset.minimised; mutate('chat', { state: 'open' }); return; }
      input.focus();
    });
    onActivate(minimise, (event) => {
      event.stopPropagation();
      if ('minimised' in dock.dataset) return;
      dock.dataset.minimised = '';
      mutate('chat', { state: 'minimised' });
    });
    onActivate(close, (event) => {
      event.stopPropagation();
      dock.remove();
      mutate('chat', { state: 'closed' });
    });
  }
  if (cfg.session.chat === 'open') show(false);
  else if (cfg.session.chat === 'minimised') show(true);
  else if (cfg.session.chat === 'unopened') settled.then(() => delay(cfg.timing.chatDelay)).then(() => { show(false); mutate('chat', { state: 'open' }); });
})();
`;
