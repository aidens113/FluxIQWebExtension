import { createScenarioManifest } from "../../types.js";

/**
 * Two `Continue` buttons, and what it takes to tell them apart.
 *
 * The recorded workflow clicks the primary one by its test id. The two variants
 * both take that test id away and differ only in whether the page still says
 * which panel each button belongs to, so the pair isolates one question:
 * does context resolve the ambiguity?
 *
 * `no-context` is the corpus's negative row (W26). `form-context` is not in the
 * corpus; it is the other half of the same proof, and without it "ambiguous
 * without context" is a claim about a page nothing compares against.
 */
export const ambiguousTargetsManifest = createScenarioManifest({
  id: "ambiguous-targets", title: "Ambiguous targets", tags: ["targeting", "ambiguity"], seed: 106,
  startPath: "/scenarios/ambiguous-targets/", capabilities: ["forms"],
  recordingScript: [
    { id: "choose-primary", operation: "click", target: "testid:choice-primary" },
    { id: "primary-selected", operation: "waitForState", target: "testid:result", timeoutMs: 500 },
    { id: "selection-final", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [{ id: "duplicate-labels", subject: "document", predicate: "label-count:Email", value: 2 }],
    recordingEvents: [{ type: "web.element.clicked", count: 1 }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }],
    finalState: [{ id: "primary-selected", subject: "result", predicate: "text", value: "primary" }],
  },
  variants: [
    {
      id: "no-context",
      description: "The design system stopped emitting test ids and the two panels were merged into one unnamed group, so both Continue buttons share every signal a resolver reads and neither can be preferred.",
      arm: { operation: "set-mode", payload: { mode: "no-context" } },
      expected: {
        actions: [{ action: "web.dom.click" }],
        finalState: [
          { id: "recorded-testid-gone", subject: "choice-primary", predicate: "exists", value: false },
          { id: "nothing-selected", subject: "result", predicate: "text", value: "None" },
        ],
        failure: { category: "target_ambiguous", code: "web.target.ambiguous" },
      },
    },
    {
      id: "form-context",
      description: "The same two Continue buttons with the same test ids gone, each back inside its own named form and legend: the context is the only thing that can tell them apart, and it does.",
      arm: { operation: "set-mode", payload: { mode: "form-context" } },
      expected: {
        actions: [{ action: "web.dom.click", outcome: "succeeded" }],
        finalState: [
          { id: "recorded-testid-gone", subject: "choice-primary", predicate: "exists", value: false },
          { id: "context-selected-primary", subject: "result", predicate: "text", value: "primary" },
        ],
      },
    },
  ],
});
