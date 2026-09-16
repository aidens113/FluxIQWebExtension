// One editable column in the extraction panel: its name, what it reads, and
// whether it is included, excluded or removed.
//
// Every string that came off the page -- a column's label, a table header, an
// attribute name -- is written with `textContent` or `value`, never as markup.
// The panel is rendered inside the extension's own document, so page text that
// reached it as markup would run there with the extension's privileges.
//
// The Exclude control carries D12's explanation as a hover, and the picker's
// pre-selection is shown as a reason rather than left to look arbitrary: a user
// who cannot see *why* a column opened excluded learns to switch it back without
// reading it.
//
// Encrypt (D13) is not offered. It is reserved in the contracts and built with
// Core's K11 in Week 3, and an option that is refused at dispatch is worse than
// an option that is not there.

import type { WebAutomationExtractFieldKind } from "@fluxiq-web-extension/domain/client";
import { extractionFieldKindOptions, type ExtractionFieldHandling, type ExtractionFieldRow } from "./view-model";

/** What the panel does with an edit the user makes to one column. */
export type ExtractionFieldEdits = {
  rename(sourceKey: string, label: string): void;
  changeKind(sourceKey: string, kind: WebAutomationExtractFieldKind): void;
  changeHandling(sourceKey: string, handling: ExtractionFieldHandling): void;
  remove(sourceKey: string): void;
};

/** D12's hover: what Exclude is for, in the words the decision fixes. */
const EXCLUDE_HINT =
  "Exclude a column of private information -- a password, a card number, "
  + "personal details you don't want collected. An excluded column is never read "
  + "from the page, so it is in no dataset, no preview, no export and no saved run.";

const SENSITIVE_HINT = "FluxIQ pre-selected Exclude because this looks like a password or another sensitive field. You can include it.";

/** The row element for `field`, with every control wired to `edits`. */
export function extractionFieldRowElement(field: ExtractionFieldRow, edits: ExtractionFieldEdits): HTMLElement {
  const row = document.createElement("div");
  row.className = "extraction-field";
  row.dataset.field = field.sourceKey;
  row.append(nameRow(field, edits), metaRow(field, edits), handlingRow(field, edits));
  if (field.sensitive) {
    const reason = document.createElement("p");
    reason.className = "extraction-field-reason";
    reason.textContent = SENSITIVE_HINT;
    row.append(reason);
  }
  return row;
}

function nameRow(field: ExtractionFieldRow, edits: ExtractionFieldEdits): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "extraction-field-name";

  const name = document.createElement("input");
  name.type = "text";
  name.className = "extraction-field-label";
  name.spellcheck = false;
  name.autocomplete = "off";
  name.value = field.label;
  name.setAttribute("aria-label", "Column name");
  name.addEventListener("change", () => edits.rename(field.sourceKey, name.value.trim() || field.label));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "small-button extraction-field-remove";
  remove.textContent = "Remove";
  remove.title = "Remove this column from the extraction";
  remove.addEventListener("click", () => edits.remove(field.sourceKey));

  wrap.append(name, remove);
  return wrap;
}

function metaRow(field: ExtractionFieldRow, edits: ExtractionFieldEdits): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "extraction-field-meta";

  const kind = document.createElement("select");
  kind.className = "extraction-field-kind";
  kind.setAttribute("aria-label", "What this column reads");
  for (const option of extractionFieldKindOptions(field)) {
    const choice = document.createElement("option");
    choice.value = option;
    choice.textContent = kindLabel(field, option);
    choice.selected = option === field.kind;
    kind.append(choice);
  }
  kind.addEventListener("change", () => edits.changeKind(field.sourceKey, kind.value as WebAutomationExtractFieldKind));

  const coverage = document.createElement("span");
  coverage.className = "extraction-field-coverage";
  coverage.textContent = coverageLabel(field.coverage);

  wrap.append(kind, coverage);
  return wrap;
}

function handlingRow(field: ExtractionFieldRow, edits: ExtractionFieldEdits): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "extraction-field-handling";
  wrap.setAttribute("role", "radiogroup");
  wrap.setAttribute("aria-label", `How to handle ${field.label}`);
  wrap.append(
    handlingChoice(field, "include", "Include", edits),
    handlingChoice(field, "exclude", "Exclude", edits),
    excludeHint()
  );
  return wrap;
}

function handlingChoice(field: ExtractionFieldRow, handling: ExtractionFieldHandling, text: string, edits: ExtractionFieldEdits): HTMLLabelElement {
  const label = document.createElement("label");
  const choice = document.createElement("input");
  choice.type = "radio";
  choice.name = `extraction-handling-${field.sourceKey}`;
  choice.value = handling;
  choice.checked = field.handling === handling;
  choice.addEventListener("change", () => {
    if (choice.checked) edits.changeHandling(field.sourceKey, handling);
  });
  const caption = document.createElement("span");
  caption.textContent = text;
  label.append(choice, caption);
  return label;
}

/** The hover beside Exclude. It is focusable so the explanation is reachable without a mouse. */
function excludeHint(): HTMLElement {
  const mark = document.createElement("span");
  mark.className = "info-hint";
  mark.tabIndex = 0;
  mark.title = EXCLUDE_HINT;
  mark.setAttribute("role", "note");
  mark.setAttribute("aria-label", EXCLUDE_HINT);
  mark.textContent = "i";
  return mark;
}

function kindLabel(field: ExtractionFieldRow, kind: WebAutomationExtractFieldKind): string {
  switch (kind) {
    case "text":
      return "Its text";
    case "link":
      return "Where its link goes";
    case "value":
      return "What is typed in it";
    case "attribute":
      return field.attribute === undefined ? "An attribute" : `Its ${field.attribute} attribute`;
    case "column":
      return field.header === undefined ? "A table column" : `The ${field.header} column`;
  }
}

function coverageLabel(coverage: number): string {
  const share = Math.round(Math.min(Math.max(coverage, 0), 1) * 100);
  return share >= 100 ? "in every item" : `in ${share}% of items`;
}
