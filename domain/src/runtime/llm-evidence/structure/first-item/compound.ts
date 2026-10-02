// One compound selector -- `div.x1a4yqcp.xa73opb`, `[data-testid="name"]`,
// `span:not([class])`, `div:nth-of-type(3)` -- as a test of one described
// element.
//
// Only the forms the page's detection writes are read (`apps/extension/src/
// content/extraction/item-selector.ts` and `infer-fields.ts`): a tag, classes,
// an attribute's presence, its exact value or its prefix, `:not([class])` and
// `:nth-of-type(n)`. Anything else -- an id, another pseudo-class, a combinator
// -- is not a compound this reads, and the answer is `undefined` rather than a
// guess, so a column whose element cannot be told is left without a handle.

/** What a compound is tested against: one element of a capture. */
export type WebLlmCompoundSubject = {
  /** The element's tag, lower case. */
  tag: string;
  /** Its attributes by lower-case name, as the packet published them. */
  attributes: Readonly<Record<string, string>>;
  /** Its place among its parent's children of its tag, from 1; `undefined` when the capture does not say. */
  typeIndex: number | undefined;
};

type Test = (subject: WebLlmCompoundSubject) => boolean;

const TAG = /^(?:\*|[A-Za-z][A-Za-z0-9-]*)/u;
const CLASS = /^\.([A-Za-z_-][\w-]*)/u;
const PRESENT = /^\[([A-Za-z_:][\w:.-]*)\]/u;
const VALUE = /^\[([A-Za-z_:][\w:.-]*)(\^?)="((?:[^"\\]|\\.)*)"\]/u;
const UNCLASSED = /^:not\(\[class\]\)/u;
const NTH_OF_TYPE = /^:nth-of-type\(([1-9][0-9]*)\)/u;

/** A test of one element for the compound, or `undefined` when the compound is empty or uses a form this does not read. */
export function webLlmCompoundMatcher(compound: string): Test | undefined {
  const tests: Test[] = [];
  let rest = compound;
  const tag = TAG.exec(rest);
  if (tag) {
    const name = tag[0].toLowerCase();
    if (name !== "*") tests.push((subject) => subject.tag === name);
    rest = rest.slice(tag[0].length);
  }
  while (rest !== "") {
    const step = nextTest(rest);
    if (step === undefined) return undefined;
    tests.push(step.test);
    rest = rest.slice(step.length);
  }
  if (tests.length === 0 && tag === null) return undefined;
  return (subject) => tests.every((test) => test(subject));
}

/** The test the compound's next part writes and how long that part is, or `undefined` for a part this does not read. */
function nextTest(rest: string): { test: Test; length: number } | undefined {
  const className = CLASS.exec(rest);
  if (className) {
    const wanted = className[1] as string;
    return { test: (subject) => classesOf(subject).includes(wanted), length: className[0].length };
  }
  const value = VALUE.exec(rest);
  if (value) {
    const name = (value[1] as string).toLowerCase();
    const prefix = value[2] === "^";
    const wanted = (value[3] as string).replace(/\\(.)/gu, "$1");
    return {
      test: (subject) => {
        const actual = attributeOf(subject, name);
        return actual !== undefined && (prefix ? actual.startsWith(wanted) : actual === wanted);
      },
      length: value[0].length
    };
  }
  const present = PRESENT.exec(rest);
  if (present) {
    const name = (present[1] as string).toLowerCase();
    return { test: (subject) => attributeOf(subject, name) !== undefined, length: present[0].length };
  }
  const unclassed = UNCLASSED.exec(rest);
  if (unclassed) return { test: (subject) => attributeOf(subject, "class") === undefined, length: unclassed[0].length };
  const nth = NTH_OF_TYPE.exec(rest);
  if (nth) {
    const index = Number(nth[1]);
    return { test: (subject) => subject.typeIndex === index, length: nth[0].length };
  }
  return undefined;
}

/** The attribute's value, read as the element's own only: a page's attribute named `constructor` is not the object's. */
function attributeOf(subject: WebLlmCompoundSubject, name: string): string | undefined {
  return Object.hasOwn(subject.attributes, name) ? subject.attributes[name] : undefined;
}

function classesOf(subject: WebLlmCompoundSubject): string[] {
  return (attributeOf(subject, "class") ?? "").split(/\s+/u).filter((name) => name !== "");
}
