// The preview table says what it is and what an empty cell means.
//
// The sheet's builder names the table "Extraction preview"; the renderer keeps
// native column headers, writes page text as text, draws at most five rows,
// and says "No value" for a missing, null or empty cell -- the three are one
// state to the preview, so one wording, never a bare dash.

import assert from "node:assert/strict";
import test from "node:test";
import { buildExtractionPanel } from "../panel-elements";
import { renderExtractionPreview } from "../preview-table";
import type { ExtractionFieldRow } from "../view-model";
import { withDialogDom } from "./dialog-dom";

type World = Parameters<Parameters<typeof withDialogDom>[0]>[0];
type DialogNode = ReturnType<World["document"]["createElement"]>;

const columns = [
  { sourceKey: "name", label: "Name" },
  { sourceKey: "price", label: "Price" }
] as unknown as ExtractionFieldRow[];

function cells(body: DialogNode): string[][] {
  return body.children.map((row) => row.children.map((cell) => cell.textContent));
}

test("the sheet names its preview table and keeps the note a polite status", async () => withDialogDom((world) => {
  const els = buildExtractionPanel(world.native(world.host));
  const table = world.get("extractionPreviewTable");
  assert.equal(els.previewTable as unknown, table);
  assert.equal(table.tagName, "TABLE");
  assert.equal(table.getAttribute("aria-label"), "Extraction preview");
  assert.equal(table.className, "extraction-preview");
  assert.equal(table.contains(world.get("extractionPreviewHead")), true);
  assert.equal(table.contains(world.get("extractionPreviewBody")), true);
  const note = world.get("extractionPreviewNote");
  assert.equal(note.getAttribute("role"), "status");
  assert.equal(note.getAttribute("aria-live"), "polite");
  assert.equal(note.getAttribute("aria-atomic"), "true");
  assert.equal(world.get("extractionPanel").getAttribute("aria-labelledby"), "extractionTitle", "the dialog keeps its own name");
}));

test("headers stay native column headers with the column labels", async () => withDialogDom((world) => {
  const els = buildExtractionPanel(world.native(world.host));
  renderExtractionPreview(els.previewHead, els.previewBody, columns, [{ name: "One", price: "1" }]);
  const head = world.get("extractionPreviewHead").children;
  assert.deepEqual(head.map((cell) => [cell.tagName, (cell as unknown as { scope: string }).scope, cell.textContent]), [["TH", "col", "Name"], ["TH", "col", "Price"]]);
}));

test("missing, null and empty cells all read No value and keep the empty class", async () => withDialogDom((world) => {
  const els = buildExtractionPanel(world.native(world.host));
  const rows = [{ name: "Shown" }, { name: null, price: "" }] as never;
  renderExtractionPreview(els.previewHead, els.previewBody, columns, rows);
  const body = world.get("extractionPreviewBody");
  assert.deepEqual(cells(body), [["Shown", "No value"], ["No value", "No value"]]);
  const empty = body.descendants().filter((cell) => cell.className.split(" ").includes("extraction-preview-empty"));
  assert.equal(empty.length, 3, "the Lab reads an empty cell by this class");
  assert.equal(body.textContent.includes("--"), false);
}));

test("page text stays text, five rows at most, inputs untouched and excluded keys never drawn", async () => withDialogDom((world) => {
  const els = buildExtractionPanel(world.native(world.host));
  const rows = Array.from({ length: 7 }, (_, index) => ({ name: `<b>row ${index}</b>`, price: "--", card: "4242424242424242" }));
  const before = JSON.stringify(rows);
  assert.equal(renderExtractionPreview(els.previewHead, els.previewBody, columns, rows), 5);
  const body = world.get("extractionPreviewBody");
  assert.equal(body.children.length, 5);
  assert.equal(cells(body)[0]![0], "<b>row 0</b>");
  assert.equal(cells(body)[0]![1], "--", "a literal page value is shown as it is, not as an empty cell");
  assert.equal(body.textContent.includes("4242424242424242"), false);
  assert.equal(JSON.stringify(rows), before);
}));
