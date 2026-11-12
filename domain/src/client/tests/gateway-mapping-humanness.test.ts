// A run's humanness rides the gateway command onto the action the page runs
// (`webAutomationActionFromGatewayCommand`): passed through as Core sent it when it
// is a number (the content script normalises it as it reads it), absent otherwise,
// so a run that sets none maps to the action it always did.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationActionFromGatewayCommand } from "../gateway-mapping";

const click = { commandId: "command.click", actionType: "web.dom.click", parameters: { selector: "#buy" } };

test("a command's humanness is copied onto the action, 0 included", () => {
  assert.equal((webAutomationActionFromGatewayCommand({ ...click, humanness: 60 }) as { humanness?: number }).humanness, 60);
  assert.equal((webAutomationActionFromGatewayCommand({ ...click, humanness: 0 }) as { humanness?: number }).humanness, 0);
});

test("any number is passed through unchanged, for the content script to normalise", () => {
  const read = (humanness: number) => (webAutomationActionFromGatewayCommand({ ...click, humanness }) as { humanness?: number }).humanness;
  assert.equal(read(140), 140);
  assert.equal(read(41.6), 41.6);
});

test("a command with no humanness, or a non-number one, maps to the action it always did", () => {
  const plain = webAutomationActionFromGatewayCommand(click);
  assert.equal("humanness" in plain, false);
  assert.equal("humanness" in webAutomationActionFromGatewayCommand({ ...click, humanness: "60" } as unknown as typeof click), false);
  // A key present but undefined, as a sender that spreads an unset value would send it.
  assert.deepEqual(webAutomationActionFromGatewayCommand({ ...click, humanness: undefined } as unknown as typeof click), plain);
});

test("Core's misclick mark is copied onto the action only when it is exactly true", () => {
  const marked = webAutomationActionFromGatewayCommand({ ...click, humanness: 60, humannessMisclick: true }) as { humannessMisclick?: unknown };
  assert.equal(marked.humannessMisclick, true);
  const unmarked = webAutomationActionFromGatewayCommand({ ...click, humanness: 60 });
  assert.equal("humannessMisclick" in unmarked, false);
  const { humannessMisclick: _mark, ...markedWithout } = marked as Record<string, unknown>;
  assert.deepEqual(markedWithout, unmarked);
  for (const other of [false, "true", 1, null]) {
    const mapped = webAutomationActionFromGatewayCommand({ ...click, humanness: 60, humannessMisclick: other } as unknown as typeof click);
    assert.equal("humannessMisclick" in mapped, false, `${JSON.stringify(other)} added the mark`);
  }
});
