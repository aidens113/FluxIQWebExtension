/**
 * `<kf-location>`: the location and radius picker, a web component with an
 * open shadow root, as a design system ships a self-contained widget.
 *
 * Its chip reads "Kelford · Within 20 mi". Pressing it opens a small panel
 * with the radius select and Apply. Apply carries a bug the shipped widget
 * has: changing the select re-renders the panel's footer, so the first press
 * of Apply after a change lands on a button that has just been replaced and
 * does nothing; the second press applies. Applying closes the panel, rewrites
 * the chip and announces the radius to the page with a `radiuschange` event
 * that crosses the shadow boundary.
 *
 * The class names inside the shadow root come from the same build as the
 * page's (`cfg.shadow`), so they too change with the seed.
 */
export const LOCATION_ELEMENT_SCRIPT = String.raw`
class KerbfindLocation extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const s = cfg.shadow;
    const shadow = this.attachShadow({ mode: 'open' });
    const radius = Number(this.getAttribute('radius') || 20);
    const place = this.getAttribute('place') || 'Kelford';
    const options = cfg.radii.map((value) => '<option value="' + value + '"' + (value === radius ? ' selected' : '') + '>' + value + (value === 1 ? ' mile' : ' miles') + '</option>').join('');
    shadow.innerHTML = '<style>:host{position:relative;display:inline-block}'
      + '.' + s.chip + '{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:18px;background:#e4e6eb;font:600 14px "Segoe UI",sans-serif;cursor:pointer}'
      + '.' + s.pop + '{position:absolute;z-index:50;margin-top:6px;width:260px;padding:14px;border-radius:8px;background:#fff;box-shadow:0 12px 28px rgba(0,0,0,.25);font:14px "Segoe UI",sans-serif}'
      + '.' + s.row + '{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}'
      + '.' + s.btn + '{padding:7px 12px;border-radius:6px;background:#e4e6eb;font-weight:600;cursor:pointer}'
      + '.' + s.primary + '{background:#0866ff;color:#fff}'
      + 'label{display:block;margin:8px 0 4px;font-weight:600} select,input{width:100%;box-sizing:border-box;padding:7px;border:1px solid #ced0d4;border-radius:6px}'
      + '[hidden]{display:none}</style>'
      + '<div class="' + s.chip + '" role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false"></div>'
      + '<div class="' + s.pop + '" role="dialog" aria-label="Change location" hidden>'
      + '<label>Location<input value="' + place + '" readonly></label>'
      + '<label for="' + cfg.ids.radiusSelect + '">Radius</label><select id="' + cfg.ids.radiusSelect + '">' + options + '</select>'
      + '<div class="' + s.row + '"><div class="' + s.btn + '" role="button" tabindex="0">Cancel</div><div class="' + s.btn + ' ' + s.primary + '" role="button" tabindex="0">Apply</div></div>'
      + '</div>';
    const chip = shadow.querySelector('.' + s.chip);
    const pop = shadow.querySelector('.' + s.pop);
    const select = shadow.querySelector('select');
    const row = shadow.querySelector('.' + s.row);
    let current = radius;
    let changed = false;
    const label = () => { chip.textContent = place + ' · Within ' + current + ' mi'; };
    const open = (value) => { pop.hidden = !value; chip.setAttribute('aria-expanded', String(value)); };
    const activate = (node, handler) => {
      node.addEventListener('click', handler);
      node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handler(event); } });
    };
    const wireApply = () => {
      const apply = row.lastElementChild;
      activate(apply, () => {
        if (changed) {
          changed = false;
          apply.replaceWith(apply.cloneNode(true));
          wireApply();
          return;
        }
        current = Number(select.value);
        this.setAttribute('radius', String(current));
        label();
        open(false);
        this.dispatchEvent(new CustomEvent('radiuschange', { detail: { radius: current }, bubbles: true, composed: true }));
      });
    };
    label();
    activate(chip, () => open(pop.hidden));
    activate(row.firstElementChild, () => { select.value = String(current); changed = false; open(false); });
    select.addEventListener('change', () => { changed = true; });
    wireApply();
    this.addEventListener('kf-open', () => open(true));
  }
}
customElements.define('kf-location', KerbfindLocation);
`;
