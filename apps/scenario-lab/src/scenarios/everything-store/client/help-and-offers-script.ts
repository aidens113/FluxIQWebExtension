/**
 * The cart's "Help and offers" area under `help-and-offers`, appended to the
 * cart script (`cart-script.ts`), whose `CART.css` it reads. Each piece was
 * built by a different team, and each behaves as it shipped:
 *
 * - The help topics are links to their panels; the script cancels each and
 *   shows its panel in place, leaving the address alone.
 * - A delivery question opens its answer. The list scrolls inside a box whose
 *   "Still need help?" bar is pinned along the bottom, over the last question.
 * - The lightning deal, shown only for a cart holding the descaler, counts
 *   down in tenths of a second, in two places: the sentence is rewritten
 *   whole, the timer's text is changed in place.
 * - "Claim deal" was meant to open a sheet that never shipped. A press styles
 *   it and leaves a ripple inside it; the click itself is cancelled.
 * - A deals filter marks itself current and, a moment later, rewrites the
 *   count beside the strip; nothing else on the page changes.
 * - The promo's "See terms" handler cancels the link; the popover it opened
 *   was taken down and the handler stayed.
 * - The also-viewed pager raises its busy flag and waits for a page the
 *   widget's service never sends.
 */
export const HELP_AND_OFFERS_BODY = String.raw`
{
  const panels = [...document.querySelectorAll('[data-help-panel]')];
  for (const tab of document.querySelectorAll('[data-help-tab]')) {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      const wanted = tab.getAttribute('href').slice(1);
      for (const panel of panels) panel.hidden = panel.id !== wanted;
    });
  }
  for (const question of document.querySelectorAll('[data-faq]')) {
    question.addEventListener('click', () => {
      const open = question.getAttribute('aria-expanded') !== 'true';
      question.setAttribute('aria-expanded', String(open));
      question.nextElementSibling.hidden = !open;
    });
  }
  const clock = document.querySelector('[data-deal-clock]');
  const claim = document.querySelector('[data-claim-deal]');
  if (clock && claim) {
    const timer = document.querySelector('[data-deal-timer]').firstChild;
    let tenths = 14 * 600 + 599;
    const shown = () => Math.floor(tenths / 600) + ':' + String(Math.floor(tenths % 600 / 10)).padStart(2, '0') + '.' + (tenths % 10);
    setInterval(() => {
      tenths = tenths > 0 ? tenths - 1 : 0;
      clock.textContent = 'Ends in ' + shown();
      timer.data = shown();
    }, 100);
    claim.addEventListener('mousedown', () => {
      claim.classList.add(CART.css.pressed);
      const ripple = document.createElement('span');
      ripple.className = CART.css.ripple;
      claim.append(ripple);
    });
    claim.addEventListener('mouseup', () => claim.classList.remove(CART.css.pressed));
    claim.addEventListener('click', (event) => event.preventDefault());
  }
  const count = document.querySelector('[data-deal-count]').firstChild;
  const dealCounts = { home: 3, electronics: 5, office: 4 };
  const filters = [...document.querySelectorAll('[data-deal-filter]')];
  for (const filter of filters) {
    filter.addEventListener('click', (event) => {
      event.preventDefault();
      for (const other of filters) {
        if (other !== filter && other.hasAttribute('aria-current')) other.removeAttribute('aria-current');
      }
      filter.setAttribute('aria-current', 'true');
      const department = new URL(filter.href).searchParams.get('dept');
      setTimeout(() => {
        count.data = dealCounts[department] + ' deals in ' + filter.textContent;
      }, 120);
    });
  }
  document.querySelector('[data-promo-terms]').addEventListener('click', (event) => event.preventDefault());
  const alsoViewed = document.querySelector('[data-also-viewed]');
  document.querySelector('[data-viewed-page]').addEventListener('click', (event) => {
    event.preventDefault();
    alsoViewed.setAttribute('aria-busy', 'true');
  });
}
`;
