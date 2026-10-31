import assert from "node:assert/strict";
import test from "node:test";
import { acceptAutomationStudioFlowBootstrapResult, parseAutomationStudioFlowScript } from "fluxiq/automation-studio";
import { exampleSupport } from "./support";

const { sections, blocks, registry, resolution } = exampleSupport;
const examples = [sections.format, sections.act, sections.loop, sections.state].flatMap(blocks);

test("all eleven authored web Example blocks remain present, in their original section order", () => {
  assert.deepEqual(examples.map(([name]) => name), [
    "Example:", "Example, narrowing with a control whose words are exactly the instruction's:", "Example, two situations the run can start in:",
    "Example, acting on one item:",
    "Example, reading every page of a list:", "Example, acting on each row a listing kept:", "Example, a loop the site asked to slow down:",
    "Example, starting where the page already is:", "Example, an interruption that can come at any pass:", "Example, a second known way, checked the same:",
    "Example, values read one by one, saved as one row:"
  ]);
});

for (const [name, script] of examples) {
  test(`${name} parses and accepts through the actual public web registry`, () => {
    assert.deepEqual(parseAutomationStudioFlowScript(script).issues.filter((issue) => issue.severity === "error"), []);
    const accepted = acceptAutomationStudioFlowBootstrapResult({ result: { flow: script }, registry, resolution });
    assert.equal(accepted.ok, true, JSON.stringify(accepted.issues));
    assert.deepEqual(accepted.issues.filter((issue) => issue.severity === "error"), []);
  });

  test(`${name} declares consequences on every press and sent form`, () => {
    for (const step of script.split(/\n(?=\s*step)/u)) {
      const lines = step.split("\n").map((line) => line.trim());
      const presses = lines.includes("node: web.dom.click") || (lines.includes("node: web.dom.type") && lines.includes("submit: true"));
      if (presses) assert.ok(lines.some((line) => line.startsWith("consequences:")), step);
    }
  });

  test(`${name} contains no realistic Lab scenario site or task vocabulary`, () => {
    const words = /friend|request|earbud|kettle|basket|cart\b|towel|napkin|dish soap|pickup|watchlist|bid\b|auction|coupon|connection|invitation|saved item|classified|giveaway|glaze|moon jar|quote|gas engineer|job|rust role|group post|feed|digest|open day|rating|shirt|colour|size\b|quantity|brightaisle|farbazaar|valueridge|kerbfind|guildline|hammerline|circleway|voltbay|tidewell/iu;
    assert.equal(script.match(words)?.[0], undefined);
  });
}

test("the base example demonstrates consequence declarations on actual presses", () => {
  const lines = sections.format.split("\n");
  const presses = lines.flatMap((line, index) => line.trim() === "node: web.dom.click" ? [index] : []);
  assert.ok(presses.length > 0);
  for (const index of presses) {
    const step: string[] = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const word = lines[next]?.trim() ?? "";
      if (word === "" || word.startsWith("step") || word.startsWith("subflow") || word === "end" || word.startsWith("flow:") || word.startsWith("Example")) break;
      step.push(word);
    }
    assert.ok(step.some((word) => word.startsWith("consequences:")));
  }
  assert.match(sections.act, /node: web\.dom\.type\n {2}target: t1\n {2}text: budget review\n {2}submit: true\n {2}consequences: none/u);
});
