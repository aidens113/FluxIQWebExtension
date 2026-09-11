/**
 * Fixed option lists for the keyboard-forms page; content never depends on
 * the seed or the clock. Three countries share the prefix "Ne", so a filter
 * that never ran (no `input` event) leaves a different option second.
 */
export const keyboardFormsOptions = {
  contactMethods: [
    { value: "email", label: "Email" },
    { value: "sms", label: "Text message" },
    { value: "phone", label: "Phone call" },
  ],
  countries: [
    { code: "AR", name: "Argentina" },
    { code: "AU", name: "Australia" },
    { code: "AT", name: "Austria" },
    { code: "BE", name: "Belgium" },
    { code: "CA", name: "Canada" },
    { code: "DK", name: "Denmark" },
    { code: "NP", name: "Nepal" },
    { code: "NL", name: "Netherlands" },
    { code: "NZ", name: "New Zealand" },
    { code: "NO", name: "Norway" },
    { code: "PT", name: "Portugal" },
    { code: "SE", name: "Sweden" },
  ],
} as const;

export type ContactMethod = (typeof keyboardFormsOptions.contactMethods)[number]["value"];
export type CountryCode = (typeof keyboardFormsOptions.countries)[number]["code"];
