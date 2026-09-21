/**
 * Saved items, in the browser: the sort select reorders the rows where they
 * stand, and each row's unnamed-looking "···" opens a one-item menu that
 * removes it. The total above the list follows removals; the sidebar badge
 * does not.
 */
export const SAVED_SCRIPT = String.raw`
(function saved() {
  const list = $('savedList');
  if (!list) return;
  const original = Array.from(list.children);
  const priceOf = (row) => { const text = $('savedPrice', row).textContent.trim(); return text === 'Free' ? 0 : Number(text.replace(/[^0-9]/g, '')); };
  const select = document.getElementById(cfg.ids.savedSort);
  select.addEventListener('change', () => {
    const rows = original.filter((row) => row.isConnected);
    const ordered = select.value === 'recent' ? rows : rows.slice().sort((left, right) => select.value === 'price_ascend' ? priceOf(left) - priceOf(right) : priceOf(right) - priceOf(left));
    list.replaceChildren(...ordered);
  });
  for (const row of original) {
    const more = $('chatControl', row);
    onActivate(more, () => {
      const existing = row.querySelector('[role="menu"]');
      if (existing) { existing.remove(); return; }
      const menu = el('div', 'listbox', { role: 'menu' });
      menu.innerHTML = '<div class="' + n.option + '" role="menuitem" tabindex="-1">Remove from saved items</div>';
      row.style.position = 'relative';
      row.append(menu);
      onActivate(menu.firstElementChild, async () => {
        const id = $('savedTitle', row).getAttribute('href').split('/').filter(Boolean).pop();
        await mutate('save', { listingId: id, saved: false });
        row.remove();
        const left = list.children.length;
        document.querySelector('[data-testid="marketplace_saved_total"]').textContent = left + ' saved item' + (left === 1 ? '' : 's');
      });
    });
  }
})();
`;
