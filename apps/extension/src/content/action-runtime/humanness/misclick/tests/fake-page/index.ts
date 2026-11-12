// Barrel for the misclick tests' hand-built page: elements with boxes,
// attributes, styles and children (`fake-element.ts`), a viewport with a hit
// test and an event record (`fake-page.ts`), the few selectors they match
// (`selector-match.ts`), and the globals Node lacks (`page-globals.ts`).
export { FakeElement } from "./fake-element";
export { FakePage } from "./fake-page";
export { installPageGlobals } from "./page-globals";
export { matchesFakeSelector } from "./selector-match";
export type { FakeDocument, FakeElementInit, FakeEvent } from "./types";
