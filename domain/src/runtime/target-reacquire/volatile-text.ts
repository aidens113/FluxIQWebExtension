// Which row values a re-render may change without the row becoming another
// item (t786, D4): a value that says only a number, a count, a price or a time.
//
// The observed failure the rule is for: a For Each pass carries the row a read
// returned on an earlier page load, and the page has since redrawn it -- "12
// likes" is now "13 likes", "5 min ago" is now "6 min ago" -- so the row the
// pass is scoped to is in no record and every retry fails although the item is
// still there. Such columns are allowed to differ when the row is matched again;
// every other column is a word column and must be equal.
//
// **Only the whole value counts.** "iPhone 15" names a product and is a word
// column; "15" alone, "$15.99", "15 reviews", "15h", "Oct 15" and "15:00" say a
// quantity or a moment. A number followed by one word ("12 likes") is a count;
// a word followed by a number is not, so a model number never stops being part
// of the item's identity. A value of several such parts ("12 likes · 3
// comments") is volatile when every part is.
//
// The patterns are this file's own rather than Core's record readers
// (`readAutomationStudioRecordNumber`, `readAutomationStudioRecordDate`): those
// read a number or date *out of* any text, so "iPhone 15" reads as 15, which is
// right for sorting and wrong for telling an item apart.

import { webReacquireText } from "./text";

const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const WEEKDAY = String.raw`(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?`;
const CLOCK = String.raw`(?:\d{1,2}(?::\d{2}){1,2}\s*(?:[ap]\.?m\.?)?|\d{1,2}\s*[ap]\.?m\.?)`;
const UNIT = String.raw`(?:s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?|w|wks?|weeks?|mo|mos|months?|y|yrs?|years?)\.?`;
const AMOUNT = String.raw`(?:\d+(?:[.,]\d+)?\s*|(?:an?|one)\s+)`;
const SPAN = String.raw`${AMOUNT}${UNIT}(?:,?\s*(?:and\s+)?\d+(?:[.,]\d+)?\s*${UNIT})*`;
const LEAD = String.raw`(?:(?:posted|updated|edited|listed|added|joined|sold|ends?|ended|ending|closes?|closed|expires?|expired|active|seen)\s+)?`;
const AT_CLOCK = String.raw`(?:,?\s*(?:at\s+)?${CLOCK})?`;
const YEAR = String.raw`(?:,?\s+\d{4})?`;

const TIME = new RegExp(`^${LEAD}(?:${[
  String.raw`(?:about |over |almost |nearly |~)?${SPAN}(?:\s+(?:ago|left|remaining|to go))?`,
  String.raw`in\s+${SPAN}`,
  String.raw`(?:just now|now|today|yesterday|tomorrow|(?:a )?moments? ago|a while ago|recently)${AT_CLOCK}`,
  CLOCK,
  String.raw`\d{4}-\d{2}-\d{2}(?:[t ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:z|[+-]\d{2}:?\d{2})?)?`,
  String.raw`\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}`,
  String.raw`(?:${WEEKDAY},?\s+)?${MONTH}\s+\d{1,2}(?:st|nd|rd|th)?${YEAR}${AT_CLOCK}`,
  String.raw`(?:${WEEKDAY},?\s+)?\d{1,2}(?:st|nd|rd|th)?\s+${MONTH}${YEAR}${AT_CLOCK}`,
  String.raw`${MONTH}\s+\d{4}`
].join("|")})$`, "u");

const CURRENCY = String.raw`(?:\p{Sc}|usd|eur|gbp|cad|aud|jpy|inr|chf|us\$|c\$|a\$)`;
const NUMBER = String.raw`[+-]?\d+(?:[.,'   ]\d+)*`;
/** A quantity: an optional label and colon, an optional currency, the number, its magnitude, a rating's scale, and at most one word after it. */
const QUANTITY = new RegExp(String.raw`^(?:\p{L}+:\s*)?[([#]?(?:\p{So}\s*)?(?:${CURRENCY}\s*)?${NUMBER}\s*(?:[kmb]|bn|thousand|million|billion)?\+?(?:\s*(?:/|out of)\s*\d+(?:[.,]\d+)?)?\s*(?:%|${CURRENCY})?[)\]]?(?:\s*[\p{L}\p{So}]+)?$`, "u");

/** Separators a value of several counts or moments is written with. */
const PARTS = /\s*[·•|;,]\s*/u;

/** Whether `value` says only a number, count, price or time (header). Blank says nothing, so it is not volatile. */
export function webReacquireVolatileText(value: string): boolean {
  const text = webReacquireText(value);
  if (text === "") return false;
  if (says(text)) return true;
  const parts = text.split(PARTS).filter((part) => part !== "");
  return parts.length > 1 && parts.every(says);
}

function says(text: string): boolean {
  return QUANTITY.test(text) || TIME.test(text);
}
