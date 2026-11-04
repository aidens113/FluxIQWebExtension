import { nested, part, recordsOf, tally, textsOf, type LastingView, type SiteState } from "../lasting-view.js";

/** The board: saved postings, followed companies, alert subscriptions and applications by posting. */
export function jobBoardView(state: SiteState): LastingView {
  const view: Record<string, number> = {};
  for (const key of textsOf(state, "saved")) tally(view, `saved:${key}`);
  for (const company of textsOf(state, "follows")) tally(view, `following:${company}`);
  tally(view, "alerts", textsOf(state, "alertSubscriptions").length);
  for (const application of recordsOf(state, "applications")) {
    tally(view, `application:${part(nested(application, "answers"), "jobKey")}`);
    if (application.flagged === true) tally(view, "flagged-applications");
  }
  return view;
}
