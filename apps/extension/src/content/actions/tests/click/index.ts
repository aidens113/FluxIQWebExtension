// The click verb's test harness (`actions/tests/click.test.ts`, `click/tests/`):
// a faked page, faked watches, the dependencies the verb reads, and one press
// made through them. Split out of `click.test.ts` on 2026-10-20, when the
// page-reported-failure rows took it past the 800-line budget, so the tests can
// split by subject without copying the fakes.

export { dependencies, COVER_DETAIL, notPressable, PRESSABLE } from "./dependencies";
export { fakePage, installMouseEvent, LINK_HREF, PAGE, type FakePage, type PageBehaviour } from "./page";
export { click, CLICK, FIRST_PRESS, IGNORED, SECOND_PRESS, type PressOptions } from "./press";
export { fakeCheckWatch, fakeIgnoredWatch, fakeNoticeWatch, fakeWatch, type CheckRecord, type IgnoredRecord, type NoticeRecord, type WatchRecord } from "./watches";
