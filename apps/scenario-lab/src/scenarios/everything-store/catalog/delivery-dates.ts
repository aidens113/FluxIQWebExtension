/**
 * The store's calendar, fixed rather than read from the wall clock so a run on
 * any day reads the same page. "Today" is Monday 21 September 2026.
 *
 * Each date is spelled the three ways the store spells dates: the long form a
 * checkout option uses, the short form a search card uses, and the abbreviated
 * form the order confirmation uses.
 */
export const DELIVERY_DATES = {
  today: { long: "Monday, September 21", short: "Mon, Sep 21", abbreviated: "Mon, Sept. 21" },
  oneDay: { long: "Tuesday, September 22", short: "Tue, Sep 22", abbreviated: "Tue, Sept. 22" },
  standard: { long: "Thursday, September 24", short: "Thu, Sep 24", abbreviated: "Thu, Sept. 24" },
  brightaisleDay: { long: "Saturday, September 26", short: "Sat, Sep 26", abbreviated: "Sat, Sept. 26" },
  economy: { long: "Wednesday, October 7", short: "Wed, Oct 7", abbreviated: "Wed, Oct. 7" },
} as const;
