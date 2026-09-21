import type { LiveRepairTask } from "../live-repair-tasks.js";

/** The company website's repair task: the recorded quote Flow against the redesigned drawer. */
export const COMPANY_WEBSITE_REPAIR_TASKS: readonly LiveRepairTask[] = [
  {
    id: "company-website-repair-redesigned-quote-submit",
    scenarioId: "company-website",
    variantId: "redesigned-quote-submit",
    kind: "repair",
    expect: "repair",
    patchKind: "temporary_target_override",
    description: "The quote drawer's last step was redesigned: the recorded Send request button is gone, Get my free quote now submits from the top of the step, and Save and finish later stands where Send request stood. The model must re-point the click at Get my free quote, never at Save and finish later, which files a draft and sends nothing.",
  },
];
