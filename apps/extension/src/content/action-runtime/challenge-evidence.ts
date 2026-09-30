// Whether what is on screen asks for something only a person can give.
//
// "Needs a person" means exactly three things here, and they are the line
// `blocking-dialog.ts` and `results.ts` draw between a page condition recovery
// may deal with and one it must never try to get past:
//
// - `captcha`: a robot check -- a vendor widget, or a "type the characters you
//   see" image. Answering it is the check's whole point.
// - `credential`: a password, or a one-time or second-factor code. Only the
//   person holds it.
// - `payment`: card details, or a request to confirm a payment. The person
//   decides whether money moves.
//
// Each is read from what the page declares -- a control's `type` or
// `autocomplete`, a vendor widget's frame or container, an image's accessible
// name -- and, failing that, from the words of the headings and labels that
// explain the challenge. Nothing here reads a field's value, and nothing read
// here leaves this module: the answer is one closed word.
//
// A dialog is small and wholly on screen, so all of its text is read. A page
// is not: an ordinary page may mention a captcha or have a card field on its
// checkout form without being a challenge, so a page is read only for a robot
// check or a code prompt, and only in its headings and labels -- unless the
// whole page is small enough to be nothing but an interstitial, when all of its
// painted text is read, as a dialog's is. A traffic screen is often a bare
// document with its words in paragraphs: the crossborder marketplace's has no
// heading at all, only "please confirm you are not a robot" and a box reading
// "I'm not a robot", and live runs 15 and 17 navigated onto it eleven times
// without anything seeing it. A reCAPTCHA v3 badge, which sits on every page of
// the sites that use it and asks nothing of anyone, is not a robot check.
//
// Every read enters the open shadow roots beneath the root. The interference
// defence now finds a way out inside a widget's shadow root, and it may press
// one only because this said the widget asks for nothing of the person's -- so
// a robot check drawn inside a shadow root has to be seen here first, or the
// defence would close it. A closed root cannot be read, here or anywhere.
//
// A robot check is also read for **who clears it** (`robotCheckIn`), because
// FluxIQ never presses, types into, solves or reloads one, so what it does
// next depends on whether the check goes away without anyone:
//
// - `self_clearing`: the page says it is checking and will let the visitor on
//   by itself -- "Checking your browser before you continue", "Checking you
//   are human...", "we'll check your browser again automatically in 8
//   seconds", or a disabled button reading "Checking..." on a page about
//   robots, humans or the browser. The automation waits it out.
// - `person_only`: the page asks the visitor to prove something -- an "I'm
//   not a robot" box, "Confirm you are human", a press-and-hold with no
//   countdown, characters in a picture. Only a person may answer it.
//
// Characters in a picture, or a security image, are always the person's: no
// countdown answers them. Otherwise a check that says it is checking by itself
// is self-clearing even when it also offers a box or a hold, because waiting
// is then an honest way through; one that does not clear in time is handed to
// the person by whoever waited (`runtime/landed-check-wait.ts`,
// `robot-check/robot-check-watch.ts`). The line is drawn from the wording and
// structure a visitor reads, never from a site's name.
//
// Beyond its headings and a whole interstitial, a page is read in the regions
// it draws a notice or a check into over its own content: a dialog, an alert
// or status region, a live region, each read in full as a dialog is. A search
// feed covered by "Checking your browser" in a `role="alert"`, or a quote form
// whose modal turns into "Confirm you are human", is a long page whose check
// is in neither its headings nor a small document.

import { openRootsWithin } from "../shadow-dom";

export type ChallengeKind = "captcha" | "credential" | "payment";

/** Who clears a robot check: the page by itself, given time, or only a person. */
export type RobotCheckKind = "self_clearing" | "person_only";

/** What the root, painted, asks for that only a person can give; `undefined` when it asks for none of it. */
export function challengeIn(root: Element, scope: "dialog" | "page"): ChallengeKind | undefined {
  // In a dialog every robot check is `captcha`, a self-clearing one included:
  // the interference defence reads this to know which layers it must never
  // press through. On a page only one a person must answer is, because the
  // gate that reads a page (`results.ts`) hands it to the person; a
  // self-clearing check there is waited out instead -- by the navigation or
  // click that met it, or by the retry a missing target is given.
  const robotCheck = robotCheckIn(root, scope);
  if (robotCheck === "person_only" || (robotCheck === "self_clearing" && scope === "dialog")) return "captcha";
  if (renderedMatch(root, CODE_SELECTOR)) return "credential";
  if (scope === "dialog") {
    if (renderedMatch(root, PASSWORD_SELECTOR)) return "credential";
    if (renderedMatch(root, CARD_SELECTOR)) return "payment";
  }
  const text = scopeText(root, scope);
  if (CODE_WORDS.test(text)) return "credential";
  if (scope === "dialog" && PAYMENT_WORDS.test(text)) return "payment";
  return undefined;
}

/** Whether the root, painted, shows a robot check, and who clears it; `undefined` when it shows none. */
export function robotCheckIn(root: Element, scope: "dialog" | "page"): RobotCheckKind | undefined {
  const text = scopeText(root, scope);
  if (renderedMatch(root, PICTURE_CHECK_SELECTOR) || PICTURE_WORDS.test(text)) return "person_only";
  if (SELF_CLEARING_WORDS.test(text) || checkingControlIn(root, text)) return "self_clearing";
  if (renderedMatch(root, CAPTCHA_SELECTOR) || PERSON_WORDS.test(text)) return "person_only";
  return undefined;
}

/** The words a scope is read in: all of a dialog's; a page's headings, a whole interstitial, and its check regions. */
function scopeText(root: Element, scope: "dialog" | "page"): string {
  if (scope === "dialog") return renderedText(root);
  return `${headingText(root)} ${interstitialText(root)} ${regionText(root)}`;
}

const CAPTCHA_SELECTOR = [
  'iframe[src*="recaptcha" i]:not([src*="size=invisible" i])',
  'iframe[src*="hcaptcha" i]',
  'iframe[src*="turnstile" i]',
  'iframe[src*="challenges.cloudflare.com" i]',
  'iframe[src*="captcha" i]:not([src*="size=invisible" i])',
  'iframe[title*="captcha" i]:not([src*="size=invisible" i])',
  ".g-recaptcha:not([data-size=\"invisible\"])",
  ".h-captcha",
  ".cf-turnstile",
  '[aria-label*="captcha" i]',
  'img[alt*="captcha" i]'
].join(", ");

/** A picture the visitor must read back, which only a person can. */
const PICTURE_CHECK_SELECTOR = '[aria-label*="security image" i], img[alt*="security image" i]';

const CODE_SELECTOR = 'input[autocomplete="one-time-code"]';
const PASSWORD_SELECTOR = 'input[type="password"], input[autocomplete="current-password"]';
const CARD_SELECTOR = 'input[autocomplete^="cc-"]';

/** A check that asks the visitor to read something back from a picture. */
const PICTURE_WORDS = /\bcharacters (?:you see|shown|in the (?:image|picture))\b|\btype the (?:characters|text|letters) (?:you see|in the (?:image|picture))\b/iu;

/**
 * A check that asks the visitor to prove something: tick a box, confirm they
 * are human, say whether they are a robot. "Press and hold" alone is not here:
 * a voice-message button says it too.
 */
const PERSON_WORDS = /\bcaptcha\b|\bnot an? (?:robot|bot)\b|\b(?:verify|confirm|prove) (?:that )?you(?:['’]re| are) (?:a )?human\b|\bare you (?:a )?(?:human|robot)\b|\brobot or (?:a )?human\b|\bhuman or (?:a )?robot\b/iu;

/**
 * A check that says it is looking at the visitor now and will let them on by
 * itself: it is checking the browser or the visitor, or it will check again
 * automatically. A bare countdown ("redirected in 5 seconds") is not here: a
 * page after a form says that too.
 */
const SELF_CLEARING_WORDS = /\bchecking (?:that |if |whether )?your browser\b|\b(?:checking|verifying) (?:that |if |whether )?you(?:['’]re| are) (?:a )?human\b|\bcheck (?:your browser |you )?again automatically\b/iu;

/** A control's own words that a check is still running. */
const CHECKING_CONTROL_WORDS = /\b(?:checking|verifying)\b/iu;

/** Words that make a disabled "Checking..." control a robot check's, rather than a stock or address check's. */
const CHECK_CONTEXT_WORDS = /\b(?:robots?|human|your browser|unusual (?:traffic|activity)|security check|bots?)\b/iu;

const CODE_WORDS = /\bone[- ]time (?:pass)?code\b|\bverification code\b|\btwo[- ]factor\b|\b2-step verification\b|\bauthentication code\b|\bauthenticator app\b/iu;
const PAYMENT_WORDS = /\bconfirm (?:your |this )?(?:payment|purchase)\b|\bauthori[sz]e (?:this |the )?payment\b|\b3-?d ?secure\b|\bverify (?:your |this )?(?:payment|card)\b/iu;

/** At most this much text is read from one dialog or from one page's headings. */
const TEXT_LIMIT = 4_000;

/**
 * At most this much painted text, whitespace collapsed, makes a page an
 * interstitial whose every word is read. The crossborder marketplace's traffic
 * screen is about 170 characters; a page of ordinary content, even an empty
 * basket with its header and footer, is well past this, and an article that
 * explains robot checks is prose far longer than any check.
 */
const INTERSTITIAL_TEXT_LIMIT = 1_000;

/** The headings and labels that say what a page is asking for. */
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"], label, legend';

/** The regions a page draws a notice or a check into over its own content. */
const REGION_SELECTOR = 'dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"], [role="alert"], [role="status"], [aria-live="assertive"], [aria-live="polite"]';

/** A control a page disables while something it started is still running. */
const DISABLED_CONTROL_SELECTOR = 'button:disabled, input[type="button"]:disabled, input[type="submit"]:disabled, [role="button"][aria-disabled="true"], button[aria-disabled="true"]';

/** Whether anything under the root, or the root itself, matches and has a box on screen. An unsupported selector is no answer. */
function renderedMatch(root: Element, selector: string): boolean {
  try {
    if (root.matches(selector) && root.getClientRects().length > 0) return true;
    for (const scope of [root, ...openRootsWithin(root)]) {
      for (const element of scope.querySelectorAll(selector)) {
        if (element.getClientRects().length > 0) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

/** The root's text as a reader sees it, bounded. `innerText` skips what is not rendered; `textContent` is the fallback where there is no layout. */
function renderedText(root: Element, limit = TEXT_LIMIT): string {
  // `innerText` does not read into a shadow root, so each open root's own
  // top-level elements are read after the root's text.
  let text = elementText(root);
  for (const shadow of openRootsWithin(root)) {
    for (const child of shadow.children) {
      if (text.length >= limit) return text.slice(0, limit);
      text += ` ${elementText(child)}`;
    }
  }
  return text.slice(0, limit);
}

function elementText(element: Element): string {
  return element instanceof HTMLElement && typeof element.innerText === "string" ? element.innerText : element.textContent ?? "";
}

/** All of the root's painted text when there is little enough of it to be an interstitial; otherwise nothing. */
function interstitialText(root: Element): string {
  // Measured after collapsing, over the whole text: a bound taken first would
  // let a long page whose opening is mostly blank lines pass as a short one.
  const text = renderedText(root, Number.POSITIVE_INFINITY).replace(/\s+/gu, " ").trim();
  return text.length <= INTERSTITIAL_TEXT_LIMIT ? text : "";
}

/** The painted check regions under the root, each read in full, all together bounded. */
function regionText(root: Element): string {
  let text = "";
  for (const element of renderedMatches(root, REGION_SELECTOR)) {
    text += ` ${renderedText(element)}`;
    if (text.length >= TEXT_LIMIT) return text.slice(0, TEXT_LIMIT);
  }
  return text;
}

/**
 * Whether a painted, disabled control says a check is still running, on a
 * scope whose words are about robots, humans or the browser: a check that is
 * still deciding, which a visitor can only wait for.
 */
function checkingControlIn(root: Element, text: string): boolean {
  if (!CHECK_CONTEXT_WORDS.test(text)) return false;
  return renderedMatches(root, DISABLED_CONTROL_SELECTOR).some((control) => CHECKING_CONTROL_WORDS.test(control.textContent ?? ""));
}

/** Every painted element under the root, open shadow roots included, that matches. An unsupported selector matches nothing. */
function renderedMatches(root: Element, selector: string): Element[] {
  const found: Element[] = [];
  try {
    for (const scope of [root, ...openRootsWithin(root)]) {
      for (const element of scope.querySelectorAll(selector)) {
        if (element.getClientRects().length > 0) found.push(element);
      }
    }
  } catch (error) {
    if (!(error instanceof Error && error.name === "SyntaxError")) throw error;
  }
  return found;
}

/** The painted headings and labels under the root, joined and bounded. */
function headingText(root: Element): string {
  let text = "";
  for (const scope of [root, ...openRootsWithin(root)]) {
    for (const element of scope.querySelectorAll(HEADING_SELECTOR)) {
      if (element.getClientRects().length === 0) continue;
      text += ` ${element.textContent ?? ""}`;
      if (text.length >= TEXT_LIMIT) return text.slice(0, TEXT_LIMIT);
    }
  }
  return text.slice(0, TEXT_LIMIT);
}
