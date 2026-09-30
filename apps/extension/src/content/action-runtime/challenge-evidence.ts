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

import { openRootsWithin } from "../shadow-dom";

export type ChallengeKind = "captcha" | "credential" | "payment";

/** What the root, painted, asks for that only a person can give; `undefined` when it asks for none of it. */
export function challengeIn(root: Element, scope: "dialog" | "page"): ChallengeKind | undefined {
  if (renderedMatch(root, CAPTCHA_SELECTOR)) return "captcha";
  if (renderedMatch(root, CODE_SELECTOR)) return "credential";
  if (scope === "dialog") {
    if (renderedMatch(root, PASSWORD_SELECTOR)) return "credential";
    if (renderedMatch(root, CARD_SELECTOR)) return "payment";
  }
  const text = scope === "dialog" ? renderedText(root) : `${headingText(root)} ${interstitialText(root)}`;
  if (CAPTCHA_WORDS.test(text)) return "captcha";
  if (CODE_WORDS.test(text)) return "credential";
  if (scope === "dialog" && PAYMENT_WORDS.test(text)) return "payment";
  return undefined;
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
  'img[alt*="captcha" i]',
  '[aria-label*="security image" i]',
  'img[alt*="security image" i]'
].join(", ");

const CODE_SELECTOR = 'input[autocomplete="one-time-code"]';
const PASSWORD_SELECTOR = 'input[type="password"], input[autocomplete="current-password"]';
const CARD_SELECTOR = 'input[autocomplete^="cc-"]';

const CAPTCHA_WORDS = /\bcaptcha\b|\bnot an? (?:robot|bot)\b|\bverify (?:that )?you(?:'re| are) (?:a )?human\b|\bare you (?:a )?(?:human|robot)\b|\bcharacters (?:you see|shown|in the (?:image|picture))\b|\btype the (?:characters|text|letters) (?:you see|in the (?:image|picture))\b/iu;
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
