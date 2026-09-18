import type { ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { browseCompanies, normalizeCompanyBrowse } from "./browse.js";
import { companyEntries } from "./companies.js";
import { companyResultsMarkup } from "./markup.js";
import { companyProfileMarkup } from "./profile-page.js";
import type { CompanyDirectoryState } from "./types.js";

const PROFILE_SUBPATH = /^companies\/([a-z0-9-]+)$/;

/**
 * `results?page=&letter=&sector=&size=&q=` serves the register fragment for
 * one browse and records it (`show`); `companies/<slug>` serves a company's
 * profile and records the visit (`view-profile`). Both follow the armed
 * rendering. Anything else is a 404.
 */
export function routeCompany(state: CompanyDirectoryState, request: ScenarioRouteRequest): ScenarioRouteResponse | undefined {
  if (request.subpath === "results") {
    const results = browseCompanies(normalizeCompanyBrowse({
      page: Number(request.query.get("page") ?? "1"),
      letter: request.query.get("letter") ?? "",
      sector: request.query.get("sector") ?? "",
      size: request.query.get("size") ?? "",
      query: request.query.get("q") ?? "",
    }));
    return { status: 200, body: companyResultsMarkup(results, state.variant), mutation: { operation: "show", payload: results.browse } };
  }
  const slug = PROFILE_SUBPATH.exec(request.subpath)?.[1];
  const entry = slug === undefined ? undefined : companyEntries.find((candidate) => candidate.slug === slug);
  if (!entry) return undefined;
  return {
    status: 200,
    body: companyProfileMarkup(entry, state.variant),
    mutation: { operation: "view-profile", payload: { slug: entry.slug } },
  };
}
