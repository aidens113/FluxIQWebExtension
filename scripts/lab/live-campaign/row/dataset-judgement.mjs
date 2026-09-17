/**
 * Passed when some extract step was judged and every judged step matched in
 * count and, where listed, in value. A `null` extraction was not measured;
 * `[]` was measured and found no extract step, which fails a dataset task.
 */
export function datasetJudgement(extraction) {
  if (!Array.isArray(extraction)) return { passed: null, steps: null };
  const judged = extraction.filter((step) => step.status === "judged");
  const matched = (step) => step.observedRecords === step.expectedRecords && (!step.recordsListed || step.matchedRecords === step.expectedRecords);
  const passed = judged.length > 0 && extraction.every((step) => step.status !== "not_run") && judged.every(matched);
  return { passed, steps: extraction.map((step) => ({ status: step.status, expectedRecords: step.expectedRecords, observedRecords: step.observedRecords, matchedRecords: step.matchedRecords, recordsListed: step.recordsListed })) };
}
