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
// check or a code prompt, and only in its headings and labels. A reCAPTCHA v3
// badge, which sits on every page of the sites that use it and asks nothing of
// anyone, is not a robot check.

export type ChallengeKind = "captcha" | "credential" | "payment";

/** What the root, painted, asks for that only a person can give; `undefined` when it asks for none of it. */
export function challengeIn(root: Element, scope: "dialog" | "page"): ChallengeKind | undefined {
  if (renderedMatch(root, CAPTCHA_SELECTOR)) return "captcha";
  if (renderedMatch(root, CODE_SELECTOR)) return "credential";
  if (scope === "dialog") {
    if (renderedMatch(root, PASSWORD_SELECTOR)) return "credential";
    if (renderedMatch(root, CARD_SELECTOR)) return "payment";
  }
  const text = scope === "dialog" ? renderedText(root) : headingText(root);
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

/** The headings and labels that say what a page is asking for. */
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"], label, legend';

/** Whether anything under the root, or the root itself, matches and has a box on screen. An unsupported selector is no answer. */
function renderedMatch(root: Element, selector: string): boolean {
  try {
    if (root.matches(selector) && root.getClientRects().length > 0) return true;
    for (const element of root.querySelectorAll(selector)) {
      if (element.getClientRects().length > 0) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** The root's text as a reader sees it, bounded. `innerText` skips what is not rendered; `textContent` is the fallback where there is no layout. */
function renderedText(root: Element): string {
  const text = root instanceof HTMLElement && typeof root.innerText === "string" ? root.innerText : root.textContent ?? "";
  return text.slice(0, TEXT_LIMIT);
}

/** The painted headings and labels under the root, joined and bounded. */
function headingText(root: Element): string {
  let text = "";
  for (const element of root.querySelectorAll(HEADING_SELECTOR)) {
    if (element.getClientRects().length === 0) continue;
    text += ` ${element.textContent ?? ""}`;
    if (text.length >= TEXT_LIMIT) break;
  }
  return text.slice(0, TEXT_LIMIT);
}
