import { page } from "../../html.js";
import { defineScenario } from "../../types.js";
import { browseCompanies, defaultCompanyBrowse } from "./browse.js";
import { companyClientScript } from "./client-script.js";
import { companyDirectoryManifest } from "./manifest.js";
import { companyPageBody } from "./markup.js";
import { routeCompany } from "./route.js";
import { createCompanyState, mutateCompanyState } from "./state.js";
import type { CompanyDirectoryState } from "./types.js";

/**
 * A regional business register with 320 companies over eight sectors, fifteen
 * to a page, an A-Z index and a sector list to browse it by, a name search and
 * a size band to filter it by, and a profile per company carrying four facts
 * the register table has no column for.
 *
 * The front page always opens on the whole register from the top under the
 * armed rendering; every later page comes from the `results` route, which
 * records it through `mutate`. Nothing here reads the lab seed: the register
 * is authored and the manifest's expected records are literal text, so both
 * must read the same on every run.
 */
export const companyDirectoryScenario = defineScenario<CompanyDirectoryState>({
  id: "company-directory",
  title: "Company directory",
  startPath: "/scenarios/company-directory/",
  seed: 163,
  manifest: companyDirectoryManifest,
  createState: () => createCompanyState(),
  mutate: mutateCompanyState,
  render: (state) => page(
    "Company register | Northbank Business Register",
    companyPageBody(browseCompanies(defaultCompanyBrowse()), state.variant),
    companyClientScript(),
  ),
  route: (state, request) => routeCompany(state, request),
});
