import { resultsPage, searchCatalog, type SearchQuery } from "../../catalog/index.js";
import type { PageKit } from "../page-kit.js";
import { resultsMarkup } from "./results-markup.js";

/** The rest of a results page, as the sentinel fetches it: an HTML fragment, not a document. */
export function renderMoreResults(kit: PageKit, query: SearchQuery): string {
  const outcome = searchCatalog(query);
  return resultsMarkup(kit.css, kit.ids, outcome, resultsPage(outcome, query.page), "lazy", "");
}
