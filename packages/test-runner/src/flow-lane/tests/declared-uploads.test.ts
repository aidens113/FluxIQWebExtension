import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { Locator } from "@playwright/test";
import { WEB_AUTOMATION_EVENTS, webAutomationRecordedAction, webAutomationRecordedElementKey, webAutomationUploadStatePath } from "@fluxiq-web-extension/domain/node";
import { resolveScenarioWorkflow, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { loadScenarioManifests } from "../../scenarios.js";
import { deterministicUploadBytes, uploadDeterministicFile } from "../../trusted-input/index.js";
import { declaredUploadInputs, flowUploadRequests } from "../declared-uploads.js";
import type { FlowNodeRecord } from "../flow-action-types.js";

// dist/flow-lane/tests -> repository root, independent of the working directory.
const repositoryRoot = fileURLToPath(new URL("../../../../../", import.meta.url));

/**
 * W17's file choice as the extension records it now that it withholds a file
 * input's value: presence, and no file name. The visual target's state id is
 * what the domain keys the control by first, and it is deliberately not the
 * manifest's test id, so a runner keying by the manifest would be caught.
 */
const recordedChoice: Parameters<typeof webAutomationRecordedAction>[1] = {
  kind: "dom.change",
  url: "http://127.0.0.1:4173/scenarios/file-transfer/",
  title: "File transfer",
  sequence: 2,
  element: {
    tagName: "input", selector: "#upload-file", id: "upload-file", testId: "upload-file", inputType: "file", hasValue: true,
    accessibleName: "File to upload", label: "File to upload",
    attributes: { id: "upload-file", name: "file", type: "file", "aria-describedby": "upload-hint", "data-testid": "upload-file" },
  },
  visualTarget: { namespace: "web", statePath: "web.elements.input-upload-file-2", selector: "#upload-file" },
};

/** The node for that choice, carrying the parameters the domain maps it to. */
const recordedAction = webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.elementChanged, recordedChoice);
const uploadNode: FlowNodeRecord = { id: "node.upload", parameterValues: { outputId: recordedAction?.outputId, parameters: recordedAction?.parameters } };

/** The path the domain derives from the recorded control, computed from the recording itself rather than from the node. */
const domainKey = webAutomationRecordedElementKey(recordedChoice);
const domainPath = webAutomationUploadStatePath(domainKey ?? "");

const w17Steps: ScenarioStep[] = [
  { id: "choose-upload-file", operation: "upload", target: "testid:upload-file", value: "expense-receipts.csv" },
  { id: "submit-upload", operation: "click", target: "testid:upload-submit" },
];

test("W17's upload step is answered with the file the recording lane chose, under the path the domain derives from the recorded control", async () => {
  const manifest = (await loadScenarioManifests(repositoryRoot)).find((candidate) => candidate.id === "file-transfer");
  assert.ok(manifest, "the built Scenario Lab registry lists file-transfer");
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "upload" });
  const step = workflow.recordingScript.find((candidate) => candidate.operation === "upload");
  assert.ok(step && typeof step.value === "string", "W17 has an upload step naming its file");
  assert.equal(recordedAction?.outputId, "web.dom.upload", "the domain maps the recorded choice to an upload");

  const inputs = declaredUploadInputs({ scenarioId: manifest.id, steps: workflow.recordingScript, requests: flowUploadRequests([uploadNode]) });
  assert.deepEqual(Object.keys(inputs), [domainPath]);
  const files = inputs[domainPath]?.files ?? [];
  assert.deepEqual(files.map(({ name, mimeType }) => ({ name, mimeType })), [{ name: step.value, mimeType: "application/octet-stream" }]);

  // The recording lane's own writer: the bytes it hands the browser are the bytes the Flow is given.
  const directory = await mkdtemp(path.join(os.tmpdir(), "fluxiq-declared-uploads-"));
  try {
    let chosen: string | undefined;
    const control = { setInputFiles: async (filePath: string) => { chosen = filePath; } } as unknown as Locator;
    const recorded = await uploadDeterministicFile(control, step.value, directory);
    assert.ok(chosen, "the recording lane chose a file by path");
    const supplied = Buffer.from(files[0]?.contentBase64 ?? "", "base64");
    assert.equal(supplied.equals(await readFile(chosen)), true, "the supplied content is byte for byte the file the recording lane chose");
    assert.equal(createHash("sha256").update(supplied).digest("hex"), recorded.sha256);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("each request is read under the path the domain derives from its recorded control, and a node keyed any other way fails before the run", () => {
  assert.ok(domainKey, "the domain names the recorded control");
  assert.notEqual(domainPath, webAutomationUploadStatePath("upload-file"), "the state id, not the manifest's test id, keys the control");
  assert.deepEqual(flowUploadRequests([uploadNode]), [{ nodeId: "node.upload", path: domainPath, recordedElementPath: domainPath }]);

  const parameters = recordedAction?.parameters ?? {};
  const rekeyed: FlowNodeRecord = { id: "node.rekeyed", parameterValues: { outputId: "web.dom.upload", parameters: { ...parameters, upload: { $state: { path: "web.upload.upload-file" } } } } };
  assert.throws(
    () => declaredUploadInputs({ scenarioId: "file-transfer", steps: w17Steps, requests: flowUploadRequests([rekeyed]) }),
    (error: unknown) => error instanceof RunnerFailure
      && error.category === "recording.contract"
      && error.message.includes("node.rekeyed")
      && error.message.includes("web.upload.upload-file")
      && error.message.includes(domainPath),
  );
});

test("only an upload request asks for files, two nodes asking under one path get one input, and no request supplies nothing", () => {
  const secretNode: FlowNodeRecord = { id: "node.password", parameterValues: { outputId: "web.dom.type", parameters: { selector: "#password", text: { $state: { path: "web.secret.password" } }, element: { selector: "#password", testId: "password" } } } };
  const clickNode: FlowNodeRecord = { id: "node.submit", parameterValues: { outputId: "web.dom.click", parameters: { selector: "#upload-submit" } } };
  assert.deepEqual(flowUploadRequests([secretNode, clickNode, { id: "node.bare", parameterValues: undefined }]), []);

  // One choice recorded as both `input` and `change` gives two nodes on the same control.
  const inputs = declaredUploadInputs({ scenarioId: "file-transfer", steps: w17Steps, requests: flowUploadRequests([uploadNode, { ...uploadNode, id: "node.upload-input" }]) });
  assert.deepEqual(Object.keys(inputs), [domainPath]);
  assert.equal(inputs[domainPath]?.files.length, 1);

  // A recording that became no upload node is judged by the workflow's pinned web.dom.upload, not failed here.
  assert.deepEqual(declaredUploadInputs({ scenarioId: "file-transfer", steps: w17Steps, requests: [] }), {});
});

test("a request no single named file answers fails before the run, naming steps and paths, never a file's name or content", () => {
  const twoFiles: ScenarioStep[] = [
    { id: "choose-receipt", operation: "upload", target: "testid:upload-file", value: "receipt-one.csv" },
    { id: "choose-invoice", operation: "upload", target: "testid:other-file", value: "invoice-two.csv" },
  ];
  const leaks = ["receipt-one", "invoice-two", "FluxIQ deterministic upload", deterministicUploadBytes("receipt-one.csv").toString("base64"), deterministicUploadBytes("invoice-two.csv").toString("base64")];
  const failsNaming = (named: string) => (error: unknown) => {
    if (!(error instanceof RunnerFailure) || error.category !== "fixture.invalid") return false;
    const serialized = JSON.stringify({ message: error.message, details: error.details });
    return serialized.includes(domainPath) && serialized.includes(named) && leaks.every((leak) => !serialized.includes(leak));
  };
  assert.throws(() => declaredUploadInputs({ scenarioId: "file-transfer", steps: twoFiles, requests: flowUploadRequests([uploadNode]) }), failsNaming("choose-receipt, choose-invoice"));
  assert.throws(() => declaredUploadInputs({ scenarioId: "file-transfer", steps: w17Steps.slice(1), requests: flowUploadRequests([uploadNode]) }), failsNaming("(none)"));
});
