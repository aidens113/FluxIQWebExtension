// The Scenario Lab's reset producer, answered in its own shape, for the Flow
// lanes' tests that replace `fetch` because the fixture origin is unreachable.
//
// Since t336 (d7ee6595) `../reset-scenario-lab.ts` confirms a reset by its
// packet -- status, seed and a producer generation -- and by a fresh health read
// of the same generation, and refuses anything else as "could not be
// confirmed". A stub that answered `{ ok: true }` with no body therefore failed
// every lane that resets before its Flow runs. Shared by `run-flow-lane.test.ts`,
// `live-repair-lane.test.ts` and `../repair/tests/run-repair-lane.test.ts`; the
// created lane's harness passes the same shape through its own `fetchLab`.

const RESET_PROVENANCE = { schemaVersion: "fixture.state.v1", ownerEpoch: "12345678-1234-4123-8123-123456789abc", resetGeneration: 2, mutationSequence: 1 };

/** The reset packet for the POST, the health read of the same generation for anything else. */
export function resetProducerResponse(method: string | undefined): Response {
  const body = method === "POST"
    ? { status: "reset", seed: 12, provenance: RESET_PROVENANCE }
    : { status: "ready", seed: 12, scenarios: ["fixture"], provenance: RESET_PROVENANCE };
  return new Response(JSON.stringify(body), { status: 200 });
}
