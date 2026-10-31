import type { PanelProduct } from "fluxiq/platform/panel";

/** A branded email's name: the keys of the manifest's `email.templates` (Core's PANEL_EMAIL_TEMPLATES). */
export type EmailTemplateName = keyof NonNullable<NonNullable<PanelProduct["email"]>["templates"]>;
