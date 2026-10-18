// A loop over a list's rows, acting on a control the build never placed in a
// row, on a page where acting on a row changes that row.
//
// Live run `run-mvd0qwhi-5f7dbf80` read five feed posts and pressed each one's
// "Hide post" with `repeat over`. The saved identity was `{ landmark: "main" }`
// beside a positional selector naming the post the build had looked at, so the
// row never reached the page: pass 1 hid that post instead of row 1, and pass 2,
// with that post now a "Hidden ... Undo" bar, met the identical "Hide post"
// buttons of every other post and failed `web.target.ambiguous` in every trial.
//
// The page here is synthetic and of the same shape: posts as `[role=article]`
// cards in a `[role=feed]` (no list position), each with an icon "Hide post"
// whose class a page-level dialog control shares, and hiding replaces the
// card's contents while the card stays in the list. The domain now writes the
// pass's row on every recorded element (`domain/src/output-nodes/targets/row-scope.ts`);
// these rows pin what the page does with a row the build never placed
// (`../pass-row/`).

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { el, installStubDocument, stubDocument, type StubElement } from "../../tests/stub-dom";
import type { BrowserActionCommand } from "../../types";
import { resolveTarget } from "../resolve-target";

type Post = { community: string; text: string; own?: boolean };

const POSTS: readonly Post[] = [
  { community: "Harbour Rowing Club", text: "Early session moved to 6:30 on Saturday." },
  { community: "Seed Library", text: "New packets of runner beans are in." },
  { community: "Urban Growers", text: "Anyone found a way to keep pigeons off kale?" },
  { community: "Me", text: "Back from the coast, photos soon.", own: true },
  { community: "Night Market", text: "Stalls open until ten this Friday." }
];

/** The recorded position: the third post's "Hide post", the post the build looked at. */
const BUILD_ROW_SELECTOR = '[role="feed"] > div:nth-of-type(3) > div > div';

type Feed = { articles: StubElement[]; hide: Map<string, Element>; closeChat: Element };

function installFeed(t: TestContext): Feed {
  const document = stubDocument();
  const hide = new Map<string, Element>();
  const articles = POSTS.map((post) => {
    const head = el("div", { class: "head" }, el("h3", {}, el("a", { href: `/c/${post.community.length}` }, post.community)));
    if (!post.own) {
      const button = el("div", { class: "icon", role: "button", "aria-label": "Hide post" });
      head.append(button);
      hide.set(post.community, button as unknown as Element);
    }
    return el("div", { class: "unit", role: "article" }, head, el("div", { class: "msg" }, post.text), el("div", { class: "act", role: "button", "aria-label": "Like" }, "Like"));
  });
  const closeChat = el("div", { class: "icon", role: "button", "aria-label": "Close chat" });
  const main = el("div", { role: "main" }, el("div", { role: "dialog", "aria-label": "Chat" }, el("span", {}, "Chat"), closeChat), el("div", { role: "feed" }, ...articles));
  document.append(el("html", {}, el("body", {}, main)));
  installStubDocument(t, document);
  return { articles, hide, closeChat: closeChat as unknown as Element };
}

/** What hiding does on such a page: the card's contents become a notice and an Undo, and the card stays. */
function hidePost(article: StubElement): void {
  for (const child of article.childNodes) child.parentNode = null;
  article.childNodes.length = 0;
  article.append(el("div", { class: "bar" }, el("span", {}, "Hidden. You will see fewer posts like this."), el("div", { class: "act", role: "button" }, "Undo")));
}

/** The step as a pass dispatches it: the saved identity, and the pass's row as the domain writes it. */
function hideOnRow(post: Post | undefined): BrowserActionCommand {
  const record = post ? { values: [post.community, post.text] } : undefined;
  return {
    commandId: "cmd-hide",
    actionType: "web.dom.click",
    selector: BUILD_ROW_SELECTOR,
    element: {
      tagName: "div", role: "button", accessibleName: "Hide post", classNames: ["icon"],
      attributes: { "aria-label": "Hide post" }, selector: BUILD_ROW_SELECTOR,
      context: { landmark: "main", ...(record ? { record } : {}) }
    }
  } as unknown as BrowserActionCommand;
}

const post = (index: number): Post => POSTS[index] as Post;

test("each pass presses the control in its own row, though an earlier pass changed its row and the build looked at another", (t) => {
  const feed = installFeed(t);
  for (const index of [0, 1, 2, 4]) {
    const resolved = resolveTarget(hideOnRow(post(index)));
    assert.equal(resolved.element, feed.hide.get(post(index).community), `pass for ${post(index).community}`);
    hidePost(feed.articles[index] as StubElement);
  }
});

test("a pass whose row holds no such control fails as not found, and never presses another row's", (t) => {
  installFeed(t);
  assert.throws(() => resolveTarget(hideOnRow(post(3))), (error: unknown) => {
    assert.equal((error as { failure?: { code?: string } }).failure?.code, "web.target.not_found");
    return true;
  });
});

test("before the row reached the page, the build's row once changed left the other rows' controls tied", (t) => {
  // What every pass dispatched in the live run: no row at all. With the build's
  // own post hidden, nothing says which of the remaining identical controls is meant.
  const feed = installFeed(t);
  hidePost(feed.articles[2] as StubElement);
  assert.throws(() => resolveTarget(hideOnRow(undefined)), (error: unknown) => {
    assert.equal((error as { failure?: { code?: string } }).failure?.code, "web.target.ambiguous");
    return true;
  });
});

test("a control outside every row is the same control on every pass", (t) => {
  const feed = installFeed(t);
  const selector = '[role="dialog"] > div';
  const command = {
    commandId: "cmd-close",
    actionType: "web.dom.click",
    selector,
    element: {
      tagName: "div", role: "button", accessibleName: "Close chat", classNames: ["icon"],
      attributes: { "aria-label": "Close chat" }, selector,
      context: { landmark: "main", record: { values: [post(1).community, post(1).text] } }
    }
  } as unknown as BrowserActionCommand;
  assert.equal(resolveTarget(command).element, feed.closeChat);
});

test("a control the build placed in a row is gated to the pass's row alone, as before", (t) => {
  const feed = installFeed(t);
  const command = hideOnRow(post(1));
  const element = command.element as unknown as { context: { record: { text?: string; values: string[] } } };
  element.context.record.text = `${post(2).community} ${post(2).text}`;
  assert.equal(resolveTarget(command).element, feed.hide.get(post(1).community));
});
