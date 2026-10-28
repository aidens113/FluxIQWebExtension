// A session check a page put where the next part of the list would have come
// (t765): photo-social's grid answers a third screen with "Your session needs a
// quick check before we load more" and a "Continue as <name>" control. It is an
// interruption, not the list ending: the list has not been read to its end, the
// page has stopped to ask.
//
// Found the way the loader's wait notice is (`./following-the-list.ts`), by the
// session-check vocabulary of the interference defences. What it offers decides
// what is done:
//
// - **a plain way on**: exactly one painted, enabled control whose whole label
//   is the page's Continue (`isSessionContinueLabel`) and no field to fill in.
//   The move presses it, as it presses a dialog's close.
// - **anything else needs the person**: a field to type into (a password, a
//   code), a robot check, or no single way on. Nothing is pressed or typed.
//
// Nothing of the wall's words is returned beyond the bounded sentence used in a
// failure message.

import { isSessionContinueLabel, isSessionWallText } from "../../action-runtime/interference";
import { robotCheckIn } from "../../action-runtime/robot-check";
import { textOutsideSensitiveControls } from "../../sensitive-text";
import { followingTheList, isShown } from "./following-the-list";

/** How much of the wall's words is matched. */
const TEXT_MAX = 400;
/** What can be pressed in the wall. */
const CONTROLS = 'button, [role="button"], input[type="button"], a[href], [tabindex]';
/** What would have to be filled in: a person's to answer. */
const FIELDS = "input, textarea, select";
/** Field types that are not fields. */
const NOT_FIELD = /^(?:hidden|button|submit|image|reset)$/iu;

/** A session check found under a list. */
export type SessionWall = {
  readonly element: Element;
  /** The page's own Continue, when it offers exactly one and asks for nothing typed; `undefined` when only a person can answer. */
  readonly wayOn: HTMLElement | undefined;
  /** The wall's words, bounded, for a failure message. */
  readonly words: string;
};

/** The session check under the list `run`, or `undefined` when the page shows none. */
export function sessionWallOf(run: readonly Element[]): SessionWall | undefined {
  const element = followingTheList(run, (candidate) => wordsOf(candidate) !== "" && isSessionWallText(wordsOf(candidate)));
  if (element === undefined) return undefined;
  return { element, wayOn: wayOnIn(element), words: wordsOf(element) };
}

function wordsOf(element: Element): string {
  return textOutsideSensitiveControls(element).replace(/\s+/gu, " ").trim().slice(0, TEXT_MAX);
}

function wayOnIn(wall: Element): HTMLElement | undefined {
  if (asksForInput(wall) || robotCheckIn(wall, "dialog") !== undefined) return undefined;
  const ways = Array.from(wall.querySelectorAll(CONTROLS)).filter((control): control is HTMLElement => isContinue(control));
  return ways.length === 1 ? ways[0] : undefined;
}

function asksForInput(wall: Element): boolean {
  return Array.from(wall.querySelectorAll(FIELDS)).some((field) => !NOT_FIELD.test(field.getAttribute("type") ?? "") && isShown(field));
}

function isContinue(control: Element): boolean {
  if (!isShown(control) || control.getAttribute("aria-disabled") === "true" || (control as { disabled?: unknown }).disabled === true) return false;
  if (control.getAttribute("href") !== null && !(control.getAttribute("href") ?? "").startsWith("#")) return false;
  const label = (control.getAttribute("aria-label") ?? control.textContent ?? "").replace(/\s+/gu, " ").trim();
  return isSessionContinueLabel(label);
}
