import type { AutomationStudioResolvedControlIntent } from "fluxiq/automation-studio";
import type { WebLlmControlIntentCollector } from "./contracts";
import { controlAncestry } from "./context";
import { belongsToConsent } from "./membership";
import { controlWords } from "./control-words";
import { isActingControl } from "./acting-control";
import { isConsentResponse } from "./consent-response";
import { wordingIntent } from "./wording";

/** One index per retained capture; no browser query or model-authored context. */
export const collectWebLlmControlIntents: WebLlmControlIntentCollector = (binding) => {
  const byHandle = new Map(binding.evidence.elements.filter((element) => binding.selectors.has(element.target)).map((element) => [element.target, element]));
  const intents = new Map<string, AutomationStudioResolvedControlIntent>();
  for (const element of byHandle.values()) {
    const chain = controlAncestry(element, byHandle);
    const acting = (chain ?? [element]).filter(isActingControl);
    const control = acting[0];
    const words = control && controlWords(control);
    // A glyph inside an accepting acting control cannot turn that act into dismissal.
    const accepting = acting.find((candidate) => {
      const own = controlWords(candidate);
      return own !== undefined && wordingIntent(own) === "accept";
    });
    let intent: AutomationStudioResolvedControlIntent;
    if (accepting) {
      const own = controlWords(accepting)!;
      const responseOnly = accepting === control && acting.length === 1 && isConsentResponse(own) && belongsToConsent(chain, byHandle);
      intent = responseOnly ? { intent: "accept", responseOnly: true } : { intent: "accept" };
    } else {
      intent = { intent: words && wordingIntent(words) === "dismiss" ? "dismiss" : control?.href ? "navigate" : "neutral" };
    }
    intents.set(element.target, Object.freeze(intent));
  }
  return intents;
};
