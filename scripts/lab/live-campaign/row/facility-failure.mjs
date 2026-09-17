// Where a run that finished its bundle failed on the facility, read from the
// evaluation's `facilityFailure`: a closed, secret-free diagnostic, so only its
// known fields are read, and only when they are plain codes.

const CODE = /^[A-Za-z0-9._-]{1,64}$/u;
const code = (value) => (typeof value === "string" && CODE.test(value) ? value : null);

/**
 * One line such as `http.timeout at control.request after 30000 ms
 * (finalized-bundle, scenario.execute)`, or `null` when the run named none.
 */
export function describeFacilityFailure(diagnostic) {
  const reason = code(diagnostic?.reason);
  if (reason === null) return null;
  const operation = code(diagnostic.operationStage);
  const timeoutMs = Number.isSafeInteger(diagnostic.timeoutMs) ? diagnostic.timeoutMs : null;
  const cause = code(diagnostic.causeCode);
  const where = [code(diagnostic.boundary), code(diagnostic.stage)].filter(Boolean).join(", ");
  return `${reason}${operation ? ` at ${operation}` : ""}${timeoutMs !== null ? ` after ${timeoutMs} ms` : ""}${cause ? `, ${cause}` : ""}${where ? ` (${where})` : ""}`;
}
