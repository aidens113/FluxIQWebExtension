import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// The top bar's idle "Start recording" was red, so it read as "recording now"
// while nothing recorded. It is neutral like the other top-bar icons and red
// only on hover or keyboard focus; while a recording runs it is hidden and the
// recording bar says so (`record-control.ts`). The stylesheets cannot be
// rendered here, so their rules are read.

function panelRoot(): string {
  // The test runs from a bundle under `.test-build-scratch/<label>/`.
  let directory = path.dirname(fileURLToPath(import.meta.url));
  while (!existsSync(path.join(directory, "manifest.chrome.json"))) {
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error("apps/extension (manifest.chrome.json) not found above the test bundle");
    directory = parent;
  }
  return path.join(directory, "src", "panel");
}

/** Every selector that styles `.record-button`, with the declarations it sets. */
function recordRules(): Array<{ selector: string; body: string }> {
  const rules: Array<{ selector: string; body: string }> = [];
  for (const sheet of ["shell/shell.css", "recording/recording.css"]) {
    const text = readFileSync(path.join(panelRoot(), sheet), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const selector of match[1]!.split(",").map((part) => part.trim())) {
        if (selector.includes(".record-button")) rules.push({ selector, body: match[2]! });
      }
    }
  }
  return rules;
}

test("idle Start recording is not red: --danger only on hover or keyboard focus", () => {
  const red = recordRules().filter(({ body }) => /var\(--danger\)/u.test(body));
  assert.ok(red.length > 0, "the hover/focus red is still there");
  for (const { selector } of red) assert.match(selector, /:hover|:focus-visible/u, selector);
  for (const { selector } of red) assert.match(selector, /:not\(:disabled\)/u, `a disabled button never turns red: ${selector}`);
});

test("Start recording keeps the id and name the Lab presses it by", () => {
  const source = readFileSync(path.join(panelRoot(), "recording", "recording-controls.ts"), "utf8");
  assert.match(source, /id: "recordButton"/u);
  assert.match(source, /"aria-label": "Start recording"/u);
});
