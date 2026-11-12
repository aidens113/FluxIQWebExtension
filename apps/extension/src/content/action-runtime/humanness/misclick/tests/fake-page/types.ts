// Part of the page the misclick tests build by hand (`../misclick.test.ts`,
// `actions/tests/click/tests/misclick.test.ts`). Node has no DOM, so only what
// the misclick and the click verb read is faked; see `index.ts`.

import type { FakeElement } from "./fake-element";

export type Box = { left: number; top: number; right: number; bottom: number };
export type Style = { cursor?: string; position?: string; visibility?: string };

/** One event a fake element received, with the point it was dispatched at. */
export type FakeEvent = { type: string; on: string; x: number; y: number };

export type FakeElementInit = { attributes?: Record<string, string>; box?: Box; style?: Style; text?: string; onclick?: () => void; popoverOpen?: boolean };

export type FakeDocument = {
  readonly documentElement: FakeElement;
  readonly body: FakeElement;
  readonly location: { href: string };
  readonly defaultView: { innerWidth: number; innerHeight: number; getComputedStyle(element: FakeElement): Required<Style> };
  elementFromPoint(x: number, y: number): FakeElement | null;
  querySelectorAll(selector: string): FakeElement[];
};
