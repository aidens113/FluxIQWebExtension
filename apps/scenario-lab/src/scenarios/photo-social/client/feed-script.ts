/**
 * The home feed's infinite scroll: near the bottom, a skeleton card, then the
 * next screen of posts; after the last screen, the "all caught up" marker.
 */
export const FEED_SCRIPT = String.raw`
const feedList = document.querySelector('.' + H.feed + ' section > div:nth-of-type(2)');
let feedPage = 1;
let feedBusy = false;

async function loadFeed() {
  if (!feedList || feedBusy || feedPage >= FL.page.pages) return;
  feedBusy = true;
  const skeleton = el('<div class="' + C.card + '"><div class="' + C.skeleton + '" style="width:40%"></div><div class="' + C.skeleton + '" style="aspect-ratio:1"></div><div class="' + C.skeleton + '" style="width:70%"></div></div>');
  feedList.appendChild(skeleton);
  const [response] = await Promise.all([fetch(ROOT + 'feed?page=' + feedPage), wait(500)]);
  skeleton.remove();
  feedList.insertAdjacentHTML('beforeend', await response.text());
  feedPage += 1;
  if (feedPage >= FL.page.pages) feedList.insertAdjacentHTML('beforeend', '<div style="text-align:center;padding:24px">' + icon('check', C.avatarLarge, undefined) + '<h3>You\'re all caught up</h3><p class="' + C.meta + '">You\'ve seen all new posts from the past 3 days.</p></div>');
  feedBusy = false;
}

window.addEventListener('scroll', () => {
  if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 600) loadFeed();
}, { passive: true });
`;
