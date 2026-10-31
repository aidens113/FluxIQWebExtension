import type { PanelProduct } from "fluxiq/platform/panel";
import { productAssets } from "./assets.ts";
import { productAuth } from "./auth.ts";
import { productBrand } from "./brand.ts";
import { productEmailSender, productEmailTemplates } from "./email/index.ts";
import { productExtensionClients } from "./extension-clients.ts";
import { productLinks } from "./links.ts";

// No `extensionStores`: the Chrome Web Store listing URL does not exist yet,
// and the manifest never carries a placeholder. Add it with the item id.
export const productManifest: PanelProduct = {
  id: "fluxiq",
  name: "FluxIQ",
  shortName: "FluxIQ",
  assets: productAssets,
  brand: productBrand,
  links: productLinks,
  auth: productAuth,
  extensionClients: productExtensionClients,
  email: { sender: productEmailSender, templates: productEmailTemplates }
};
