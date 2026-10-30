import type { PanelProduct } from "fluxiq/platform/panel";

/** File names under apps/product/assets/, served at /product/assets/<name>. */
export const productAssets: NonNullable<PanelProduct["assets"]> = {
  logo: "fluxiq-mark.svg",
  favicon: "favicon.ico"
};
