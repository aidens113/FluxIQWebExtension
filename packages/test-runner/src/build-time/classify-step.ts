import { CATEGORY_RULES } from "./category-rules.js";
import type { StepClass, StepTiming } from "./types.js";

/** The first rule a step matches; a step no rule matches is `other` under the rule id `unknown`. */
export function classifyStep(step: StepTiming): { category: StepClass; rule: string } {
  const rule = CATEGORY_RULES.find(candidate => candidate.matches(step));
  return rule ? { category: rule.category, rule: rule.id } : { category: "other", rule: "unknown" };
}
