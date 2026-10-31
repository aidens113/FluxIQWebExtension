import type { PanelProduct } from "fluxiq/platform/panel";

export const productEmailSender: NonNullable<PanelProduct["email"]>["sender"] = { name: "FluxIQ", address: "no-reply@getfluxiq.com" };
