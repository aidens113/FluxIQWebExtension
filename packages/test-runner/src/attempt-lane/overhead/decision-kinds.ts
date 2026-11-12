/** How many of an attempt's model decisions were each kind. Every decision is counted once, in the first kind that fits. */
export type DecisionKinds = Readonly<{
  /** Asked what a node takes (`core.describe_nodes`, `web.describe_element`). */
  describe: number;
  /** The provider's answer was not a usable decision (`llm.provider_*`). */
  providerFormatError: number;
  /** The call or amendment was refused, or its rerun was (`refused`, `answer_first.no_reset`). */
  refused: number;
  /** Read-only: a search, a recall, a detection, or a read not added to the draft. */
  look: number;
  /** Everything else: a step added, an amendment, a run of the Flow, a completion. */
  step: number;
}>;
