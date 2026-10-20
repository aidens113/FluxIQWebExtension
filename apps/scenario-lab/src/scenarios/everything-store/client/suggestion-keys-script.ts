/**
 * The search box's keyboard handling under `keyboard-suggestions`, appended
 * to the shared shell script (`shell-script.ts`), whose `SHELL`, `IDS` and
 * suggestion list it builds on. The header draws the box as a combobox that
 * owns the list (`pages/header.ts`).
 *
 * - Every time the list is rebuilt, each suggestion gets an id and nothing is
 *   highlighted.
 * - ArrowDown and ArrowUp move the highlight, wrapping at either end, and the
 *   box names the highlighted suggestion in `aria-activedescendant`. The page
 *   cancels both keys, so the caret stays where it was.
 * - Enter on a highlighted suggestion puts it in the box and closes the list,
 *   and the page cancels it: the shopper gets to add to the words before
 *   searching. Enter with nothing highlighted is left to the form, which
 *   searches as it always did.
 * - Escape, which the shell already answers by closing the list, forgets the
 *   highlight with it; `aria-expanded` follows the list however it closes.
 */
export const SUGGESTION_KEYS_BODY = String.raw`
{
  const box = document.getElementById(IDS.searchInput);
  const list = document.getElementById(IDS.suggest);
  if (box && list && box.getAttribute('role') === 'combobox') {
    let active = -1;
    const options = () => [...list.querySelectorAll('[role="option"]')];
    const highlight = (index) => {
      active = index;
      const all = options();
      all.forEach((option, at) => option.setAttribute('aria-selected', String(at === index)));
      if (all[index]) box.setAttribute('aria-activedescendant', all[index].id);
      else box.removeAttribute('aria-activedescendant');
    };
    const follow = () => {
      const open = !list.hidden && options().length > 0;
      box.setAttribute('aria-expanded', String(open));
      if (!open && active >= 0) highlight(-1);
    };
    box.addEventListener('input', () => {
      options().forEach((option, at) => { option.id = IDS.suggest + '-option-' + at; option.setAttribute('aria-selected', 'false'); });
      highlight(-1);
      follow();
    });
    new MutationObserver(follow).observe(list, { attributes: true, attributeFilter: ['hidden'], childList: true });
    box.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { highlight(-1); return; }
      const all = options();
      if (list.hidden || all.length === 0) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        highlight(active < 0 ? (step > 0 ? 0 : all.length - 1) : (active + step + all.length) % all.length);
      } else if (event.key === 'Enter' && active >= 0) {
        event.preventDefault();
        box.value = all[active].textContent;
        list.hidden = true;
        list.replaceChildren();
        highlight(-1);
        follow();
      }
    });
  }
}
`;
