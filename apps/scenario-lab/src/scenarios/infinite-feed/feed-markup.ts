import { escapeHtml, fixtureClient, page } from "../../html.js";
import type { RenderContext } from "../../types.js";
import { FEED_PAGE_SIZE, feedPageItems, type FeedItem } from "./feed-content.js";

/** Fixed height plus gap of one post card, so one page of posts is exactly `FEED_PAGE_HEIGHT_PX` tall. */
const FEED_ITEM_PITCH_PX = 160;
const FEED_ITEM_GAP_PX = 8;
/** Simulated network latency of a page load; a fixed constant, never randomised. */
const FEED_LOAD_DELAY_MS = 300;

/**
 * Height one appended page adds to the document. It exceeds any test
 * viewport (720px), so after a load the sentinel leaves the viewport and one
 * scroll that reaches the bottom triggers exactly one load.
 */
export const FEED_PAGE_HEIGHT_PX = FEED_ITEM_PITCH_PX * FEED_PAGE_SIZE;

const styles = `<style>
  .feed-page { display: flow-root; }
  .feed-item { box-sizing: border-box; height: ${FEED_ITEM_PITCH_PX - FEED_ITEM_GAP_PX}px; margin: 0 0 ${FEED_ITEM_GAP_PX}px; padding: .5rem .75rem; overflow: hidden; border: 1px solid #d0d7de; border-radius: 8px; }
  .feed-item h2 { font-size: 1.05rem; margin: 0 0 .25rem; }
  .feed-item p { margin: .25rem 0; }
  .feed-byline { color: #57606a; font-size: .9rem; }
  .feed-sentinel { height: 1px; }
</style>`;

/** One page of posts as the HTML fragment the feed appends; `data-last-page` tells the client the feed has ended. */
export function renderFeedPage(seed: number, pageNumber: number, feedLength: number): string {
  const lastPage = pageNumber * FEED_PAGE_SIZE >= feedLength;
  const items = feedPageItems(seed, pageNumber, feedLength).map(renderFeedItem).join("");
  return `<div class="feed-page" data-testid="feed-page-${pageNumber}" data-page="${pageNumber}" data-last-page="${lastPage}">${items}</div>`;
}

/** The start document: the first page, the sentinel the client observes, the loading indicator, and the end-of-feed marker. */
export function renderFeedDocument(feedLength: number, context: RenderContext): string {
  const body = `${styles}<main>
    <h1>Neighbourhood feed</h1>
    <p>Posts from the community board. More posts load as you scroll.</p>
    <p data-testid="feed-status" aria-live="polite"></p>
    <div role="feed" aria-label="Community posts" aria-busy="false" data-testid="feed">${renderFeedPage(context.seed, 1, feedLength)}</div>
    <div class="feed-sentinel" data-testid="feed-sentinel" aria-hidden="true"></div>
    <p data-testid="feed-loading" role="status" hidden>Loading more posts...</p>
    <p data-testid="feed-end" hidden>You're all caught up. There are no more posts.</p>
  </main>`;
  return page("Neighbourhood feed", body, `${fixtureClient(context.runToken, "infinite-feed")}\n${feedClient}`);
}

function renderFeedItem(item: FeedItem): string {
  const titleId = `${item.id}-title`;
  const shown = `${item.published.slice(0, 10)} ${item.published.slice(11, 16)} UTC`;
  return `<article class="feed-item" data-testid="feed-item" data-item-id="${item.id}" aria-posinset="${item.position}" aria-setsize="-1" aria-labelledby="${titleId}">
      <h2 id="${titleId}" data-testid="feed-item-title">${escapeHtml(item.title)}</h2>
      <p class="feed-byline"><span data-testid="feed-item-author">${escapeHtml(item.author)}</span> - <time data-testid="feed-item-time" datetime="${item.published}">${shown}</time></p>
      <p data-testid="feed-item-summary">${escapeHtml(item.summary)}</p>
    </article>`;
}

// Opens a feed session through `mutate`, then appends the next page each
// time the sentinel scrolls into view. Pages come from the scenario's own
// route, which records the load in the fixture state before responding.
const feedClient = `const feed = document.querySelector('[data-testid="feed"]');
const sentinel = document.querySelector('[data-testid="feed-sentinel"]');
const loading = document.querySelector('[data-testid="feed-loading"]');
const end = document.querySelector('[data-testid="feed-end"]');
const status = document.querySelector('[data-testid="feed-status"]');
let pages = feed.querySelectorAll('.feed-page').length;
let ended = feed.lastElementChild.dataset.lastPage === 'true';
let busy = false;
function showStatus() {
  const count = feed.querySelectorAll('[data-testid="feed-item"]').length;
  status.textContent = (ended ? 'Showing all ' : 'Showing ') + count + ' posts';
}
function finish() {
  observer.disconnect();
  sentinel.remove();
  end.hidden = false;
}
async function loadNextPage() {
  busy = true;
  feed.setAttribute('aria-busy', 'true');
  loading.hidden = false;
  await new Promise(resolve => setTimeout(resolve, ${FEED_LOAD_DELAY_MS}));
  const response = await fetch('/scenarios/infinite-feed/page/' + (pages + 1));
  if (!response.ok) throw new Error('Feed page request failed: ' + response.status);
  const template = document.createElement('template');
  template.innerHTML = (await response.text()).trim();
  const next = template.content.firstElementChild;
  feed.append(next);
  pages += 1;
  ended = next.dataset.lastPage === 'true';
  loading.hidden = true;
  feed.setAttribute('aria-busy', 'false');
  if (ended) finish();
  showStatus();
  busy = false;
}
const observer = new IntersectionObserver(entries => {
  if (busy || ended || !entries.some(entry => entry.isIntersecting)) return;
  void loadNextPage();
});
await mutate('open');
showStatus();
if (ended) finish(); else observer.observe(sentinel);`;
