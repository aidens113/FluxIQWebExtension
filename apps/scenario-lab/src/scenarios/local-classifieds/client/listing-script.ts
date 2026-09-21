/**
 * The listing page, in the browser.
 *
 * - The details arrive after a delay from the listing's data address and
 *   replace the skeleton; nothing in the panel can be pressed before then.
 * - Save toggles: pressed again, it unsaves. The sidebar's Saved count is
 *   never updated here.
 * - Make offer opens a dialog whose amount box already holds the asking price,
 *   so typing without clearing it asks for a different number. The dialog
 *   carries a honeypot field off-screen. An offer is answered by the receipt
 *   under the button, which the server words, and by Buying's count.
 * - The message box above Make offer comes ready-written: "Hi, is this still
 *   available?". Pressing Send sends it, and an offer made within the rate
 *   limit's interval after that is refused with how long to wait; the dialog
 *   stays open so it can be sent again.
 */
export const LISTING_SCRIPT = String.raw`
(function listing() {
  const panel = $('pdpPanel');
  const item = cfg.listing;
  const detailUrl = root + 'item/' + item.id + '/';

  async function refreshReceipt() {
    const data = await (await fetch(detailUrl + 'receipt.json')).json();
    const bar = $('stickyBar');
    let receipt = bar && bar.querySelector('[data-testid="marketplace_offer_receipt"]');
    if (data.receipt !== null && bar) {
      if (!receipt) { receipt = el('div', 'receipt', { 'data-testid': 'marketplace_offer_receipt' }); bar.append(receipt); }
      receipt.textContent = data.receipt;
    }
    const buying = document.querySelector('[data-testid="marketplace_buying_count"]');
    if (buying) buying.textContent = String(data.buying);
  }

  async function toggleSave(control, pressedText, unpressedText) {
    if (control.dataset.busy) return;
    control.dataset.busy = '1';
    const want = control.getAttribute('aria-pressed') !== 'true';
    try {
      const snapshot = await mutate('save', { listingId: item.id, saved: want });
      const saved = snapshot.state.saved.includes(item.id);
      control.setAttribute('aria-pressed', String(saved));
      if (pressedText) control.textContent = saved ? pressedText : unpressedText;
      toast(saved ? 'Saved to your list' : 'Removed from saved items');
    } finally {
      delete control.dataset.busy;
    }
  }

  const heart = $('heart');
  if (heart) onActivate(heart, () => toggleSave(heart));

  let refused = cfg.session.refusedContacts;
  /** Whether a message or offer just sent was refused by the rate limit; says so, with how long to wait, when it was. */
  function refusedNow(snapshot) {
    if (snapshot.state.refusedContacts <= refused) return false;
    refused = snapshot.state.refusedContacts;
    const last = snapshot.state.contactLog[snapshot.state.contactLog.length - 1];
    const seconds = Math.max(1, Math.ceil((last + cfg.timing.contactInterval - Date.now()) / 1000));
    toast("You're sending messages too quickly. Try again in " + seconds + ' second' + (seconds === 1 ? '' : 's') + '.');
    return true;
  }

  function openOffer() {
    const scrim = el('div', 'scrim');
    const dialog = el('div', 'dialog', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': cfg.ids.offerTitle });
    dialog.innerHTML = '<h2 class="' + n.dialogTitle + '" id="' + cfg.ids.offerTitle + '">Make an offer</h2>'
      + '<div class="' + n.closeX + '" role="button" tabindex="0" aria-label="Close">&times;</div>'
      + '<div class="' + n.dialogBody + '">'
      + '<p>Asking price ' + esc(item.priceText) + '. ' + esc(item.sellerFirst) + ' will see your offer in their Marketplace inbox.</p>'
      + '<label for="' + cfg.ids.offerAmount + '">Your offer</label>'
      + '<div class="' + n.offerRow + '"><span aria-hidden="true">£</span><input class="' + n.offerInput + '" id="' + cfg.ids.offerAmount + '" inputmode="numeric" autocomplete="off" value="' + item.price + '"></div>'
      + '<div class="' + n.honeypot + '" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>'
      + '<label for="' + cfg.ids.offerNote + '">Add a message (optional)</label>'
      + '<textarea class="' + n.textarea + '" id="' + cfg.ids.offerNote + '" rows="3"></textarea>'
      + '<p class="' + n.fieldError + '" role="alert" hidden></p>'
      + '</div>'
      + '<div class="' + n.dialogFoot + '"><div class="' + n.buttonPlain + '" role="button" tabindex="0">Cancel</div><div class="' + n.buttonPrimary + '" role="button" tabindex="0">Send offer</div></div>';
    scrim.append(dialog);
    document.body.append(scrim);
    const amountBox = document.getElementById(cfg.ids.offerAmount);
    const error = $('fieldError', dialog);
    const close = () => scrim.remove();
    onActivate($('closeX', dialog), close);
    onActivate(byText(dialog, 'buttonPlain', 'Cancel'), close);
    let sending = false;
    onActivate(byText(dialog, 'buttonPrimary', 'Send offer'), async () => {
      if (sending) return;
      const raw = amountBox.value.replace(/[£,\s]/g, '');
      const amount = Number(raw);
      if (!/^\d+$/.test(raw) || amount < 1 || amount > item.price * 2) {
        error.textContent = 'Enter an amount between £1 and £' + (item.price * 2) + '.';
        error.hidden = false;
        return;
      }
      sending = true;
      const note = document.getElementById(cfg.ids.offerNote).value;
      const website = dialog.querySelector('input[name="website"]').value;
      const snapshot = await mutate('send-offer', { listingId: item.id, amount, note, website });
      sending = false;
      if (refusedNow(snapshot)) return;
      close();
      toast('Offer sent');
      await refreshReceipt();
    });
  }

  function wire() {
    const seeMore = $('seeMore');
    if (seeMore) onActivate(seeMore, () => { seeMore.previousElementSibling.hidden = false; seeMore.remove(); });
    const save = panel.querySelector('[data-testid="marketplace_pdp_save"]');
    if (save) onActivate(save, () => toggleSave(save, 'Saved', 'Save'));
    const actions = $('pdpActions');
    const hide = byText(actions, 'actionButton', 'Hide');
    if (hide) onActivate(hide, async () => { await mutate('hide', { listingId: item.id }); toast("Listing hidden. You won't see it in your feed."); });
    onActivate(byText(actions, 'actionButton', 'Share'), () => toast('Link copied to clipboard'));
    onActivate($('actionPrimary', actions), () => { const box = $('messageInput'); if (box) box.focus(); });
    const send = $('sendButton');
    if (send) {
      onActivate(send, async () => {
        const text = $('messageInput').value.trim();
        if (!text) return;
        const company = $('messageBox').querySelector('input[name="company"]').value;
        const snapshot = await mutate('send-message', { listingId: item.id, text, website: company });
        if (refusedNow(snapshot)) return;
        toast('Message sent to ' + item.sellerName);
        await refreshReceipt();
      });
    }
    const offer = $('offerButton');
    if (offer) onActivate(offer, openOffer);
  }

  setTimeout(async () => {
    const data = await (await fetch(detailUrl + 'detail.json')).json();
    panel.innerHTML = data.html;
    panel.removeAttribute('aria-busy');
    wire();
  }, cfg.timing.detailDelay);
})();
`;
