// The upload verb's post-condition, on its own: it passes only when the input
// holds exactly the requested names, and neither side of it quotes a name.
//
// A chosen file's name is the user's data. The Lab found W17's file name at
// rest in Core's saved command attempt, at the upload validation's `expected`
// and `actual`, because the verb listed the names there. The live proof that a
// real input holds the file is e2e/content/tests/upload-dialog.spec.ts; these
// rows pin every shape that harness does not reach -- two files, a different
// name at the same count, a short or empty input, a reordered one -- and hold
// every text the verb hands a result builder free of every name involved.
//
// The verb takes each page capability as an injected dependency, so this runs
// in Node with no DOM: the fakes record what the verb handed the builders.

import assert from "node:assert/strict";
import test from "node:test";
import { uploadAction } from "../upload";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";

type Deps = ContentActionDependencies;
type FileInputOutcome = ReturnType<Deps["setInputFiles"]>;

type Built =
  | { builder: "success"; message: string; validation: BrowserActionValidation }
  | { builder: "rejected"; code: string; expected: string; actual: string };

const RECEIPTS = "expense-receipts.csv";
const TRAVEL = "travel-2025.pdf";
const UNREQUESTED = "someone-elses-file.txt";

function upload(requested: readonly string[], outcome: FileInputOutcome): Built {
  let built: Built | undefined;
  const deps: Pick<Deps, "resolveTarget" | "describeElement" | "captureSnapshot" | "setInputFiles" | "success" | "rejected"> = {
    resolveTarget: () => ({ element: {} as Element, resolution: {} as ReturnType<Deps["resolveTarget"]>["resolution"] }),
    describeElement: () => ({}) as ReturnType<Deps["describeElement"]>,
    captureSnapshot: () => ({}) as ReturnType<Deps["captureSnapshot"]>,
    setInputFiles: () => outcome,
    success: (_action, _startedAt, message, validation) => {
      built = { builder: "success", message, validation };
      return {} as BrowserActionResult;
    },
    rejected: (_action, _startedAt, code, expected, actual) => {
      built = { builder: "rejected", code, expected, actual };
      return {} as BrowserActionResult;
    }
  };
  const files = requested.map((name) => ({ name, mimeType: "text/plain", contentBase64: "aGk=" }));
  const action = { commandId: "upload", actionType: "web.dom.upload", selector: "#upload-file", upload: { files } } as BrowserActionCommand;
  uploadAction(action, deps as Deps, 0);
  assert.ok(built, "the verb handed no result builder anything");
  return built;
}

/** No text the verb built quotes any name it was asked for or found on the input. */
function assertQuotesNoName(built: Built, names: readonly string[]): void {
  const texts = built.builder === "success"
    ? [built.message, built.validation.status === "none" ? "" : `${built.validation.expected ?? ""}\n${built.validation.actual ?? ""}`]
    : [built.expected, built.actual];
  for (const text of texts) {
    for (const name of names) assert.equal(text.includes(name), false, `a validation text quotes the file name ${name}: ${text}`);
  }
}

test("an input holding exactly the requested file passes, and neither side names it", () => {
  const built = upload([RECEIPTS], { ok: true, fileNames: [RECEIPTS] });
  assert.deepEqual(built, {
    builder: "success",
    message: "Files uploaded.",
    validation: { status: "passed", expected: "1 file, named as requested", actual: "1 file, named as requested" }
  });
  assertQuotesNoName(built, [RECEIPTS]);
});

test("two requested files held in order pass, counted rather than listed", () => {
  const built = upload([RECEIPTS, TRAVEL], { ok: true, fileNames: [RECEIPTS, TRAVEL] });
  assert.deepEqual(built.builder === "success" && built.validation, { status: "passed", expected: "2 files, named as requested", actual: "2 files, named as requested" });
  assertQuotesNoName(built, [RECEIPTS, TRAVEL]);
});

test("a different file at the same count fails, and names neither the requested file nor the one held", () => {
  const built = upload([RECEIPTS], { ok: true, fileNames: [UNREQUESTED] });
  assert.deepEqual(built.builder === "success" && built.validation, { status: "failed", expected: "1 file, named as requested", actual: "1 file, not named as requested" });
  assertQuotesNoName(built, [RECEIPTS, UNREQUESTED]);
});

test("an input holding fewer files than requested, or none, fails", () => {
  const short = upload([RECEIPTS, TRAVEL], { ok: true, fileNames: [RECEIPTS] });
  assert.deepEqual(short.builder === "success" && short.validation, { status: "failed", expected: "2 files, named as requested", actual: "1 file, not named as requested" });
  assertQuotesNoName(short, [RECEIPTS, TRAVEL]);

  const empty = upload([RECEIPTS], { ok: true, fileNames: [] });
  assert.deepEqual(empty.builder === "success" && empty.validation, { status: "failed", expected: "1 file, named as requested", actual: "no files" });
  assertQuotesNoName(empty, [RECEIPTS]);
});

test("the requested names in another order are not exactly the requested names", () => {
  const built = upload([RECEIPTS, TRAVEL], { ok: true, fileNames: [TRAVEL, RECEIPTS] });
  assert.deepEqual(built.builder === "success" && built.validation, { status: "failed", expected: "2 files, named as requested", actual: "2 files, not named as requested" });
  assertQuotesNoName(built, [RECEIPTS, TRAVEL]);
});

test("a refused target is a rejection whose expected side names no file", () => {
  const reason = "the target is a button, not a file input";
  const built = upload([RECEIPTS], { ok: false, reason });
  assert.deepEqual(built, { builder: "rejected", code: "upload_rejected", expected: "1 file, named as requested", actual: reason });
  assertQuotesNoName(built, [RECEIPTS]);
});
