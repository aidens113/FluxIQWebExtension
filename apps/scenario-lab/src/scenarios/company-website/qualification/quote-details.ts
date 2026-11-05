import type { CompanyWebsiteState } from "../types.js";

/**
 * What the last quote request said about the job, as the confirmation page's
 * "About the job" row does, on every page. Free text, so it is its own element:
 * the record beside it is compared whole, and the wording a person types here
 * is theirs. Self-contained for the same reason as `companyQuoteRecord`.
 */
export function companyQuoteDetails(state: CompanyWebsiteState): string {
  const quote = state.quotes[state.quotes.length - 1];
  return quote ? quote.details || "Nothing added" : "none";
}
