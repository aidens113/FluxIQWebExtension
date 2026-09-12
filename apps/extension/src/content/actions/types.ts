// The capabilities every action verb in this directory receives from its
// caller. `action-runtime/` supplies them from the page.
//
// A verb never touches the DOM through a global of its own: everything it can
// do to the page arrives here, which is what lets a verb be read, reviewed, and
// tested as a decision rather than as a pile of DOM calls. The result builders
// are part of that contract -- a verb cannot construct a result itself, so it
// cannot report success without a validation.

import type {
  ActionabilityReport,
  ActionResultEvidence,
  AssertionOutcome,
  AssertionTarget,
  CheckableStateOutcome,
  DialogControl,
  FileInputOutcome,
  KeyboardCapability,
  ListExtractionOutcome,
  WaitConditionOutcome,
  WaitConditionRequest
} from "../action-runtime";
import type {
  BrowserActionCommand,
  BrowserActionResult,
  BrowserActionValidation,
  DomElementDescriptor,
  DomSnapshot,
  JsonObject,
  JsonValue,
  WebAutomationAssertRequest,
  WebAutomationDialogRequest,
  WebAutomationExtractListRequest,
  WebAutomationUploadFile
} from "../types";

export type ContentActionDependencies = {
  captureSnapshot(): DomSnapshot;
  resolveTarget(action: BrowserActionCommand): Element;
  describeElement(element: Element): DomElementDescriptor;
  extractElement(element: Element, options?: JsonObject): JsonValue;
  scrollElementIntoView(element: Element): void;
  setElementValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void;
  dispatchInputEvents(element: Element): void;

  /** Whether the target can be acted on, and where to hit it. */
  checkActionability(element: Element): ActionabilityReport;
  /** Per-character typing and key presses that perform a trusted event's default action. */
  keyboard: KeyboardCapability;
  /** Sets a checkbox or radio to a state rather than toggling it. */
  setCheckedState(element: Element, checked: boolean): CheckableStateOutcome;
  /** Reads a repeating structure into records, following pagination. */
  extractList(request: WebAutomationExtractListRequest): Promise<ListExtractionOutcome>;
  /** Puts files into a file input through a `DataTransfer`. */
  setInputFiles(element: Element, files: readonly WebAutomationUploadFile[]): FileInputOutcome;
  /** Arms the answer to the next native dialog, and reports the one that was handled. */
  dialogControl: DialogControl;
  /** Evaluates an authored `web.dom.assert` condition. */
  evaluateAssertion(request: WebAutomationAssertRequest, target: AssertionTarget): Promise<AssertionOutcome>;
  /** Waits for visible, enabled, absent, a URL, or the page to go quiet. */
  waitForCondition(request: WaitConditionRequest): Promise<WaitConditionOutcome>;

  /** Succeeds, or fails with `output_not_observed` when the validation did not hold. */
  success(
    action: BrowserActionCommand,
    startedAt: number,
    message: string,
    validation: BrowserActionValidation,
    evidence?: ActionResultEvidence
  ): BrowserActionResult;
  failure(action: BrowserActionCommand, error: unknown, startedAt?: number): BrowserActionResult;
  /** The target was disabled, hidden, or covered: ACTION_REJECTED with a code. */
  rejected(
    action: BrowserActionCommand,
    startedAt: number,
    code: string,
    expected: string,
    actual: string,
    evidence?: ActionResultEvidence
  ): BrowserActionResult;
  /** Ran out of time: status `timed_out`, never flattened to `failed`. */
  timedOut(
    action: BrowserActionCommand,
    startedAt: number,
    message: string,
    validation: BrowserActionValidation,
    evidence?: ActionResultEvidence
  ): BrowserActionResult;
  /** A registered verb that is not built yet. */
  notImplemented(action: BrowserActionCommand, startedAt: number, what: string): BrowserActionResult;
};
