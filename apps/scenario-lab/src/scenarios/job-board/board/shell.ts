import { escapeHtml, fixtureClient } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import type { JobBoardState } from "../types.js";
import { boardClasses, type BoardClasses } from "./classes.js";
import { boardClientScript } from "./client-script.js";
import { boardStylesheet } from "./styles.js";
import { boardWidgetsScript } from "./widgets-script.js";

export const BOARD_ROOT = "/scenarios/job-board/";
export const MY_JOBS_PATH = "/scenarios/job-board/myjobs";

/** Which of Rolefinch's pages a document is, which decides the behaviour its script switches on. */
export type BoardPageKind = "home" | "results" | "viewjob" | "myjobs" | "notice";

export type BoardDocument = {
  state: JobBoardState;
  context: RenderContext;
  kind: BoardPageKind;
  title: string;
  body: string;
  /** Page data the script needs beyond the board's own: ad keys, the per-page links, the search words. */
  data?: Record<string, unknown>;
};

/** The board's classes for the run's seed; every Rolefinch document is styled from these. */
export function classesFor(context: RenderContext): BoardClasses {
  return boardClasses(context.seed);
}

/**
 * A whole Rolefinch document: the header every page carries, the page body,
 * the footer, and the script. The header's "My jobs" badge is the count at
 * the moment the page was served and nothing on the page ever updates it,
 * which is how a stale badge looks on a real board.
 */
export function boardDocument(page: BoardDocument): string {
  const c = classesFor(page.context);
  const config = {
    kind: page.kind,
    mode: page.state.mode,
    consent: page.state.consent,
    alertOfferDismissed: page.state.alertOfferDismissed,
    chatMinimised: page.state.chatMinimised,
    saved: page.state.saved,
    follows: page.state.follows,
    css: c,
    ...page.data,
  };
  const configJson = JSON.stringify(config).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,">
<title>${escapeHtml(page.title)}</title>
<style>${boardStylesheet(c)}</style>
</head>
<body class="${c.shell}">
<header class="${c.header}">
<a class="${c.logo}" href="${BOARD_ROOT}">rolefinch</a>
<nav class="${c.nav}"><a class="${c.navLink}" href="${BOARD_ROOT}">Find jobs</a><a class="${c.navLink}" href="#">Company reviews</a><a class="${c.navLink}" href="#">Salary guide</a></nav>
<div class="${c.headerRight}"><a class="${c.myJobs}" href="${MY_JOBS_PATH}">My jobs<span class="${c.badge}">${page.state.saved.length}</span></a><a class="${c.navLink}" href="#">Sign in</a><a class="${c.navLink}" href="#">Employers / Post job</a></div>
</header>
<main class="${c.main}">${page.body}</main>
<footer class="${c.footer}">© 2026 Rolefinch Ltd · Cookies, privacy and terms · Rolefinch is a fictional job board used for testing.</footer>
<script type="module">
const CONFIG = ${configJson};
${fixtureClient(page.context.runToken, "job-board")}
${boardWidgetsScript()}
${boardClientScript()}
</script>
</body>
</html>`;
}

/** The heart icon every save (or, after the redesign, follow) control draws. It carries no text and no label. */
export const HEART_SVG = `<svg viewBox="0 0 24 24" focusable="false"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.6 1.1 4.6 2.6h2C14 6.1 15.6 5 17.6 5 21 5 23.1 8.4 21.6 11.8 19.5 16.4 12 21 12 21z"/></svg>`;
