import type { EmailTemplateName } from "./template-name.ts";

type Template = { subject: string; text: string };

/** Branded copy for four of Core's five emails; credential-reused keeps Core's stock text. Placeholders are the ones Core fills per template. */
export const productEmailTemplates: Partial<Record<EmailTemplateName, Template>> = {
  welcome: {
    subject: "Welcome to FluxIQ: confirm your email",
    text: [
      "Hello {{displayName}},",
      "",
      "Thanks for signing up to FluxIQ. Open this link to confirm your email address and choose a password:",
      "",
      "{{welcomeUrl}}",
      "",
      "The link works once and expires in {{expiresInHours}} hours. If you did not sign up, you can ignore this email.",
      "",
      "The FluxIQ team"
    ].join("\n")
  },
  "account-exists": {
    subject: "You already have a FluxIQ account",
    text: [
      "Someone asked to sign up to FluxIQ with this email address, which already has an account.",
      "",
      "Sign in: {{signInUrl}}",
      "Forgot your password? Reset it here: {{resetUrl}}",
      "",
      "If this was not you, you can ignore this email. Nothing has changed.",
      "",
      "The FluxIQ team"
    ].join("\n")
  },
  "password-reset": {
    subject: "Reset your FluxIQ password",
    text: [
      "Hello {{displayName}},",
      "",
      "Open this link to choose a new password:",
      "",
      "{{resetUrl}}",
      "",
      "The link works once and expires in {{expiresInMinutes}} minutes. Keys sealed under your old password cannot be read after a reset. If you did not ask for a reset, you can ignore this email.",
      "",
      "The FluxIQ team"
    ].join("\n")
  },
  "client-connected": {
    subject: "A new browser was connected to your FluxIQ account",
    text: [
      "Hello {{displayName}},",
      "",
      "{{clientLabel}} was connected to your FluxIQ account.",
      "",
      "If this was not you, revoke it here: {{manageUrl}}",
      "",
      "The FluxIQ team"
    ].join("\n")
  }
};
