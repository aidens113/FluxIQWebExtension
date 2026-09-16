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
  ExtractedElementValue,
  FileInputOutcome,
  KeyboardCapability,
  ResolvedTarget,
  WaitConditionOutcome,
  WaitConditionRequest
} from "../action-runtime";
import type { ListExtractionOptions, ListExtractionOutcome } from "../extraction";
import type {
  BrowserActionCommand,
  BrowserActionResult,
  BrowserActionValidation,
  DomElementDescriptor,
  DomSnapshot,
  JsonObject,
  WebAutomationAssertRequest,
  WebAutomationDialogRequest,
  WebAutomationExtractListRequest,
  WebAutomationUploadFile
} from "../types";

export type ContentActionDependencies = {
  captureSnapshot(): DomSnapshot;
  /**
   * The element an action acts on, with the measurement that chose it.
   *
   * Both halves are the verb's to pass on: the element to act on, and the
   * resolution to put in the evidence it hands a result builder, which is how a
   * successful resolution's strategy, candidate count and scores reach a Flow
   * (D1). This returned a bare `Element` until 2026-09-12, and that signature
   * -- not a decision anyone wrote down -- is why every success reported nothing
   * about how sure the resolver was.
   */
  resolveTarget(action: BrowserActionCommand): ResolvedTarget;
  describeElement(element: Element): DomElementDescriptor;
  /** Reads a value off the target, or refuses to when the target is a sensitive control (D2). */
  extractElement(element: Element, options?: JsonObject): ExtractedElementValue;
  scrollElementIntoView(element: Element): void;
  setElementValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void;
  dispatchInputEvents(element: Element): void;

  /** Whether the target can be acted on, and where to hit it. */
  checkActionability(element: Element): ActionabilityReport;
  /** Per-character typing and key presses that perform a trusted event's default action. */
  keyboard: KeyboardCapability;
  /** Sets a checkbox or radio to a state rather than toggling it. */
  setCheckedState(element: Element, checked: boolean): CheckableStateOutcome;
  /** Reads a repeating structure into records, following pagination, within the command's `timeoutMs` when it names one. */
  extractList(request: WebAutomationExtractListRequest, options?: ListExtractionOptions): Promise<ListExtractionOutcome>;
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
