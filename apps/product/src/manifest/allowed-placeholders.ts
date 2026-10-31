import type { EmailTemplateName } from "./email/index.ts";

/** The placeholders Core fills per template (Core's stock-email-templates.ts documents them). */
export const allowedEmailPlaceholders: Readonly<Record<EmailTemplateName, readonly string[]>> = Object.freeze({
  welcome: ["displayName", "welcomeUrl", "expiresInHours"],
  "account-exists": ["signInUrl", "resetUrl"],
  "password-reset": ["displayName", "resetUrl", "expiresInMinutes"],
  "client-connected": ["displayName", "clientLabel", "manageUrl"],
  "credential-reused": ["displayName", "clientLabel", "manageUrl"]
});
