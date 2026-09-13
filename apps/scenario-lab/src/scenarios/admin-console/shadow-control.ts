/**
 * `<fx-toggle>`: the settings switch, built inside an open shadow root.
 *
 * The control a person sees and clicks is the `<button role="switch">` in the
 * shadow tree; the element the document holds is the host. Everything a
 * recording would reach for -- the test id, the role, the accessible name -- is
 * on the inner button, where `document.querySelector` cannot see it and
 * `document.elementFromPoint` answers the host instead.
 *
 * The change leaves the component as a composed `fx-change` event rather than
 * as a bare click, the way a component library exposes state, so the page can
 * react without reaching into the shadow tree itself.
 */
export const shadowControlScript = `
class FxToggle extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    var checked = this.getAttribute('data-checked') === 'true';
    var root = this.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = ':host{display:inline-block}button{font:inherit;min-width:3.4rem;padding:.25rem .6rem;border:1px solid #ccd2d9;border-radius:999px;background:#fff;cursor:pointer}button[aria-checked="true"]{background:#2f5fd0;border-color:#2f5fd0;color:#fff}';
    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', checked ? 'true' : 'false');
    button.setAttribute('aria-label', SWITCH_LABEL);
    button.setAttribute('data-testid', this.getAttribute('data-control-testid') || 'toggle');
    button.textContent = checked ? 'On' : 'Off';
    var host = this;
    button.addEventListener('click', function () {
      var next = button.getAttribute('aria-checked') !== 'true';
      button.setAttribute('aria-checked', next ? 'true' : 'false');
      button.textContent = next ? 'On' : 'Off';
      host.setAttribute('data-checked', next ? 'true' : 'false');
      host.dispatchEvent(new CustomEvent('fx-change', {
        bubbles: true,
        composed: true,
        detail: { preference: host.getAttribute('data-pref'), checked: next }
      }));
    });
    root.append(style, button);
  }
}
customElements.define('fx-toggle', FxToggle);`;
