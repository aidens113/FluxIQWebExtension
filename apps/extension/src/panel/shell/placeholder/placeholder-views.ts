// The views both surfaces mount until workstreams B and C land. The
// integration step replaces `placeholderViews` in `popup/index.ts` and
// `sidepanel/index.ts` with `{ simple: mountSimpleView, advanced: mountAdvancedView }`,
// and this directory is deleted.

import type { PanelViews } from "../contracts";
import { mountPlaceholderAdvancedView } from "./advanced-view";
import { createSettingsDraft, type SettingsDraft } from "./settings-draft";
import { mountPlaceholderSimpleView } from "./simple-view";

// One panel mounts per page, so one draft links that page's two views.
let pageDraft: SettingsDraft | undefined;
const draft = (): SettingsDraft => (pageDraft ??= createSettingsDraft());

/** The wave-1 views: a working simple view and the old settings as the Advanced view. */
export const placeholderViews: PanelViews = {
  simple: (context) => mountPlaceholderSimpleView(context, draft()),
  advanced: (context) => mountPlaceholderAdvancedView(context, draft())
};
