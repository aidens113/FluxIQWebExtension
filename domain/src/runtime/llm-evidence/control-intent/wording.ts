// What a control's own words tell a person pressing it will do.
//
// Read from the words a person reads -- the accessible name, else the visible
// text -- and, for a link to another page, the path it goes to. Never from a
// selector. A selector is how this domain addresses an element, assembled from
// ids and test ids on the element and on every ancestor above it; it is not
// something the page says to anybody. Reading it is how an order-management
// site became impossible to explore: every row sits under
// `[data-testid="order-rows"]`, so the word "order" refused every checkbox,
// row menu and link in the table, on the one kind of site where orders are the
// job.
//
// Three kinds of word, because English uses many of the same words as nouns and
// as verbs:
//
// - Words that commit wherever they appear: nobody labels a control "Bulk
//   delete" unless it deletes. These are refused anywhere in the label.
// - Words that commit only in a command's verb position, first. "Post" and
//   "Order now" commit; "New post", "Post actions", "Select order" and "Order
//   details" do not. A label that is the word followed only by nouns for a
//   container of controls -- actions, options, details, menu -- is naming the
//   container, not giving the command.
// - "Close" and "Cancel", which dismiss when they stand alone or name what they
//   put away ("Close composer") and commit when they name a record ("Cancel
//   order", "Close ticket").
//
// A link to another page is read differently. Its words name where it goes, so
// nouns in first place are expected ("Order ORD-40100"); a GET that commits is
// still refused when its label or path carries a word that commits anywhere
// (`/logout`, "Unsubscribe", "Delete") or a record-closing "Cancel order".

import type { WebLlmEvidenceElement } from "../elements";

/** What the label says pressing the control does. */
export type WebControlWording =
  /** It changes something that persists: send, save, delete, confirm, refund, ... */
  | "commits"
  /** It puts away something it names: "Close composer", "Hide details". */
  | "dismisses"
  /** A bare "Close" or "Cancel": a dismissal only while a dialog is up to be dismissed. */
  | "dismisses_whatever_is_open"
  /** It opens something to look at or fill in: "New post", "Reply", "Edit", "More actions". */
  | "opens"
  /** It marks a row as chosen: "Select order", "Select all posts". */
  | "selects"
  /** Nothing the words say settles it, or there are no words. */
  | "unstated";

/** Whether the words are a command given to the page, or name a page a link goes to. */
export type WebControlReading = "command" | "destination";

const COMMITS_ANYWHERE: ReadonlySet<string> = new Set([
  "accept", "agree", "allow", "apply", "approve", "assign", "buy", "checkout", "confirm", "deactivate", "decline", "delete",
  "deny", "destroy", "disable", "discard", "dispatch", "duplicate", "enable", "erase", "escalate", "execute", "export",
  "finalise", "finalize", "fulfil", "fulfill", "grant", "import", "logout", "mark", "merge", "move", "pay", "publish",
  "purchase", "reassign", "redo", "refund", "reject", "remove", "rename", "resend", "reset", "resolve", "restore", "retry",
  "revoke", "save", "send", "sign", "signout", "submit", "subscribe", "transfer", "unassign", "unblock", "undo", "unfollow",
  "uninstall", "unpublish", "unsubscribe", "upload", "void", "withdraw"
]);

const COMMITS_AS_COMMAND: ReadonlySet<string> = new Set([
  "add", "archive", "block", "book", "change", "charge", "claim", "clear", "complete", "connect", "copy", "create",
  "disconnect", "empty", "finish", "flag", "follow", "generate", "hold", "install", "invite", "issue", "join", "launch",
  "leave", "like", "lock", "mute", "order", "pin", "place", "post", "print", "process", "raise", "register", "release",
  "report", "reserve", "run", "schedule", "set", "share", "ship", "snooze", "star", "start", "stop", "tag", "trash",
  "unlock", "update", "verify"
]);

/** Two-word commands whose parts are harmless alone: "Log out", "Check out". */
const COMMITTING_PHRASES: ReadonlyArray<readonly [string, string]> = [["log", "out"], ["log", "off"], ["check", "out"]];

/** What a label names when it names a group of controls rather than giving a command. */
const CONTAINER_NOUNS: ReadonlySet<string> = new Set(["actions", "details", "filters", "history", "info", "list", "menu", "options", "overview", "settings", "summary", "view"]);

const DISMISSING: ReadonlySet<string> = new Set(["cancel", "close", "collapse", "dismiss", "hide"]);
/** What a dismissal may name and still be only a dismissal. */
const DISMISSED_THINGS: ReadonlySet<string> = new Set(["composer", "details", "dialog", "drawer", "editor", "filters", "menu", "modal", "options", "overlay", "panel", "popup", "preview", "sidebar", "window"]);

const OPENING: ReadonlySet<string> = new Set(["compose", "details", "edit", "expand", "forward", "load", "more", "new", "open", "preview", "reply", "see", "show", "view", "write"]);

/** Words that carry nothing in a label: "Close the dialog" dismisses as "Close dialog" does. */
const FILLER: ReadonlySet<string> = new Set(["a", "all", "an", "the", "this", "these"]);

/**
 * What the control's words say pressing it does.
 *
 * `reading` is the caller's statement of what kind of control this is: a link
 * to another page is read as a destination, everything else -- a button, a
 * menu item, a checkbox, a tab, a link that stays on this page -- as a command.
 */
export function webControlWording(element: Pick<WebLlmEvidenceElement, "name" | "text" | "href">, reading: WebControlReading): WebControlWording {
  const labels = [element.name, element.text].filter((label): label is string => Boolean(label)).map(labelWords);
  // The path only: a host name is not something the link says it does, and
  // `send.example.test` would otherwise refuse every link on the site.
  const destination = reading === "destination" ? labelWords((element.href ?? "").replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/iu, "")) : [];
  if (labels.some((words) => commits(words, reading)) || destination.some((word) => COMMITS_ANYWHERE.has(word))) return "commits";
  // The words a person hears first: the accessible name, else what is shown.
  const words = labels[0] ?? [];
  const [first, ...rest] = words;
  if (first === undefined) return "unstated";
  const named = rest.filter((word) => !FILLER.has(word));
  if (DISMISSING.has(first)) return named.length === 0 ? "dismisses_whatever_is_open" : "dismisses";
  if (OPENING.has(first)) return "opens";
  if (first === "select") return "selects";
  return "unstated";
}

/** A label as the lower-case words and numbers in it, so "+ New post…" reads `["new", "post"]`. */
function labelWords(label: string): string[] {
  return label.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function commits(words: readonly string[], reading: WebControlReading): boolean {
  if (words.some((word) => COMMITS_ANYWHERE.has(word))) return true;
  if (words.some((word, index) => COMMITTING_PHRASES.some(([head, tail]) => word === head && words[index + 1] === tail))) return true;
  const [first, ...rest] = words;
  if (first === undefined) return false;
  const named = rest.filter((word) => !FILLER.has(word));
  // "Cancel order", "Close ticket": a dismissal word that names a record commits,
  // whether it is a button or a GET link to `/orders/1/cancel`.
  if ((first === "cancel" || first === "close") && named.some((word) => !DISMISSED_THINGS.has(word))) return true;
  if (reading === "destination") return false;
  return COMMITS_AS_COMMAND.has(first) && !(named.length > 0 && named.every((word) => CONTAINER_NOUNS.has(word)));
}
