/**
 * The results sidebar as a recording presses it: an option of a filter group
 * by the group's legend and the option's words, and the group once an option
 * in it is ticked, which is what the reloaded results page shows.
 */
export const FACET_TARGETS = Object.freeze({
  option: (legend: string, option: string) => `fieldset:has(legend:text-is("${legend}")) label:has-text("${option}")`,
  ticked: (legend: string) => `fieldset:has(legend:text-is("${legend}")) label:has(input:checked)`,
});
