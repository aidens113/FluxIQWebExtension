/**
 * The home page in the browser: the hero rotates every four seconds, images
 * load as they scroll into view, and "More to love" fetches its next page when
 * its foot is scrolled to. A 429 from the feed leaves the spinner spinning --
 * it never clears on its own -- and puts a Retry link beside it once the
 * response's retry-after has passed.
 */
export function homeScript(): string {
  return HOME;
}

const HOME = String.raw`
const slides = allByClass('heroSlide');
let slide = 0;
setInterval(() => {
  slides[slide].style.display = 'none';
  slide = (slide + 1) % slides.length;
  slides[slide].style.display = 'block';
}, 4000);

const images = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.src = entry.target.getAttribute('data-src');
    entry.target.removeAttribute('data-src');
    images.unobserve(entry.target);
  }
}, { rootMargin: '100px' });
const watch = (scope) => qsa('img[data-src]', scope).forEach((image) => images.observe(image));
watch(document);

const feed = byClass('feed');
const status = byClass('feedStatus');
let nextPage = 2;
let loading = false;

async function loadNext() {
  if (loading || nextPage > pageData.feedPages) return;
  loading = true;
  status.innerHTML = '<span class="' + css.spinner + '"></span><span>Loading more…</span>';
  const response = await fetch(boot.root + 'feed?page=' + nextPage, { cache: 'no-store' });
  if (response.status === 429) {
    const wait = Number(response.headers.get('retry-after') || '3');
    setTimeout(() => {
      const retry = document.createElement('span');
      retry.className = css.retry;
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => { loading = false; loadNext(); }, { once: true });
      status.appendChild(retry);
    }, wait * 1000);
    return;
  }
  const holder = document.createElement('div');
  holder.innerHTML = await response.text();
  const cards = Array.from(holder.children);
  cards.forEach((card) => feed.appendChild(card));
  watch(feed);
  nextPage += 1;
  loading = false;
  status.innerHTML = nextPage > pageData.feedPages ? '<span>You have reached the end. Try searching for something!</span>' : '';
}

new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) loadNext(); }, { rootMargin: '200px' }).observe(status);
`;
