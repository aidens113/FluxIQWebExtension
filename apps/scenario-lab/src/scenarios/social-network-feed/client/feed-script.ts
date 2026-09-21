/** How long the first batch takes to replace the skeleton after the page loads, and how long each later batch takes to arrive. */
export const FEED_DELAYS = { firstMs: 700, nextMs: 350 } as const;

/** How close to the bottom of the screen the end of the feed has to come before the next batch is fetched. */
export const LOAD_AHEAD_PX = 600;

/**
 * The home feed's loader.
 *
 * The page arrives with three grey skeleton cards and no posts. Seven hundred
 * milliseconds later the first five units replace them. After that, a batch of
 * five is fetched only when the end of the feed comes within 600 pixels of the
 * bottom of the screen, and while it is on its way two skeleton cards stand in
 * for it. When the batch that finishes the new posts arrives, the "You're all
 * caught up" marker goes in after it, and scrolling on brings suggested posts,
 * until "No more posts to show right now".
 */
export function feedScript(): string {
  return `const FEED_DELAYS = ${JSON.stringify(FEED_DELAYS)};
const LOAD_AHEAD_PX = ${LOAD_AHEAD_PX};
${FEED}`;
}

const FEED = String.raw`
const feed = document.querySelector('[role="feed"]');
const sentinel = document.createElement('div');
sentinel.className = C.sentinel;
sentinel.setAttribute('aria-hidden', 'true');
feed.after(sentinel);
let nextCursor = 0;
let loading = false;
let finished = false;
function skeletonHtml() {
  return '<div class="' + C.skeleton + '" aria-hidden="true"><div class="' + C.skeletonLine + '" style="width:45%"></div><div class="' + C.skeletonLine + '" style="width:90%"></div><div class="' + C.skeletonLine + '" style="width:70%"></div></div>';
}
async function loadBatch() {
  if (loading || finished) return;
  loading = true;
  feed.setAttribute('aria-busy', 'true');
  const placeholders = nextCursor === 0 ? qa('skeleton', feed) : fromHtml(skeletonHtml() + skeletonHtml());
  if (nextCursor !== 0) placeholders.forEach((node) => feed.appendChild(node));
  const [response] = await Promise.all([fetch(CFG.root + 'feed/?cursor=' + nextCursor), wait(nextCursor === 0 ? FEED_DELAYS.firstMs : FEED_DELAYS.nextMs)]);
  const batch = await response.json();
  placeholders.forEach((node) => node.remove());
  Object.assign(CFG.texts, batch.texts);
  for (const node of fromHtml(batch.html)) feed.appendChild(node);
  if (batch.caughtUp) {
    for (const node of fromHtml('<div class="' + C.caughtUp + '"><h2 class="' + C.heading + '">You\'re all caught up</h2><p class="' + C.muted + '" style="margin:4px 0 0">You\'ve seen all new posts from the past 7 days.</p></div><h2 class="' + C.heading + '" style="padding:8px 4px 0">Suggested posts</h2>')) feed.appendChild(node);
  }
  if (batch.next === null) {
    finished = true;
    sentinel.remove();
    feed.after(fromHtml('<div class="' + C.endNote + '">No more posts to show right now.</div>')[0]);
  } else {
    nextCursor = batch.next;
  }
  feed.setAttribute('aria-busy', 'false');
  loading = false;
  loadIfNear();
}
function loadIfNear() {
  if (!finished && !loading && sentinel.getBoundingClientRect().top < window.innerHeight + LOAD_AHEAD_PX) loadBatch();
}
window.addEventListener('scroll', loadIfNear, { passive: true });
loadBatch();
`;
