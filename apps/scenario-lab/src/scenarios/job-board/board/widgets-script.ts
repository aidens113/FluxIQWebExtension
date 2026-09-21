/**
 * The two third-party widgets every Rolefinch page loads, as custom elements
 * with open shadow roots, the way consent platforms and chat vendors ship
 * them: their controls live inside the shadow tree, not in the page.
 *
 * - `rf-consent` covers the page with a scrim until the visitor answers it.
 *   While it is open the board ignores every click and key press made
 *   anywhere else (`client-script.ts`), so nothing behind it can be used.
 * - `rf-assistant` is a chat launcher that opens itself six seconds after the
 *   page loads, unless the visitor minimised it earlier in the visit, into a
 *   panel that covers the lower right of the window -- where the job pane's
 *   apply link and heart sit. Its minimise control is an unlabelled dash.
 *
 * Expects `CONFIG` and `mutate` in scope.
 */
export function boardWidgetsScript(): string {
  return `
class RfConsent extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>'
      + '[hidden]{display:none!important}'
      + ':host{position:fixed;inset:0;z-index:50;font:14px/1.45 "Segoe UI",system-ui,sans-serif}'
      + '.scrim{position:absolute;inset:0;background:#0006}'
      + '.bar{position:absolute;left:0;right:0;bottom:0;background:#fff;padding:22px 32px;box-shadow:0 -6px 24px #0003;display:flex;gap:28px;align-items:center}'
      + '.text{flex:1}.text h2{margin:0 0 6px;font-size:18px}.text p{margin:0;color:#374151}'
      + '.actions{display:flex;flex-direction:column;gap:8px;min-width:230px}'
      + 'button{font:inherit;border-radius:6px;padding:9px 14px;cursor:pointer;border:1px solid #0f766e;background:#fff;color:#0f766e;font-weight:600}'
      + 'button.primary{background:#0f766e;color:#fff}'
      + 'label{display:block;margin:4px 0}'
      + '</style>'
      + '<div class="scrim"></div>'
      + '<section class="bar"><div class="text"><h2>We value your privacy</h2>'
      + '<p>We and our 214 partners store and access information on your device, such as cookies, to personalise jobs and ads, measure how our site is used and improve our services. You can change your mind at any time from the footer.</p>'
      + '<div class="prefs" hidden><label><input type="checkbox" checked disabled> Strictly necessary</label><label><input type="checkbox"> Personalised jobs and ads</label><label><input type="checkbox"> Measurement</label></div></div>'
      + '<div class="actions"><button class="primary" data-choice="accepted">Accept all</button><button data-choice="rejected">Reject non-essential</button><button class="manage">Manage choices</button></div></section>';
    root.querySelectorAll('button[data-choice]').forEach((button) => button.addEventListener('click', () => this.answer(button.getAttribute('data-choice'))));
    root.querySelector('.manage').addEventListener('click', (event) => {
      const prefs = root.querySelector('.prefs');
      if (prefs.hidden) { prefs.hidden = false; event.currentTarget.textContent = 'Save my choices'; } else { this.answer('rejected'); }
    });
  }
  async answer(choice) {
    this.shadowRoot.querySelectorAll('button').forEach((button) => { button.disabled = true; });
    try { await mutate('consent', { choice }); } catch (error) { console.warn('consent was not recorded', error); }
    this.remove();
    window.dispatchEvent(new CustomEvent('rf-consent-answered'));
  }
}
customElements.define('rf-consent', RfConsent);

class RfAssistant extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>'
      + '[hidden]{display:none!important}'
      + ':host{position:fixed;right:16px;bottom:16px;z-index:25;font:14px/1.45 "Segoe UI",system-ui,sans-serif}'
      + '.bubble{width:58px;height:58px;border-radius:50%;background:#0f766e;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 18px #0004}'
      + '.bubble svg{width:28px;height:28px;fill:#fff}'
      + '.panel{width:380px;height:min(74vh,560px);background:#fff;border-radius:14px;box-shadow:0 10px 40px #0005;display:flex;flex-direction:column;overflow:hidden}'
      + '.fa-head{background:#0f766e;color:#fff;padding:14px 16px;display:flex;align-items:center;gap:8px}'
      + '.fa-head span{opacity:.85;font-size:12px}.fa-min{margin-left:auto;cursor:pointer;font-size:22px;line-height:1;padding:0 6px}'
      + '.fa-log{flex:1;padding:14px;overflow:auto;background:#f7f8fa}.fa-log p{background:#fff;border-radius:10px;padding:9px 12px;margin:0 0 10px;border:1px solid #e3e6ec}'
      + '.fa-input{display:flex;border-top:1px solid #e3e6ec}.fa-input input{flex:1;border:0;padding:12px;font:inherit}.fa-send{padding:12px;color:#0f766e;cursor:pointer}'
      + '</style>'
      + '<div class="bubble"><svg viewBox="0 0 24 24"><path d="M4 4h16v12H7l-3 3z"/></svg></div>'
      + '<div class="panel" hidden><div class="fa-head"><strong>Finch</strong><span>Rolefinch assistant</span><div class="fa-min">\\u2013</div></div>'
      + '<div class="fa-log"><p>Hi there! I\\'m Finch. I can help you find jobs like the ones you\\'re looking at.</p><p>Tip: create a job alert and we\\'ll email you new matches every morning.</p><p>Want me to set one up for you?</p></div>'
      + '<div class="fa-input"><input placeholder="Ask Finch anything"><div class="fa-send">Send</div></div></div>';
    const bubble = root.querySelector('.bubble');
    const panel = root.querySelector('.panel');
    const open = () => { bubble.hidden = true; panel.hidden = false; };
    bubble.addEventListener('click', open);
    root.querySelector('.fa-min').addEventListener('click', async () => {
      try { await mutate('minimise-chat'); } catch (error) { console.warn('chat state was not recorded', error); }
      panel.hidden = true; bubble.hidden = false;
    });
    root.querySelector('.fa-send').addEventListener('click', () => {
      const input = root.querySelector('.fa-input input');
      if (!input.value.trim()) return;
      const reply = document.createElement('p');
      reply.textContent = 'Thanks! One of our team will get back to you by email within two working days.';
      root.querySelector('.fa-log').appendChild(reply);
      input.value = '';
    });
    if (!CONFIG.chatMinimised) setTimeout(open, 6000);
  }
}
customElements.define('rf-assistant', RfAssistant);
`;
}
