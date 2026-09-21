/**
 * The results feed and its filters, in the browser.
 *
 * - Scrolling: the feed asks for the next batch whenever the space under the
 *   last card comes within reach, with skeleton cards standing in while it
 *   waits. One batch per session fails the first time it is asked for. Its
 *   skeletons stay where they are, as if still loading, until the person
 *   presses Try again, a bare span, not a button, under them.
 * - Filters: each change rewrites the address with `pushState` and starts the
 *   feed over from its first batch. The count beside the heading is left as
 *   it was. Going back reloads the page at the address it returns to.
 * - The pause: when the server answers a new search with a check instead of
 *   listings, the feed shows "Checking your browser" over the results and asks
 *   again once the pause has cleared, by itself after a few seconds or at
 *   once when Continue is pressed.
 * - The end: after the last batch the server sends "Results outside your
 *   search", and the page appends it under the real results with nothing in
 *   between to say the real results are over.
 */
export const FEED_SCRIPT = String.raw`
(function feed() {
  const section = $('feed');
  if (!section) return;
  const grid = section.querySelector('.' + (cfg.feed.layout === 'grid' ? k.grid : k.list));
  const loadMore = $('loadMore', section);
  let params = new URLSearchParams(location.search);
  let nextBatch = cfg.feed.next;
  let loading = false;
  let blocked = false;
  let generation = 0;

  function feedUrl(batch) {
    const query = new URLSearchParams(params);
    query.set('surface', cfg.feed.surface);
    if (cfg.feed.category) query.set('category', cfg.feed.category);
    query.set('batch', String(batch));
    return root + 'feed.json?' + query;
  }
  function skeletons(show) {
    loadMore.innerHTML = show ? '<div class="' + n.skeleton + '"></div><div class="' + n.skeleton + '"></div><div class="' + n.skeleton + '"></div>' : '';
  }
  function clearTail() {
    for (const node of Array.from(section.children)) if (node !== grid && node !== loadMore) node.remove();
  }
  async function load(batch) {
    loading = true;
    const mine = generation;
    loadMore.hidden = false;
    skeletons(true);
    await delay(cfg.timing.feedLatency);
    const data = await (await fetch(feedUrl(batch), { headers: { accept: 'application/json' } })).json();
    if (mine !== generation) return;
    if (data.challenge) { challenge(() => load(batch)); return; }
    if (data.error) { failed(data.error, () => load(batch)); return; }
    skeletons(false);
    if (batch === 0) grid.innerHTML = data.html; else grid.insertAdjacentHTML('beforeend', data.html);
    nextBatch = data.next;
    loading = false;
    if (nextBatch === null) {
      loadMore.hidden = true;
      section.insertAdjacentHTML('beforeend', data.end);
      return;
    }
    requestAnimationFrame(check);
  }
  function failed(message, again) {
    blocked = true;
    const line = el('div', 'retry');
    line.innerHTML = '<span>' + esc(message) + '</span><span class="' + n.linkButton + '" tabindex="0">Try again</span>';
    loadMore.after(line);
    onActivate(line.lastElementChild, () => { line.remove(); blocked = false; again(); });
  }
  function challenge(again) {
    blocked = true;
    skeletons(false);
    const cover = el('div', 'challenge', { role: 'alert' });
    cover.innerHTML = '<div class="' + n.spinner + '"></div><strong>Checking your browser before you continue</strong><span>This usually takes a few seconds.</span><span class="' + n.buttonPlain + '" role="button" tabindex="0" hidden>Continue</span>';
    section.append(cover);
    const proceed = cover.lastElementChild;
    const mine = generation;
    let done = false;
    const clear = async () => {
      if (done) return;
      done = true;
      await mutate('pass-check', {});
      if (mine !== generation) return;
      cover.remove();
      blocked = false;
      again();
    };
    setTimeout(() => { proceed.hidden = false; }, 1000);
    setTimeout(clear, cfg.timing.checkWait);
    onActivate(proceed, clear);
  }
  function check() {
    if (loading || blocked || nextBatch === null) return;
    if (loadMore.getBoundingClientRect().top < innerHeight + 300) load(nextBatch);
  }
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check);
  requestAnimationFrame(check);

  function restart() {
    generation += 1;
    const path = cfg.feed.surface === 'home' ? root + 'browse/' : location.pathname;
    history.pushState(null, '', path + (params.toString() ? '?' + params : ''));
    grid.innerHTML = '';
    clearTail();
    blocked = false;
    nextBatch = 0;
    load(0);
  }
  addEventListener('popstate', () => location.reload());
  function set(name, value) { if (value === '' || value === null || value === undefined) params.delete(name); else params.set(name, value); restart(); }

  document.addEventListener('radiuschange', (event) => set('radius', event.detail.radius === 20 ? '' : String(event.detail.radius)));

  const combobox = $('combobox');
  if (!combobox) return;
  combobox.addEventListener('click', () => {
    const open = $('listbox', combobox.parentElement);
    if (open) { open.remove(); combobox.setAttribute('aria-expanded', 'false'); return; }
    const list = el('div', 'listbox', { role: 'listbox', id: cfg.ids.sortList });
    const current = params.get('sortBy') || 'best_match';
    list.innerHTML = cfg.sorts.map((option) => '<div class="' + n.option + '" role="option" aria-selected="' + (option.value === current) + '" tabindex="-1">' + esc(option.label) + '</div>').join('');
    combobox.parentElement.style.position = 'relative';
    combobox.after(list);
    combobox.setAttribute('aria-expanded', 'true');
    Array.from(list.children).forEach((option, index) => onActivate(option, () => {
      const chosen = cfg.sorts[index];
      combobox.textContent = chosen.label;
      combobox.setAttribute('aria-expanded', 'false');
      list.remove();
      set('sortBy', chosen.value === 'best_match' ? '' : chosen.value);
    }));
  });

  const [minBox, maxBox] = $$('priceInput');
  const priceChanged = (box, name) => {
    const value = box.value.replace(/[£,\s]/g, '');
    if (value !== '' && !/^\d{1,6}$/.test(value)) { toast('Enter a price in whole pounds.'); return; }
    if ((params.get(name) || '') === value) return;
    set(name, value);
  };
  for (const [box, name] of [[minBox, 'minPrice'], [maxBox, 'maxPrice']]) {
    box.addEventListener('change', () => priceChanged(box, name));
    box.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); priceChanged(box, name); } });
  }

  for (const toggle of $$('filterToggle')) {
    onActivate(toggle, () => {
      const panel = toggle.nextElementSibling;
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
    });
  }
  const conditionPanel = document.getElementById(cfg.ids.conditionPanel);
  for (const box of Array.from(conditionPanel.querySelectorAll('input[type="checkbox"]'))) {
    box.addEventListener('change', () => {
      const chosen = Array.from(conditionPanel.querySelectorAll('input:checked')).map((input) => input.value);
      set('itemCondition', chosen.join(','));
    });
  }
  const radioParams = [[cfg.ids.dateGroup, 'daysSinceListed', ''], [cfg.ids.availabilityGroup, 'availability', 'available'], [cfg.ids.deliveryGroup, 'deliveryMethod', 'all']];
  for (const [group, name, fallback] of radioParams) {
    for (const radio of Array.from(document.getElementsByName(group))) {
      radio.addEventListener('change', () => set(name, radio.value === fallback ? '' : radio.value));
    }
  }
})();
promptForNotifications();
`;
