// A step as a sentence: the verb from the action type, then the element's human
// name in quotes, from the table in the UI audit, section 4 ("Step
// sentences"). The name is `targetName`, which is never a selector; with no
// name, the verb stands alone ("Clicking a button"). `target`, which can be a
// selector, is never read here.

import type { BrowserActionType, RuntimeCommandStatus } from "../../shared/protocol";
import { pageHostname } from "./page-hostname";

type Tense = "present" | "past";
type StepWords = (name: string | undefined, runtime: RuntimeCommandStatus) => Record<Tense, string>;

// `targetName` is being added to RuntimeCommandStatus by workstream D; read it
// through this widening so this compiles before and after that lands.
type RuntimeWithName = RuntimeCommandStatus & { targetName?: string };

const named = (verb: Record<Tense, string>, fallback: Record<Tense, string>): StepWords =>
  (name) => name === undefined
    ? fallback
    : { present: `${verb.present} "${name}"`, past: `${verb.past} "${name}"` };

const fixed = (present: string, past: string): StepWords => () => ({ present, past });

// Every action type the domain can run has a sentence; a new one fails the
// build here instead of reaching a person as "Working on the page".
const STEPS = {
  "web.browser.navigate": (_name, runtime) => {
    const hostname = pageHostname(runtime.url);
    return hostname === undefined
      ? { present: "Opening a page", past: "Opened a page" }
      : { present: `Opening ${hostname}`, past: `Opened ${hostname}` };
  },
  "web.dom.click": named({ present: "Clicking", past: "Clicked" }, { present: "Clicking a button", past: "Clicked a button" }),
  "web.dom.type": named({ present: "Typing into", past: "Typed into" }, { present: "Typing into a field", past: "Typed into a field" }),
  "web.dom.clear": named({ present: "Clearing", past: "Cleared" }, { present: "Clearing a field", past: "Cleared a field" }),
  "web.dom.select": named(
    { present: "Choosing an option in", past: "Chose an option in" },
    { present: "Choosing an option", past: "Chose an option" }
  ),
  "web.dom.check": named({ present: "Ticking", past: "Ticked" }, { present: "Ticking a box", past: "Ticked a box" }),
  "web.dom.keypress": fixed("Pressing a key", "Pressed a key"),
  "web.dom.scroll": fixed("Scrolling the page", "Scrolled the page"),
  "web.dom.wait_for_selector": fixed("Waiting for the page", "Page was ready"),
  "web.dom.wait_for_text": fixed("Waiting for the page", "Page was ready"),
  "web.dom.extract": fixed("Reading data from the page", "Read data from the page"),
  "web.dom.extract_list": fixed("Reading data from the page", "Read data from the page"),
  "web.dom.capture_snapshot": fixed("Looking at the page", "Looked at the page"),
  "web.dom.assert": fixed("Checking the page", "Checked the page"),
  "web.dom.upload": fixed("Attaching files", "Attached files"),
  "web.dom.dialog": fixed("Answering a pop-up", "Answered a pop-up"),
  "web.browser.tab": fixed("Switching tabs", "Switched tabs"),
  "web.browser.download": fixed("Waiting for a download", "Download finished")
} satisfies Record<BrowserActionType, StepWords>;

const UNKNOWN: Record<Tense, string> = { present: "Working on the page", past: "Finished a step" };

/** The step `runtime` describes, as a sentence in `tense`. */
export function stepSentence(runtime: RuntimeCommandStatus, tense: Tense): string {
  const words = runtime.actionType === undefined ? undefined : (STEPS as Partial<Record<string, StepWords>>)[runtime.actionType];
  if (words === undefined) return UNKNOWN[tense];
  return words(humanName((runtime as RuntimeWithName).targetName), runtime)[tense];
}

function humanName(raw: string | undefined): string | undefined {
  const name = raw?.replace(/\s+/g, " ").trim();
  return name === undefined || name === "" ? undefined : name;
}
