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
  ClickPoint,
  DialogControl,
  ExtractedElementValue,
  FileInputOutcome,
  IgnoredPressWatch,
  InPlaceEffectWatch,
  KeyboardCapability,
  RateLimitNotice,
  RateLimitWatch,
  ResolvedTarget,
  RobotCheckSighting,
  RobotCheckWatch,
  WaitConditionOutcome,
  WaitConditionRequest
} from "../action-runtime";
import type { ListExtractionOptions, ListExtractionOutcome } from "../extraction";
import type { PageMove } from "../extraction/page-advance";
import type { SnapshotCaptureOptions } from "../../shared/snapshot-capture-options";
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
  WebAutomationStructureDetection,
  WebAutomationStructureDetectionRequest,
  WebAutomationUploadFile
} from "../types";
import type { WebAutomationTextSighting } from "@fluxiq-web-extension/domain/client";

export type ContentActionDependencies = {
  /** The page as it is now; `includeHidden` also lists what is not rendered, flagged `hidden`. */
  captureSnapshot(options?: SnapshotCaptureOptions): DomSnapshot;
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
  /** Sets a checkbox, a radio, or a control whose chosen state the page shows, to a state rather than toggling it; `point` is where a press lands. */
  setCheckedState(element: Element, checked: boolean, point?: ClickPoint): CheckableStateOutcome | Promise<CheckableStateOutcome>;
  /**
   * Detects the repeating structure around an element, or the page's largest,
   * as the picker would propose it. Reads nothing but structure, and waits,
   * bounded, for a page that has not drawn its list yet.
   */
  detectStructure(request: WebAutomationStructureDetectionRequest, timeoutMs?: number): Promise<WebAutomationStructureDetection>;
  /** Reads a repeating structure into records, following pagination, within the command's `timeoutMs` when it names one. */
  extractList(request: WebAutomationExtractListRequest, options?: ListExtractionOptions): Promise<ListExtractionOutcome>;
  /**
   * Moves a list to its next page, or says it has none (`web.dom.next_page`),
   * within the command's `timeoutMs`. In a document a press loaded, it answers
   * for that press instead, pressing nothing (`extraction/page-advance/`).
   */
  nextPage: PageMove;
  /** Puts files into a file input through a `DataTransfer`. */
  setInputFiles(element: Element, files: readonly WebAutomationUploadFile[]): FileInputOutcome;
  /** Arms the answer to the next native dialog, and reports the one that was handled. */
  dialogControl: DialogControl;
  /** Evaluates an authored `web.dom.assert` condition. */
  evaluateAssertion(request: WebAutomationAssertRequest, target: AssertionTarget): Promise<AssertionOutcome>;
  /** Waits for visible, enabled, absent, a URL, or the page to go quiet. */
  waitForCondition(request: WaitConditionRequest): Promise<WaitConditionOutcome>;
  /**
   * After a text wait or text assertion failed: whether the document holds the
   * text hidden or not at all, and the shown text most like it; `undefined`
   * when the page shows the text. Evidence only -- it never decides an outcome.
   */
  sightText(text: string): WebAutomationTextSighting | undefined;
  /**
   * Starts watching a link's document, from the moment of the press, for the
   * answer a page gives a link click it handles in script: a new address, or
   * changed content. Made just before the press; `settle` reads the answer.
   */
  watchInPlaceEffect(link: Element): InPlaceEffectWatch;
  /**
   * Starts watching, from just before a press on `pressed`, for a notice the
   * press opens saying the page refused it for going too fast. Made between the
   * hover and the press; `settle` reads the answer.
   */
  watchRateLimitNotice(pressed: Element): RateLimitWatch;
  /**
   * Starts watching, from just before a press on `pressed`, for a robot check
   * the press puts up on the page, and follows one that says it clears by
   * itself. Made between the hover and the press; `settle` reads the answer.
   */
  watchRobotCheck(pressed: Element): RobotCheckWatch;
  /**
   * Starts watching, from just before a press on `pressed`, for any sign the
   * page answered it at all: a request, a change inside the control's section,
   * a navigation, or focus moving elsewhere. Made between the hover and the
   * press; `settle` reads what was seen, and a press after which nothing was
   * is the one the click verb makes once more.
   */
  watchIgnoredPress(pressed: Element): IgnoredPressWatch;

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
  /** The page refused a press for going too fast: RATE_LIMITED, retryable, unacted, carrying the wait it named. */
  rateLimited(
    action: BrowserActionCommand,
    startedAt: number,
    notice: RateLimitNotice,
    evidence?: ActionResultEvidence
  ): BrowserActionResult;
  /** The page refused a press because it needs something first, and said so beside the control: REFUSED_BY_PAGE, not retryable, unacted. */
  refusedByPage(
    action: BrowserActionCommand,
    startedAt: number,
    notice: RateLimitNotice,
    evidence?: ActionResultEvidence
  ): BrowserActionResult;
  /**
   * A press the page answered with a robot check a person must answer:
   * USER_INTERVENTION_REQUIRED, saying the press itself was made.
   */
  needsPerson(
    action: BrowserActionCommand,
    startedAt: number,
    sighting: RobotCheckSighting,
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
