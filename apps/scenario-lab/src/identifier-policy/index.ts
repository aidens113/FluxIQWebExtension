/**
 * How a rendering treats the identifiers a recorder reads.
 *
 * One transform, shared by every fixture that offers an identifier-less
 * rendering, because the rule is about the recorder and not about any one
 * page: which attributes a production build removes, and what a page still
 * has to look like afterwards to stay correct and accessible.
 */
export { applyIdentifierPolicy } from "./apply.js";
export { identifierPolicies, type IdentifierPolicy } from "./policies.js";
