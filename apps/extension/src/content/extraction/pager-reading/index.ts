// Reading a pager for a read that pages: see `pager-reading.ts`; which page is
// current, `current-page.ts`; where a control leads, `page-address.ts`; the
// controls a page draws as plain elements, `drawn-control.ts`.
export { currentPageNumber, followingPageControl, isDisabled, readPager } from "./pager-reading";
export type { PagerReading } from "./pager-reading";
export { leadsToThisPage, linkAddress, sameDocument } from "./page-address";
export { pageDrawnControls } from "./drawn-control";
