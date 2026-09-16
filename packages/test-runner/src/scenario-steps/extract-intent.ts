// The extraction intent seam: an `extract` step asks **FluxIQ** to read the
// page, rather than the Lab reading it with Playwright.
//
// This is the whole point of the seam. `extract-records.ts` is a competent
// reader, but a run judged on what it returns measures the harness: every
// number it produces is the Lab marking its own homework, and a real defect in
// FluxIQ's extraction would leave the score untouched. So when the extension is
// loaded, the step is translated into a recorded extraction definition and
// handed to the background worker, which records `data.extract` and runs
// `web.dom.extract_list` through the same `runBrowserActionCommand` a replayed
// Flow uses. What comes back is the product's own read, and it is what the
// accuracy numbers are computed from. `extract-records.ts` stays as the
// reference reader for runs with no extension control page.
//
// **The message goes to the control page, never to the fixture.** The worker
// accepts `fluxiq.test.defineExtraction` from the extension's own side panel or
// popup and from nowhere else (`background/extraction/control.ts`), because it
// answers with the records: a page under test able to send it could drive
// FluxIQ's reader and read itself back out. That restriction is load-bearing,
// and this driver is built around it rather than against it.
//
// **No timeout is sent.** `confirmExtraction` bounds the read with
// `webAutomationExtractListTimeoutMs(request)`, a budget scaled by the pages
// the request may read; a flat ceiling there once truncated any read past six
// pages. A step's `timeoutMs` is the fixture's bound on a Playwright action,
// and imposing it here would let the harness decide how long the product is
// allowed to take -- which is the product's own budget, and part of what is
// being measured.
//
// **The field keys are the runner's field names, verbatim.** They are what
// `expected.extracted` names its columns, what the recorded definition carries
// into Core's dataset schema, and what the Flow lane compares against later, so
// deriving a different key here would silently mis-align all three. The domain
// owns the rule for what a key may be, and the one reader that applies it runs
// inside the extension: a name it will not take comes back as
// `invalid_definition` and is reported against the step, rather than being
// judged a second time by a copy of the rule kept here.

import type { Page } from "@playwright/test";
import type { ScenarioExtractPagination, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import {
  webAutomationDatasetId,
  type WebAutomationExtractFieldSpec,
  type WebAutomationExtractListPagination,
  type WebAutomationExtractListRequest,
  type WebAutomationRecordedListExtraction,
} from "@fluxiq-web-extension/domain/node";
import { RunnerFailure } from "../failure.js";
import type { ExtractionRecord, ObservedExtraction } from "../run-expectations/index.js";
import { cssSelectorForTarget } from "./css-selector.js";
import { parseExtractField, type ExtractField } from "./extract-records.js";
import { parseScenarioTarget, type ScenarioTarget } from "./parse-target.js";

/** The one message the background worker takes from the control page to define and run an extraction (X5.3). */
const DEFINE_EXTRACTION_MESSAGE = "fluxiq.test.defineExtraction";

/**
 * What makes a dataset id unique beside its name. One Lab run records each
 * extract step once and each step has its own id, so the id is already distinct
 * within a recording without a random part, and a deterministic definition is
 * one a test and a bench diff can both read. A caller recording two definitions
 * for the same step in one recording passes its own.
 */
const DEFAULT_NONCE = "lab";

/** What FluxIQ's own extraction returned for one step: the records, and the read's account of itself (contract C2). */
export type ExtractionIntentResult = { records: ExtractionRecord[] } & ObservedExtraction;

/** Drives one `extract` step through the extension. The scenario page is the tab the step runs on; the extension reads its own automation tab. */
export type ExtractionIntentDriver = (page: Page, step: ScenarioStep) => Promise<ExtractionIntentResult>;

export type ExtractionIntentDependencies = {
  /** The nonce each definition's dataset id is made unique with. */
  newNonce?: () => string;
};

/**
 * The recorded extraction an `extract` step means, in the domain's own shape.
 *
 * The runner grammar translates member for member: a `testid:` target becomes
 * `[data-testid="..."]` and a raw target stays the CSS it already is (both
 * through `parse-target.ts` and `css-selector.ts`, so the seam and the
 * reference reader cannot read the grammar differently); `selector@attribute`
 * becomes an `attribute` field; `column:<header>` becomes a `column` field;
 * `pagination` becomes `paginate`, by mode; and `minItems` is copied, so a
 * workflow declaring that an empty list is a valid answer still says so.
 *
 * A field is left `required`-less, which is the domain's optional reading: a
 * value the page cannot find arrives as `null` in its record rather than
 * failing the read. That is what `ExpectedExtraction.records` already spells
 * with `null`, and `optionalFields` -- which lives on the expectation, not on
 * the step -- is what decides whether a missing one matters.
 *
 * A `role:` or `frame:` target throws: the extraction request carries one CSS
 * selector in the page's main document and cannot express either, and quietly
 * reading such a step some other way would put the harness back in the
 * measurement.
 */
export function scenarioExtractionDefinition(step: ScenarioStep, nonce: string = DEFAULT_NONCE): WebAutomationRecordedListExtraction {
  const item = selectorFor(step.target, step, "its target");
  const entries = Object.entries(step.fields ?? {});
  if (entries.length === 0) throw new RunnerFailure("fixture.invalid", `Extract step ${step.id} names no fields`, { details: { stepId: step.id } });
  const fields: Record<string, WebAutomationExtractFieldSpec> = {};
  const fieldLabels: Record<string, string> = {};
  for (const [name, spec] of entries) {
    fields[name] = fieldSpec(parseExtractField(spec), step, name);
    fieldLabels[name] = name;
  }
  const paginate = step.pagination === undefined ? undefined : paginationFor(step.pagination, step);
  const request: WebAutomationExtractListRequest = {
    item,
    fields,
    ...(paginate !== undefined ? { paginate } : {}),
    ...(step.minItems !== undefined ? { minItems: step.minItems } : {}),
  };
  return {
    form: "list",
    datasetId: datasetIdFor(step, nonce),
    label: step.id,
    request,
    fieldLabels,
    // How many items the list held when it was recorded. The Lab defines the
    // extraction before it has read anything, so nothing has been counted yet;
    // the count the run yields is what the measurement judges.
    itemCount: 0,
  };
}

/**
 * Drives `extract` steps through the trusted extension control page, following
 * `createScriptedNavigationDriver`: the factory binds the control page once and
 * returns the function the step runner calls per step.
 *
 * The scenario page is accepted and not used. The extension extracts from its
 * own automation tab rather than from a page the Lab hands it, which is part of
 * why this measures the product: the Lab cannot substitute a tab, a frame or a
 * locator of its own into the read.
 */
export function createExtractionIntentDriver(extensionControlPage: Page, dependencies: ExtractionIntentDependencies = {}): ExtractionIntentDriver {
  const newNonce = dependencies.newNonce ?? (() => DEFAULT_NONCE);
  return async (_scenarioPage: Page, step: ScenarioStep): Promise<ExtractionIntentResult> => {
    const definition = scenarioExtractionDefinition(step, newNonce());
    const response = await send(extensionControlPage, { type: DEFINE_EXTRACTION_MESSAGE, definition });
    return intentResult(response, step);
  };
}

/**
 * The message is widened to a flat record at this boundary on purpose.
 * Playwright checks an `evaluate` argument for serializability structurally,
 * and walking the whole recorded-definition type -- which reaches the element
 * fingerprint and back into the action types -- exceeds the compiler's
 * instantiation depth. The call site above builds the message from a typed
 * definition, so the shape is still checked where it is written.
 */
async function send(page: Page, message: Record<string, unknown>): Promise<unknown> {
  return page.evaluate(async (request) => {
    const extensionGlobal = globalThis as typeof globalThis & { chrome: { runtime: { sendMessage(value: Record<string, unknown>): Promise<unknown> } } };
    return extensionGlobal.chrome.runtime.sendMessage(request);
  }, message);
}

/** One field spec. `column:` keeps its header, `@attribute` its attribute, and everything else reads text. */
function fieldSpec(field: ExtractField, step: ScenarioStep, name: string): WebAutomationExtractFieldSpec {
  if (field.kind === "column") return { kind: "column", header: field.header, handling: "include" };
  const selector = field.target === undefined ? undefined : requireSelector(field.target, step, `field ${JSON.stringify(name)}`);
  return {
    kind: field.attribute === undefined ? "text" : "attribute",
    ...(selector !== undefined ? { selector } : {}),
    ...(field.attribute !== undefined ? { attribute: field.attribute } : {}),
    handling: "include",
  };
}

/** The step's pagination in the domain's shape. Both vocabularies name the four modes the same way (D14), so each maps across whole. */
function paginationFor(pagination: ScenarioExtractPagination, step: ScenarioStep): WebAutomationExtractListPagination {
  if (pagination.mode === "scroll") return { mode: "scroll", maxScrolls: pagination.maxScrolls };
  if (pagination.mode === "loadMore") return { mode: "loadMore", control: selectorFor(pagination.control, step, "its loadMore control"), maxPages: pagination.maxPages };
  if (pagination.mode === "numbered") return { mode: "numbered", pages: selectorFor(pagination.pages, step, "its numbered page controls"), maxPages: pagination.maxPages };
  return { mode: "next", next: selectorFor(pagination.next, step, "its next control"), maxPages: pagination.maxPages };
}

function selectorFor(text: string | undefined, step: ScenarioStep, what: string): string {
  return requireSelector(parseScenarioTarget(text), step, what);
}

/**
 * The target as the one CSS selector an extraction request carries. A role or
 * frame target has none, and is refused here rather than read another way: the
 * request could not hold it, so no Flow built from this recording could repeat
 * the read either.
 */
function requireSelector(target: ScenarioTarget, step: ScenarioStep, what: string): string {
  const selector = cssSelectorForTarget(target);
  if (selector === undefined) {
    throw new RunnerFailure("fixture.invalid", `Extract step ${step.id} names ${what} as a ${target.kind} target, which an extraction request cannot carry: it takes one CSS selector in the page's main document`, {
      details: { stepId: step.id, targetKind: target.kind },
    });
  }
  return selector;
}

/** The dataset the records would be saved into, named after the step and made unique by the nonce, through the domain's own id rule. */
function datasetIdFor(step: ScenarioStep, nonce: string): string {
  try {
    return webAutomationDatasetId(step.id, nonce);
  } catch (error) {
    throw new RunnerFailure("fixture.invalid", `Extract step ${step.id} cannot name a dataset`, { cause: error, details: { stepId: step.id } });
  }
}

/** The worker's answer, or the failure it refused with. */
function intentResult(response: unknown, step: ScenarioStep): ExtractionIntentResult {
  if (isRefusal(response)) throw refusalFailure(response, step);
  if (!isRecord(response) || response.ok !== true || !Array.isArray(response.records)) {
    throw new RunnerFailure("extension.worker", `The extension returned no usable extraction answer for step ${step.id}`, { details: { stepId: step.id } });
  }
  const read = readRecords(response.records);
  return {
    records: read.records,
    nonStringValues: read.nonStringValues,
    ...(typeof response.pagesRead === "number" ? { pagesRead: response.pagesRead } : {}),
    ...(typeof response.truncated === "boolean" ? { truncated: response.truncated } : {}),
    ...(typeof response.durationMs === "number" ? { durationMs: response.durationMs } : {}),
  };
}

/**
 * The records, keeping each field the page reported as text and each it
 * reported as absent (`null`, D16), and counting everything else out.
 *
 * A value that is neither is counted rather than kept, as the Flow lane counts
 * its own: silently dropping one would let a record that did carry a value
 * match an expectation that omits the field. `null` is not counted, because it
 * is the answer an optional field gives and `ExpectedExtraction.records`
 * already spells it.
 */
function readRecords(entries: readonly unknown[]): { records: ExtractionRecord[]; nonStringValues: number } {
  const records: ExtractionRecord[] = [];
  let nonStringValues = 0;
  for (const entry of entries) {
    if (!isRecord(entry) || Array.isArray(entry)) {
      nonStringValues += 1;
      continue;
    }
    const values = Object.entries(entry);
    const kept = values.filter((pair): pair is [string, string | null] => typeof pair[1] === "string" || pair[1] === null);
    nonStringValues += values.length - kept.length;
    records.push(Object.fromEntries(kept));
  }
  return { records, nonStringValues };
}

/**
 * Why the worker would not run the read, in the facility's own taxonomy.
 *
 * A definition the domain refuses is the scenario's defect. A read that failed
 * on the page, or a frame that would not take the recorded definition, is the
 * automation behaving -- which is what the run is measuring, so it fails the
 * run rather than excusing it. Everything else is the worker or the seam: a
 * refusal to speak to this sender, or no tab to extract from, means the Lab
 * drove the seam wrongly and no measurement of the product was made at all.
 */
const REFUSAL_CATEGORIES = {
  invalid_definition: "fixture.invalid",
  page_refused: "action.dispatch",
  run_failed: "runtime.behavior",
  not_recording: "recording.persistence",
} as const;

function refusalFailure(refusal: { code: string; error?: unknown }, step: ScenarioStep): RunnerFailure {
  const category = Object.hasOwn(REFUSAL_CATEGORIES, refusal.code)
    ? REFUSAL_CATEGORIES[refusal.code as keyof typeof REFUSAL_CATEGORIES]
    : "extension.worker";
  const sentence = typeof refusal.error === "string" ? ` ${refusal.error}` : "";
  return new RunnerFailure(category, `The extension refused to extract for step ${step.id} (${refusal.code}).${sentence}`, {
    details: { stepId: step.id, reasonCode: refusal.code },
  });
}

function isRefusal(value: unknown): value is { ok: false; code: string; error?: unknown } {
  return isRecord(value) && value.ok === false && typeof value.code === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
