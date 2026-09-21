import { escapeHtml } from "../../../html.js";
import { FEED_BATCH, FEED_POSTS, MEMBERS, type FeedPost } from "../data/index.js";
import { initials, newsRail, profileHref, renderShellPage, ROOT, type ShellKit } from "../shell/index.js";

/** One update. Its text is clamped to three lines with a "…see more" that lifts the clamp; the whole text is in the page either way. */
export function feedPostMarkup(kit: ShellKit, post: FeedPost): string {
  const c = kit.css;
  const author = MEMBERS.find((member) => member.name === post.actor && !member.hidden);
  const actor = author ? `<a href="${escapeHtml(profileHref(author))}"><strong>${escapeHtml(post.actor)}</strong></a>` : `<strong>${escapeHtml(post.actor)}</strong>`;
  const meta = post.promoted ? "Promoted" : `${escapeHtml(post.actorHeadline)}<br>${post.age} • <span aria-label="Visible to anyone on or off Guildline">🌐</span>`;
  const label = post.suggested ? `<div class="${c.muted} ${c.small}" style="border-bottom:1px solid #e0dfdc;margin:-4px 0 8px;padding-bottom:8px">Suggested</div>` : "";
  const counts = post.promoted ? `<a class="${c.link}" href="${ROOT}premium/">Learn more</a>` : `<span>👍❤️ ${post.reactions}</span><span>${post.comments}</span>`;
  return `<li class="${c.feedPost}" data-urn="${post.id}">${label}<div class="${c.postHead}"><div class="${c.avatar}" aria-hidden="true">${escapeHtml(initials(post.actor))}</div><div>${actor}<div class="${c.muted} ${c.small}">${meta}</div></div></div>
<div class="${c.postBody}" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(post.body)}</div><button class="${c.textBtn}" type="button">…see more</button>
<div class="${c.postFoot}">${counts}</div>
<div style="display:flex;justify-content:space-around;margin-top:4px">${["Like", "Comment", "Repost", "Send"].map((action) => `<button class="${c.textBtn}" type="button">${action}</button>`).join("")}</div></li>`;
}

/** Updates `offset` onward, one batch of them, for the scroll loader. */
export function feedBatch(kit: ShellKit, offset: number): { html: string; done: boolean } {
  const posts = FEED_POSTS.slice(offset, offset + FEED_BATCH);
  return { html: posts.map((post) => feedPostMarkup(kit, post)).join("\n"), done: offset + posts.length >= FEED_POSTS.length };
}

/**
 * The home feed, which is the site's start page: the member's card, a post
 * box, the first five updates and a sentinel that loads five more, behind a
 * skeleton, each time it scrolls into view, until the feed is exhausted.
 */
export function renderFeedPage(kit: ShellKit): string {
  const c = kit.css;
  const listId = kit.ids.next();
  const sentinelId = kit.ids.next();
  const first = feedBatch(kit, 0);
  const left = `<section class="${c.card}" style="text-align:center;padding-bottom:12px"><div style="height:56px;background:#a0b4b7;border-radius:8px 8px 0 0"></div><div class="${c.avatar}" style="width:72px;height:72px;margin:-36px auto 0;border:2px solid #fff">RI</div>
<a href="${ROOT}in/me/"><strong>Rafaela Ionescu</strong></a><div class="${c.muted} ${c.small}" style="padding:0 12px">Talent Partner, Data &amp; Platform at Northwick Analytics</div>
<div style="text-align:left;border-top:1px solid #e0dfdc;margin-top:12px;padding:8px 12px" class="${c.small}"><div style="display:flex;justify-content:space-between"><span class="${c.muted}">Profile viewers</span><strong>48</strong></div><div style="display:flex;justify-content:space-between"><span class="${c.muted}">Post impressions</span><strong>1,204</strong></div></div></section>`;
  const main = `<section class="${c.card}" style="padding:12px 16px;display:flex;gap:8px"><div class="${c.avatar}" aria-hidden="true">RI</div><button class="${c.secondaryBtn}" type="button" style="flex:1;text-align:left;color:#666;border-color:#8c8c8c">Start a post</button></section>
<ul id="${listId}" class="${c.feedList}">${first.html}</ul><div id="${sentinelId}" class="${c.sentinel}"></div>`;
  const script = `const GL = window.GL;
const list = document.getElementById(${JSON.stringify(listId)});
const sentinel = document.getElementById(${JSON.stringify(sentinelId)});
list.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (button && button.textContent.trim() === '…see more') { button.previousElementSibling.style.webkitLineClamp = 'unset'; button.remove(); }
});
let offset = ${FEED_BATCH};
let loading = false;
let done = ${first.done};
const observer = new IntersectionObserver(async (entries) => {
  if (!entries.some((entry) => entry.isIntersecting) || loading || done) return;
  loading = true;
  sentinel.innerHTML = '<div class=${JSON.stringify(c.spinner)}></div>';
  await new Promise((resolve) => setTimeout(resolve, 800));
  const response = await fetch(GL.root + 'feed/fragment?offset=' + offset, { headers: { accept: 'application/json' } });
  const body = await response.json();
  list.insertAdjacentHTML('beforeend', body.html);
  offset += ${FEED_BATCH};
  done = body.done;
  sentinel.innerHTML = done ? '<p style="text-align:center;color:#666">You’re all caught up.</p>' : '';
  loading = false;
});
observer.observe(sentinel);`;
  return renderShellPage(kit, { title: "Feed | Guildline", active: "home", layout: "layout3", columns: [left, main, newsRail(kit)], script, appPrompt: true });
}
