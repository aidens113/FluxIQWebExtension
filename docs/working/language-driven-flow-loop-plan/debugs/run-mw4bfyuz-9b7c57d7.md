# Debug: run-mw4bfyuz-9b7c57d7

Status: Failed before any provider call (facility, `process.startup`). Nothing spent, nothing tested. Lane C (t877).
Task: professional-network-accept-messaged-invitations, Sonnet 5.5, `--attempts 2`.

## Cause and distance reached

The run got as far as "starting an isolated Core". While it was building Core's web panel, the lead fast-forwarded this lane's Core branch to e01b64360 (lane A's A5 and A6), so Core's build inputs changed under the build. The Lab refused to publish a build whose inputs moved ("key 513872e2... became 8eefe578..., so the build was not published; prepare it again"). 0 steps, 0 calls, $0. That is the Lab's guard working as meant, not a product fault.

## Next

Rebuild Core's libraries at e01b64360 and launch the same pair again.
