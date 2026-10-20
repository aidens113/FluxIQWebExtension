// What a model reads about the scroll node's request (`../definitions.ts`,
// `SCROLL_REQUEST_DESCRIPTION`). Social `run-mvgf7ij5-a9747575` (t738): the
// `scroll` parameter carried neither description nor example, so the model
// wrote keys the request does not have and was refused at run time.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationScrollRequestIssues } from "../../actions/scroll-request-issues";
import { webAutomationOutputNodeDefinitions } from "../definitions";

function scrollParameter() {
  const node = webAutomationOutputNodeDefinitions.find((definition) => definition.outputAction?.fixedOutputId === "web.dom.scroll");
  assert.ok(node, "the scroll node is registered");
  const parameter = node.parameters.find((entry) => entry.id === "scroll");
  assert.ok(parameter, "the scroll node has a scroll parameter");
  return parameter;
}

test("the scroll parameter names its modes and keys, and that untilStable needs maxScrolls", () => {
  const parameter = scrollParameter();
  assert.equal(parameter.valueType, "object", "Core shows the description and example of an object parameter only");
  const description = parameter.description ?? "";
  const said = description.split(/[^A-Za-z]+/u);
  for (const word of ["mode", "by", "toElement", "untilStable", "maxScrolls", "x", "y"]) assert.equal(said.includes(word), true, `the description names ${word}`);
  assert.match(description, /untilStable requires maxScrolls/u);
});

test("the scroll parameter's example is a request the dispatch reads with no issue", () => {
  const parameter = scrollParameter();
  assert.notEqual(parameter.example, undefined);
  assert.deepEqual(webAutomationScrollRequestIssues(parameter.example), []);
  assert.equal((parameter.example as { mode?: unknown }).mode, "untilStable");
});
