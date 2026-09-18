import { escapeHtml, page } from "../../html.js";
import { inboxAccountById, inboxAccountCellText } from "./accounts.js";
import { conversationsFor } from "./conversations.js";
import { ageText, INBOX_ROOT, receivedText } from "./format.js";
import { applyInboxChanges, filterConversations, normalizeInboxFilters, pageOf } from "./inbox.js";
import { inboxBuildMarkerText, INBOX_BUILDS, inboxClasses, inboxStylesheet } from "./styles.js";
import { inboxRowsMarkup } from "./table.js";
import type { ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import type { Conversation, InboxState } from "./types.js";

const CONVERSATION_SUBPATH = /^conversations\/([a-z0-9_]+)$/;

/**
 * `items` serves one page of the filtered inbox as rows, and says in its
 * headers how many matched, how many are now showing, and whether anything
 * older is left. That is how a real inbox pages, and it is why the page can
 * *append* what comes back rather than rebuilding the list: every row already
 * on screen keeps its element. It records nothing, because reading a page is
 * not an action.
 *
 * `conversations/<id>` serves the conversation's own page -- the whole message
 * the row could only show the start of -- and records the visit
 * (`open-conversation`). Both follow the armed rendering and the run's own
 * changes. Anything else is a 404.
 */
export function routeInbox(state: InboxState, request: ScenarioRouteRequest): ScenarioRouteResponse | undefined {
  const conversations = applyInboxChanges(conversationsFor(state.mode), state);
  if (request.subpath === "items") {
    const matched = filterConversations(conversations, normalizeInboxFilters(request.query));
    const { items, more, shown } = pageOf(matched, Number(request.query.get("page") ?? "1"));
    const css = inboxClasses(state.mode === "restyled" ? INBOX_BUILDS.restyled : INBOX_BUILDS.baseline);
    return {
      status: 200,
      headers: {
        "x-inbox-matched": String(matched.length),
        "x-inbox-shown": String(shown),
        "x-inbox-more": more ? "true" : "false",
      },
      body: inboxRowsMarkup(css, items),
    };
  }
  const id = CONVERSATION_SUBPATH.exec(request.subpath)?.[1];
  const conversation = id === undefined ? undefined : conversations.find((candidate) => candidate.id === id);
  if (!conversation) return undefined;
  return {
    status: 200,
    body: conversationPageMarkup(conversation, state),
    mutation: { operation: "open-conversation", payload: { id: conversation.id } },
  };
}

/**
 * A conversation's own page. This is the one surface in the fixture whose
 * fields carry test ids, and deliberately: it is a record rather than a list,
 * so a reader that opens it is reading one thing with named parts, the way
 * `product-catalog`'s product page does. The inbox list itself labels nothing,
 * so a read of the list has to work from the column headers a person sees.
 */
function conversationPageMarkup(conversation: Conversation, state: InboxState): string {
  const css = inboxClasses(state.mode === "restyled" ? INBOX_BUILDS.restyled : INBOX_BUILDS.baseline);
  const account = inboxAccountById(conversation.accountId);
  const reply = state.replies.find((entry) => entry.id === conversation.id);
  const sent = reply === undefined ? "" : `<p data-testid="detail-reply">${escapeHtml(reply.text)}</p>`;
  const body = `<main class="${css.content}" data-testid="conversation-detail">
<nav aria-label="Breadcrumb"><a href="${INBOX_ROOT}">Back to the inbox</a></nav>
<h1 class="${css.pageTitle}" data-testid="detail-heading">${escapeHtml(conversation.author.name)}</h1>
<p data-testid="detail-from">${escapeHtml(`${conversation.author.name} ${conversation.author.handle}`)}</p>
<p data-testid="detail-account">${escapeHtml(inboxAccountCellText(account))}</p>
<p data-testid="detail-kind">${conversation.kind}</p>
<p data-testid="detail-status">${conversation.status}</p>
<p data-testid="detail-age">${escapeHtml(`${ageText(conversation.ageMinutes)} · ${receivedText(conversation.ageMinutes)}`)}</p>
<p data-testid="detail-message">${escapeHtml(conversation.message)}</p>
${sent}
<footer class="${css.appFoot}"><small data-testid="build-marker">${inboxBuildMarkerText(state.mode === "restyled" ? INBOX_BUILDS.restyled : INBOX_BUILDS.baseline)}</small></footer>
</main>
<style>${inboxStylesheet(css)}</style>`;
  return page(`${conversation.author.name} · Mentio`, body, "");
}
