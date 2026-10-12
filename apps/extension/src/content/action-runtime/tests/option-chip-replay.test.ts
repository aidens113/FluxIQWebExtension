// Saved option chips and swatches, found on a later page view (t436).
//
// R4a attempt 4 (`run-mv4912r9-53b05a51`, `reports/r4a-4-saved-chip-not-
// found.md`): the crossborder item page redraws its option groups' ids on
// every view, so a saved selector anchored on one misses on the next. The
// fingerprint's class-set lookup then answered with the first chip carrying
// the saved classes -- 4-in-1, always -- the veto rightly refused it, and the
// words that would have found 7-in-1 or Spain were never asked, because
// something had answered. Level 2 enumerated no `<div>` bound in script, so the
// step failed as "couldn't find it where it was saved" beside six chips.
//
// The fingerprints in the first rows are the ones the run dispatched,
// verbatim. The page is `option-chip-page.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { describeElement } from "../../describe-element";
import type { BrowserActionCommand } from "../../types";
import { resolveTarget, TargetResolutionError } from "../resolve-target";
import { FRESH_VIEW, OPTION_CLASSES, installOptionPicker } from "./option-chip-page";

const { chipOption, optionOn, swatch } = OPTION_CLASSES;

function check(element: Record<string, unknown>): BrowserActionCommand {
  return { commandId: "cmd-check", actionType: "web.dom.check", element } as unknown as BrowserActionCommand;
}

test("Spain, saved on exploration's page view, is the chip resolved on a fresh one (trial 1, step s10, as dispatched)", (t) => {
  const options = installOptionPicker(t, FRESH_VIEW);
  const resolved = resolveTarget(check({
    classNames: [chipOption], context: { landmark: "main" },
    selector: "#fb104wdzu > div:nth-of-type(2) > div:nth-of-type(2)", tagName: "div", visibleText: "Spain"
  }));
  assert.equal(resolved.element, options.get("Spain"));
  assert.equal(resolved.resolution.strategy, "scored-candidate", "the class set's matches and the words' were weighed, not the first taken");
  assert.ok((resolved.resolution.bestScore ?? 0) - (resolved.resolution.runnerUpScore ?? 0) >= 0.2);
});

test("7-in-1, saved while chosen and carrying the chosen class, is resolved where 4-in-1 is chosen, and 4-in-1 never is (replay, step s9)", (t) => {
  const options = installOptionPicker(t, FRESH_VIEW);
  const resolved = resolveTarget(check({
    classNames: [chipOption, optionOn], context: { landmark: "main" },
    selector: "#fbaudnsk > div:nth-of-type(2) > div:nth-of-type(2)", tagName: "div", visibleText: "7-in-1"
  }));
  assert.equal(resolved.element, options.get("7-in-1"));
  assert.notEqual(resolved.element, options.get("4-in-1"));
});

test("the fingerprint alone finds the saved chip among chips that share its classes, with no pointer or listener for Level 2 to see", (t) => {
  const options = installOptionPicker(t, { ...FRESH_VIEW, unmarked: true });
  const resolved = resolveTarget(check({
    classNames: [chipOption, optionOn], selector: "#fbaudnsk > div:nth-of-type(2) > div:nth-of-type(2)", tagName: "div", visibleText: "7-in-1"
  }));
  assert.equal(resolved.element, options.get("7-in-1"));
});

test("a swatch named only by its title, saved chosen, is resolved where another colour is chosen", (t) => {
  const options = installOptionPicker(t, FRESH_VIEW);
  const resolved = resolveTarget(check({
    accessibleName: "Silver", attributes: { title: "Silver" }, classNames: [swatch, optionOn],
    selector: "#fb1sh8ihu > div:nth-of-type(2) > div:nth-of-type(2)", tagName: "div"
  }));
  assert.equal(resolved.element, options.get("Silver"));
});

test("a saved option no chip on the page reads as is not found among the chips, never resolved to one, and never a tie", (t) => {
  installOptionPicker(t, FRESH_VIEW);
  const resolve = () => resolveTarget(check({
    classNames: [chipOption], selector: "#fbaudnsk > div:nth-of-type(2) > div:nth-of-type(4)", tagName: "div", visibleText: "12-in-1"
  }));
  assert.throws(resolve, (error: unknown) => {
    assert.ok(error instanceof TargetResolutionError);
    assert.equal(error.failure.code, "web.target.not_found");
    // Level 2 now weighs the chips and swatches the page bound in script.
    assert.match(error.failure.actual ?? "", /nothing matched; 9 control\(s\) of the same family are on the page/u);
    return true;
  });
});

test("an option described on one page view, while chosen, is resolved on a fresh view by what was saved", (t) => {
  const exploration = installOptionPicker(t, { view: 3, color: "Space Grey", spec: "7-in-1", origin: "Spain" });
  const saved = describeElement(exploration.get("7-in-1") as Element);
  assert.deepEqual(saved.classNames, [chipOption], "the class only the chosen chip carries is its state, not its identity");
  assert.equal(saved.attributes?.class, chipOption, "nor is it in the attributes a step built from a handle reads its classes from");
  assert.deepEqual(describeElement(exploration.get("4-in-1") as Element).classNames, [chipOption], "an option not set apart keeps its classes");
  const fresh = installOptionPicker(t, FRESH_VIEW);
  const resolved = resolveTarget(check({
    tagName: saved.tagName, selector: saved.selector, classNames: saved.classNames, visibleText: saved.visibleText, context: saved.context
  }));
  assert.equal(resolved.element, fresh.get("7-in-1"));
});
