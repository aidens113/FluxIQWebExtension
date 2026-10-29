// Tokens that pass the vocabulary filters yet are generic words or the names of
// real, public things, so the model-facing text may use them. Reviewed by hand:
// add a token only when a current Core string or template literal needs it, with
// the reason beside it. An entry that matches nothing in Core's literals is removed.

export const ALLOWED_TOKENS = [
  "Stars", // a generic rating word in instruction-choices.ts
  "Black", "Charcoal", "Silver", // colour words in instruction-choices.ts
  "Watchlist", // a generic list kind in kind-words.ts
  "Estimate", // a generic column word in flow-script-format.ts
  "Newsletter", // a generic word that shares a line with the retired Garden Club example
  "Thursday" // a calendar word in flow-script-format.ts
];

// Retired examples that are not in any fixture's strings but mirror a scenario's
// task shape (a group the user belongs to). The check fails if they return.
export const RETIRED_EXAMPLES = ["Garden Club"];
