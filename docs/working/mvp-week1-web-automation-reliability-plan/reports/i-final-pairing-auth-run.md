# `i-final-pairing-auth-run` — Stage 4q isolated 401 diagnosis

**Status:** complete — the Stage 4p stop is explained with high confidence as
an isolated-launch credential-shape error, not a pairing-recovery failure and
not a change between the candidate pins. No Lab run was started and no secret,
page data, payload, source, Core, worktree, or shared working document was
changed.

## Bounded observations

- Both preserved W27 primary Flow bundles are complete. The first finalized in
  34,682 ms and the classification rerun in 15,584 ms. Both report `failed`,
  `environment.missing`, two scenario steps, no Flow, no action, no harness
  activation, and the closed summary `FluxIQ authentication failed (401)`.
  Therefore neither attempt reached the pairing gate.
- The Stage 4p launcher supplied three process values used by the target
  configuration as web-panel username, password, and authorization PIN. The
  worker's boolean-only comparison established that those child-process values
  matched the same private environment source after parsing; this rules out a
  wrapper quoting, whitespace, or inline-comment mismatch.
- The private source has all three fields present, with non-empty lengths 18,
  39, and 6 respectively. No value or value-derived hash was printed. The
  detached Stage 4p worktree has no private environment file, and
  `FLUXIQ_TEST_ENV_FILES=none` prevents a second file source from changing the
  child environment.
- The ordinary disposable `isolated` topology has a crucial distinction: with
  no configured web-panel credentials it generates credentials and bootstraps
  that identity in the new run-owned Core root. With configured credentials,
  the current coordinator retains them for HTTP login but only calls the
  existing-identity bootstrap path for `persistent-isolated`; ordinary
  `isolated` therefore reaches `/api/auth/login` with an identity that was not
  seeded into that fresh Core root. A deterministic 401 is the expected result.
- The prior final A2/B2 wrappers describe only the scenario auth-gate value as
  process-only. Their accepted reports contain no 401 or `environment.missing`
  occurrence across 153 and 155 executable finalizations. This is consistent
  with leaving web-panel credentials absent so disposable isolation can create
  its own identity; it is not evidence that externally supplied web-panel
  credentials work in ordinary isolation.
- The diff from downstream `54e30bc` to candidate `74f6aa0` changes pairing
  lifecycle code/tests and working evidence only. It does not change target
  configuration, isolated identity creation, HTTP login, or the coordinator.
  Core is unchanged at `19468b7`. The candidate pairing change therefore does
  not explain a pre-pairing authentication rejection.

## Cause and narrowest discriminating probe

The evidence-backed cause is that the Stage 4p process wrapper populated the
three optional web-panel target credential variables for a disposable
`isolated` run. That selects the coordinator path which logs in with supplied
credentials but does not seed them into the fresh Core root. The successful
value-parser equality check actually strengthens this conclusion: the wrong
launch shape was delivered faithfully.

The narrowest safe probe is one W27 primary Flow invocation at the same pins,
same fresh run-root rules, and `FLUXIQ_TEST_ENV_FILES=none`, but with exactly
the web-panel username/password/PIN variables absent from the Lab child
environment. Keep only scenario-declared secrets actually required by the
selected cell; W27 declares none. Do not substitute blank values, because the
target parser rejects partially configured credentials. Require the run to
pass HTTP authentication and reach the pairing observation. That single run
discriminates launch-shape error from an unrelated Core authentication defect
without revealing or comparing any credential.

If it reaches pairing, restart Stage 4p with the corrected wrapper shape. If it
still returns 401, the next bounded probe is an in-process boolean assertion in
one fresh allocation: whether the generated/selected login username has a
matching identity before HTTP login and whether direct authentication succeeds,
without emitting the username, password, PIN, hashes, environment, or identity
snapshot.

## Product boundary exposed

Separately from the immediate matrix correction, configuration explicitly
allows optional credentials for `isolated`, while the coordinator does not
bootstrap supplied credentials for that mode. If user-supplied disposable
credentials are intended, the smallest source boundary is the coordinator's
identity-bootstrap branch plus a regression proving supplied isolated
credentials are seeded before login. That product issue should not be silently
worked around in source during this read-only diagnosis.

## Exact read-only checks

- Read the working document's `Current State`, the Stage 4q brief, and
  `l-final-pairing-isolated.md`.
- Enumerated only relative paths and byte sizes in the two Stage 4p bundles;
  parsed their closed status, verdict/category, timing, Flow/action/harness,
  event/screenshot, and redaction fields.
- Checked downstream and Core worktree pins/porcelain and the absence of private
  environment files in the detached worktrees.
- Parsed only presence and lengths for the three named private-source fields;
  no raw value, dump, page data, payload, or hash was read out.
- Compared report-level 401/`environment.missing` occurrence counts for Stage
  4p versus A2/B2, and inspected the A2/B2 launcher descriptions.
- Read the target-resolution, run-scenario credential handoff, coordinator
  bootstrap/login branch, and fixed 401 classification seam.
- Ran `git diff --name-status` and `git diff --stat` between `54e30bc` and
  `74f6aa0`; no authentication-owned file changed.

## Remaining uncertainty

No corrected launch was run under this brief, so the diagnosis is not yet live
confirmed and the pairing recovery remains unmeasured. The immediate probe may
expose the originally targeted pairing behavior after authentication clears.
The code-level question—whether optional credentials for ordinary isolation are
a supported contract or should be rejected—also requires the supervisor's
decision and independent tests.
