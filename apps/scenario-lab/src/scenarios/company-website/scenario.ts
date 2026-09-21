import { defineScenario } from "../../types.js";
import { companyWebsiteManifest } from "./manifest.js";
import { renderHome } from "./pages/index.js";
import { routeCompanyWebsite } from "./route.js";
import { createCompanyWebsiteState, mutateCompanyWebsiteState } from "./state.js";
import type { CompanyWebsiteState } from "./types.js";

/**
 * An ordinary small-company website -- a heating and plumbing firm with five
 * branches -- with the mess such a site accumulates: a consent platform in a
 * shadow root that owns the page until answered, a newsletter offer on a
 * timer, a chat vendor's greeting card parked over the quote drawer's submit
 * button, a honeypot and a human check on the quote form, a lazily loaded
 * team grid with a stale-count filter, duplicated leadership cards, a job
 * advert dressed as a person, a rate-limited endpoint and a "Show more"
 * button that needs a second press, a price list behind skeletons with a VAT
 * switch and sponsored rows, and a third-party booking widget on another
 * origin that takes a deposit.
 *
 * The lab seed renames every class and generated id and changes nothing else:
 * the content, the prices, the calendar and every reference are authored or
 * derived from what was asked for, so the manifest can state them exactly.
 */
export const companyWebsiteScenario = defineScenario<CompanyWebsiteState>({
  id: "company-website",
  title: "Company website",
  startPath: "/scenarios/company-website/",
  seed: 4519,
  manifest: companyWebsiteManifest,
  createState: () => createCompanyWebsiteState(),
  mutate: mutateCompanyWebsiteState,
  render: renderHome,
  route: (state, request, context) => routeCompanyWebsite(state, request, context),
});
