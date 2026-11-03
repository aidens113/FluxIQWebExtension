import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation";
import { WEB_AUTOMATION_DEFINITION_FIELDS_CAPABILITY_ID } from "../../capabilities";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../failure";
import { webDefinitionFieldCapabilityRefusal } from "..";

const FIELD = { kind: "text", definition: { term: "Edition", part: "value" } };
const PARAMETERS = { extractList: { item: "article.archive", fields: { edition: FIELD } } };
const session = (version: unknown, domainId = "web-automation") => ({ capabilities: [{ id: WEB_AUTOMATION_DEFINITION_FIELDS_CAPABILITY_ID, metadata: { version, domainId } }] });

test("semantic reads require an actual supported numeric capability on the selected session", () => {
  for (const unsupported of [undefined, null, {}, { capabilities: [] }, { capabilities: [{ id: WEB_AUTOMATION_DEFINITION_FIELDS_CAPABILITY_ID }] }, ...[undefined, null, "1", true, 0, -1, 0.5, 1.5, NaN, Infinity].map((version) => session(version)), session(1, "other-domain")]) {
    const refusal = webDefinitionFieldCapabilityRefusal("web.dom.extract_list", PARAMETERS, unsupported);
    assert.equal(refusal?.status, "failed");
    assert.equal(refusal?.failure.code, WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED);
    assert.equal(refusal?.failure.category, "blocked_by_capability_or_policy");
    assert.equal(refusal?.failure.retryable, false);
    assert.equal(refusal?.failure.transient, undefined, "NOT_IMPLEMENTED is permanent without the temporary-block marker");
    assert.deepEqual(parseAutomationStudioFailureRecord(refusal?.failure), refusal?.failure);
    assert.match(refusal?.message ?? "", /Update the selected browser extension/u);
    for (const content of ["article.archive", "Edition", "value"]) assert.equal(JSON.stringify(refusal).includes(content), false, content);
  }
  for (const version of [1, 2]) assert.equal(webDefinitionFieldCapabilityRefusal("web.dom.extract_list", PARAMETERS, session(version)), undefined);
});

test("active malformed anchors and predicate-only reads cannot be ignored by an old client", () => {
  for (const definition of [null, {}, "unsupported", { term: "Edition" }]) {
    assert.ok(webDefinitionFieldCapabilityRefusal("web.dom.extract_list", { extractList: { fields: { edition: { kind: "text", definition } } } }, undefined));
  }
  const predicate = { extractList: { fields: { name: "h3" }, where: [{ read: FIELD, is: "present" }] } };
  assert.ok(webDefinitionFieldCapabilityRefusal("web.dom.extract_list", predicate, undefined));
  assert.equal(webDefinitionFieldCapabilityRefusal("web.dom.extract_list", predicate, session(1)), undefined);
});

test("ordinary, excluded and inactive nontext fields keep their existing dispatch contract", () => {
  for (const parameters of [
    {}, { extractList: { fields: { name: "h3" } } },
    { extractList: { fields: { edition: { ...FIELD, handling: "exclude" } } } },
    { extractList: { fields: { edition: { ...FIELD, kind: "link" } } } },
    { extractList: { fields: { name: { kind: "text", definition: undefined } }, where: [{ field: "name", is: "present" }] } },
    { extractList: { fields: { name: "h3" }, where: [{ read: { ...FIELD, handling: "exclude" }, is: "present" }] } }
  ]) assert.equal(webDefinitionFieldCapabilityRefusal("web.dom.extract_list", parameters, undefined), undefined);
  assert.equal(webDefinitionFieldCapabilityRefusal("web.dom.capture_snapshot", PARAMETERS, undefined), undefined);
  assert.equal(webDefinitionFieldCapabilityRefusal("web.dom.click", PARAMETERS, undefined), undefined);
});
