/**
 * The in-place pager (`in-place-paging`) in the browser: what the people
 * page's script adds when that rendering is armed. `refresh(page)` asks the
 * results endpoint for `page` after the same 0.7 seconds a page change takes,
 * and then rewrites what is on screen into it the way a keyless virtual-DOM
 * render does: each element already there is kept where the new page has an
 * element of the same kind in the same place, and only its attributes and
 * text change; whatever has no counterpart is added or removed. The rows, their
 * links and the pager's buttons are therefore the same nodes before and after,
 * and the address bar is left where it was. A security-check answer is shown
 * the way the baseline page shows it.
 *
 * It runs inside the people page's script and uses its `attempt`, `results`,
 * `QUERY`, `listHref`, `challenge`, `cards` and `current`.
 */
export function inPlacePagingScript(): string {
  return IN_PLACE;
}

const IN_PLACE = String.raw`
function syncAttributes(old, fresh) {
  for (const { name } of [...old.attributes]) if (!fresh.hasAttribute(name)) old.removeAttribute(name);
  for (const { name, value } of [...fresh.attributes]) if (old.getAttribute(name) !== value) old.setAttribute(name, value);
}
function morph(into, from) {
  const have = [...into.childNodes];
  const want = [...from.childNodes];
  want.forEach((node, index) => {
    const old = have[index];
    if (!old) into.append(node.cloneNode(true));
    else if (old.nodeType !== node.nodeType || old.nodeName !== node.nodeName) old.replaceWith(node.cloneNode(true));
    else if (node.nodeType === Node.ELEMENT_NODE) { syncAttributes(old, node); morph(old, node); }
    else if (old.nodeValue !== node.nodeValue) old.nodeValue = node.nodeValue;
  });
  have.slice(want.length).forEach((node) => node.remove());
}
async function refresh(page) {
  const mine = ++attempt;
  await new Promise((resolve) => setTimeout(resolve, 700));
  if (mine !== attempt) return;
  const response = await fetch(listHref({ ...QUERY, page }, true), { headers: { accept: 'application/json' } });
  const body = await response.json();
  if (mine !== attempt) return;
  if (response.status === 429) { results.innerHTML = body.html; return challenge(page, body.retryAfter); }
  const fresh = document.createElement('section');
  fresh.innerHTML = body.html;
  morph(results, fresh);
  cards = body.cards;
  current = page;
}
`;
