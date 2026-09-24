/**
 * What one action node of a Flow a build authored was actually made of, as a
 * created-Flow run's `snapshots/flow-lane.json` records it under
 * `authoredNodes`.
 *
 * **Why this exists.** The snapshot already carried `flowShape` -- how many
 * nodes, and how many of each output -- and nothing else about the Flow. That
 * is enough to say a Flow held one navigation node and one extraction node,
 * and never enough to say what either of them was told to do. Six live
 * `product-catalog` extract runs failed identically with `expectedRecords 8,
 * observedRecords 23`: the fixture serves eight products per page across three
 * pages, so the Flow had walked all three for an instruction that asked for the
 * first. Whether the model had authored `pagination: { mode: "next", maxPages:
 * 3 }`, or `mode: "numbered"`, or a scroll with a scroll cap, could not be read
 * from any artifact the run wrote -- no Flow document is persisted under
 * `test-runs/` -- and a fix shipped against an inferred cause did not work.
 * Two wrong diagnoses is what an unrecorded parameter costs.
 *
 * **What may travel.** Numbers, booleans, Core's and the domain's own closed
 * words, identifiers and the origin of an absolute URL. Never a selector, never
 * page text, never a value a person or a page supplied. The screen that decides
 * is the producer's (`test-runner`'s `creation/parameter-screen.ts`, which
 * follows Core's `AS/runtime/recovery/repair-context/parameter-screen.ts` and
 * uses Core's own key, locator and credential screens); this contract states
 * the envelope that screen must have produced, so a screen that regressed
 * fails a check rather than writing a page into a bundle.
 *
 * **A withheld value is named, never dropped silently.** `parametersWithheld`
 * holds the dotted path of every value the screen would not carry, and a value
 * that was screened out but whose key survives keeps its place in `parameters`
 * as `null`. So "this step authored no parameters" (`parameters` empty,
 * `parametersWithheld` empty) and "this step's parameters were screened out"
 * (a path in `parametersWithheld`) cannot be read as one another -- which is
 * the whole failure this record exists to end.
 */
export type AuthoredFlowNode = {
  /** The Flow node's id, which joins this entry to the run's own attempts in `actions[]`. */
  nodeId: string;
  /** The node definition the build placed (`web.output.dom-extract_list`), `null` when Core's document named none. */
  definitionId: string | null;
  /** The domain output the node dispatches, as `flowShape.actionTypes` counts it; `(unrecognized)` for a name that is not shaped like one. */
  outputId: string;
  /** The node's authored parameters, screened. A key whose value did not survive keeps its place with `null`. */
  parameters: Record<string, unknown>;
  /** The dotted path of each value the screen would not carry, in the order they were met, each once. Never the values themselves. */
  parametersWithheld: string[];
};

/** What an output name that is not shaped like one is recorded as, so no other text reaches the bundle. Mirrors the producer's own marker. */
export const AUTHORED_FLOW_NODE_UNRECOGNIZED_OUTPUT = "(unrecognized)";

/**
 * The bounds the screen's output must sit inside. They are the same numbers
 * Core's parameter screen enforces, restated here because this is the side that
 * checks rather than the side that produces: a producer that stopped applying
 * one of them must fail a validation, not merely differ from Core.
 */
export const AUTHORED_FLOW_NODE_BOUNDS = Object.freeze({
  /**
   * How deep a screened parameter tree may nest, counting array levels. A
   * backstop against a walk that stopped bounding itself, not a tight fit: the
   * producer's own recursion bound is lower, and it writes an array as
   * `{ count, items }`, which is two levels here for one there.
   */
  depth: 8,
  /** How many keys one screened object may carry. */
  keysPerObject: 12,
  /** How many items one screened array may carry beside its `count`. */
  itemsPerArray: 6,
  /** How long a carried string may be, unless it is an origin. */
  textLength: 80,
  /** How many withheld paths one node records. */
  withheldPaths: 16,
});
