/**
 * The site's one clock. Every relative day on the page is measured from here,
 * Monday 21 September 2026 at 10:05 store time, never from the wall clock.
 */
export const REFERENCE_DAY = { today: "Mon, Sep 21", tomorrow: "Tue, Sep 22", hour: 10, minute: 5 } as const;
