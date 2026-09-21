/** The browser side of the watchlist: Remove, a div, takes a listing off through the same rate-limited toggle as every heart. */
export function watchlistClientScript(): string {
  return String.raw`
for (const row of document.querySelectorAll('li[data-itemid]')) {
  byClass('divButton', row).addEventListener('click', async () => {
    const last = await toggleWatch(row.getAttribute('data-itemid'));
    if (last && last.outcome === 'removed') row.remove();
  });
}
`;
}
