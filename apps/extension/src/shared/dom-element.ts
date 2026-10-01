// The element descriptor: what a capture says about one element, on the wire
// between the content script, the background worker and the domain. Moved out
// of `protocol.ts`, which re-exports every name here, so a consumer keeps its
// one import of the wire seam.

export type RectDescriptor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DomElementDescriptor = {
  tagName: string;
  selector: string;
  xpath?: string | undefined;
  id?: string | undefined;
  classNames?: string[] | undefined;
  visibleText?: string | undefined;
  text?: string | undefined;
  value?: string | undefined;
  role?: string | undefined;
  name?: string | undefined;
  href?: string | undefined;
  inputType?: string | undefined;
  /**
   * A checkbox's or radio's checked state when it was described (B5). State
   * rather than a value, but for these two controls the state is everything
   * they hold, so a sensitive one reports none and no other control reports one.
   */
  checked?: boolean | undefined;
  hasValue?: boolean | undefined;
  selectedValue?: string | undefined;
  bounds?: RectDescriptor | undefined;
  documentBounds?: RectDescriptor | undefined;
  isVisibleOnViewport?: boolean | undefined;
  hasClickHandler?: boolean | undefined;
  attributes?: Record<string, string> | undefined;
  options?: Array<{ value: string; label: string }> | undefined;
  /** Identity signals, matching Core's fingerprint normalizer (Phase 1.3). */
  testId?: string | undefined;
  accessibleName?: string | undefined;
  label?: string | undefined;
  implicitRole?: string | undefined;
  context?: DomElementContext | undefined;
  /**
   * The element's fingerprint differs from the previous snapshot of this frame
   * (Phase 1.4). Optional rather than `false` by default: the first snapshot of
   * a frame has nothing to have changed from, and a producer that does not
   * compute it must not be read as saying "unchanged".
   */
  changed?: boolean | undefined;
  /** The element is among those most recently interacted with, by a person or by an action. */
  recentlyInteracted?: boolean | undefined;
  /**
   * How many elements of this one's kind the snapshot held, this one included:
   * the same control, link or cell in every row of one repeated list or table
   * (`content/repeat-exemplars.ts`). Present only on the run's first member --
   * the exemplar -- and only when there are at least two. An annotation only:
   * every member is listed, in document order (t200). Snapshot-scoped, like the
   * two flags above: it counts what one capture held.
   */
  repeatCount?: number | undefined;
  /**
   * The element, one of its seven nearest ancestors, or an open shadow host
   * above it is painted `position: fixed` or `sticky`: it is on a layer the
   * page paints over itself -- a consent banner, a sticky action bar, a chat
   * launcher (`content/evidence/front-layer.ts`). Present only when true. A
   * fact, not an order: every element stays where the page put it (t200).
   * Snapshot-scoped, like `repeatCount`.
   */
  frontLayer?: true | undefined;
  /**
   * The element is one of the main region's own short statements about what
   * the page shows -- "No results for ...", "1-16 of 42 results", "Your cart
   * is empty" (`content/evidence/lead-statements.ts`). Present only when true,
   * on every element the rule recognises, in document order (t200).
   * Snapshot-scoped, like `repeatCount`.
   */
  leadStatement?: true | undefined;
  /**
   * The element's own visible words, where `text` is all its descendants' (an
   * interactable or a semantic text element): present only when the two
   * differ, and `""` when it has no words of its own. Read under the same
   * sensitive-text rule as `text` (t223). Snapshot-scoped, like `repeatCount`.
   */
  ownText?: string | undefined;
  /**
   * The index, in the same snapshot's `interactiveElements`, of the element's
   * nearest listed ancestor in the composed tree (assigned slot, parent
   * element, shadow root host); the frame merge moves it to index the merged
   * list. Absent when no ancestor is listed (`content/listed-parents.ts`).
   * Snapshot-scoped: it is a position in one capture's list.
   */
  parent?: number | undefined;
  /**
   * The element is not rendered, and is listed only because the capture was
   * asked `includeHidden` (`content/rendered-elements.ts`). Present only when
   * true. Snapshot-scoped, like `repeatCount`.
   */
  hidden?: true | undefined;
};

/**
 * Where an element sits on the page, so two otherwise identical controls can be
 * told apart (Phase 1.3). Every field is optional: a producer emits only what
 * the element actually has.
 */
export type DomElementContext = {
  formId?: string | undefined;
  formName?: string | undefined;
  formAction?: string | undefined;
  fieldsetLegend?: string | undefined;
  /** The nearest landmark role, for example `main`, `navigation`, `search`. */
  landmark?: string | undefined;
  /**
   * That landmark's accessible name, where the page gave it one (B5). A role
   * alone cannot tell two `region`s on one page apart; their names can.
   */
  landmarkName?: string | undefined;
  /** The nearest preceding heading's text. */
  heading?: string | undefined;
  listPosition?: { index: number; total: number } | undefined;
  tablePosition?: { row: number; column: number; columnHeader?: string | undefined } | undefined;
  /**
   * The record -- a table row, a list item, a card -- the element belonged to,
   * where the page repeats one. A position says *where* the control was and a
   * fingerprint says *what* it was; on a page of 240 identical row actions
   * neither says *which*, so a replay resolved the recorded selector's
   * positional answer, agreed with it on every signal, and acted on another
   * record (`content/identity/record.ts`). This is what a replay checks the
   * answer against.
   *
   * `keyAttribute` travels with `key` so the page asks the candidate's record
   * for the same attribute rather than guessing. `text` is the fallback for a
   * record the author keyed by nothing, and is present only when the page held
   * more than one such record at capture time.
   *
   * `values` is never recorded: the domain writes it when a For Each pass runs
   * a step on the current row (`domain/src/output-nodes/native-runtime.ts`), as
   * the values the extraction read from that row. It takes precedence over
   * `key` and `text`, which name the row the Flow was built on, and the page
   * accepts a candidate only in a record holding every one of them.
   */
  record?: {
    keyAttribute?: string | undefined;
    key?: string | undefined;
    text?: string | undefined;
    values?: string[] | undefined;
  } | undefined;
  /**
   * The open shadow roots the element sat inside, outermost first, each named
   * by its host's selector within the tree that host sits in
   * (`content/selector/shadow-host-chain.ts`). A selector for an element in a
   * shadow tree is written within that tree, so on its own it names nothing in
   * the page: a chat widget's Close recorded as `div:nth-of-type(2) > div`
   * matched seven unrelated elements in the light document at replay. The
   * resolver walks this chain first and looks for the element only inside the
   * roots it reaches (`content/selector/shadow-scope.ts`). Absent for an
   * element in the document itself.
   */
  shadowHosts?: string[] | undefined;
};

/**
 * The five identity signals `DomElementDescriptor` groups above, named as a
 * union so both ends of the wire are joined to them by type rather than by
 * memory (Phase 1.3).
 *
 * They existed on the descriptor for a week without reaching the page: the
 * background worker's element projection was a hand-written key list, nobody
 * added them to it, and both sides' suites stayed green because a projection
 * that forgets a field compiles perfectly. The union and the two aliases below
 * are what make that failure a compile error instead.
 */
export type DomElementIdentitySignal = "testId" | "accessibleName" | "label" | "implicitRole" | "context";

/**
 * Descriptor fields the client-gateway element target deliberately does not
 * carry, each for a reason that survives being asked.
 *
 * - `hasValue`, `selectedValue` and `options` describe what a control *holds*.
 *   The recorded value travels as the event's own `inputValue`, which the
 *   sensitivity rule already governs, and a second copy of a control's contents
 *   on the target is a second place for a secret to escape from.
 * - `changed` and `recentlyInteracted` are snapshot-scoped (Phase 1.4): they
 *   say how one capture of a frame differs from the one before it, which is not
 *   a fact about the element a recorded event names.
 * - `repeatCount` is snapshot-scoped too: it counts how many rows one capture
 *   held, which a replay of the recorded control neither needs nor can check.
 * - `frontLayer` and `leadStatement` are snapshot-scoped the same way: they say
 *   where one capture found the element painted and what it said on that
 *   page, and only the snapshot's element list writes them.
 * - `ownText`, `parent` and `hidden` are the snapshot list's structure (t223):
 *   a position in one capture's list, and how that capture read the element's
 *   words and paint. A replay finds its target by identity, not by these.
 *
 * Nothing else may be left out silently. `WireElementTarget` is the descriptor
 * minus exactly this list, and the producer writes it through `present<T>()`,
 * so a field added to the descriptor stops the producer compiling until it is
 * either carried or named here.
 */
type UnwiredElementField =
  | "hasValue" | "selectedValue" | "options" | "changed" | "recentlyInteracted"
  | "repeatCount" | "frontLayer" | "leadStatement" | "ownText" | "parent" | "hidden";

/**
 * The recorded element's identity as it crosses the client gateway.
 *
 * This is the shape `background/connection/gateway-payloads.ts` sends and the
 * shape Core stores on a recording timeline entry, from which
 * `domain/src/output-nodes/targets.ts` `elementFingerprint` builds the element
 * every generated Flow replays against. A signal absent here is absent from
 * every replay, whatever the recorder captured.
 */
export type WireElementTarget = Omit<DomElementDescriptor, UnwiredElementField>;

/** A type that is only satisfiable when the argument is `never`. */
type Nothing<T extends never> = T;

/**
 * Compile-time proof that every identity signal crosses the wire: reclassify
 * one as `UnwiredElementField` and this alias stops compiling.
 *
 * A type rather than a test on purpose. The test beside the producer proves the
 * values arrive; this proves the *contract* cannot quietly stop asking for
 * them, which is the half a green suite has twice failed to notice.
 */
export type WiredIdentitySignals = Nothing<Exclude<DomElementIdentitySignal, keyof WireElementTarget>>;
