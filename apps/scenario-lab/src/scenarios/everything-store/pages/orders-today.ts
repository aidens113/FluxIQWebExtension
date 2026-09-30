/**
 * What the thank-you page says about the account's day: how many orders it
 * has placed. A page that confirms one order says nothing about another, so
 * without this a run that bought the kettle twice -- or bought something else
 * first and then the kettle -- ends on a page indistinguishable from the one a
 * single right order leaves. The purchase goal holds it at one.
 */
export function ordersTodayText(count: number): string {
  return `Orders placed today: ${count}`;
}
