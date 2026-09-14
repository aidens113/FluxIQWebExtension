# `q-recorder-fence-review` — read-only stop-fence review

## Outcome

The stop boundary is synchronous and single-flight for stop callers, late
external content/navigation cannot select the admitted-navigation path, and the
navigation recorder drains each captured callback once in the ordinary stop
path. However, I found one material start/stop crossing defect: the fence does
not prevent a new recording from starting while the old stop remains in flight.
That crossing can silently discard the new recording's initial event and can
make start behavior depend on which side of the old stop's teardown an
acknowledgement reaches.

## Finding

### High — a new start can enter before the old stop promise settles

**Files/lines:** `apps/extension/src/background/connection/active-recording.ts:189-208`
keeps `stopping` installed until all of `finishStop` settles. Inside
`finishStop`, lines 226-237 change the public state to `idle`, clear the old
identity, and then await the notifying gateway send. Neither `start()` at
lines 158-186 nor `beginAccepted()` at lines 253-259 waits for or rejects an
active `stopping` operation. `startRecording()` lines 318-350 can therefore
start a new generation while the old stop promise still owns the admission
fence. Its initial event re-enters normal intake without the internal navigation
admission flag.

**Concrete failure path:**

1. A UI stop establishes `stopping` synchronously and drains old navigation.
2. `finishStop` changes `recordingState` to `idle`, clears the old recording,
   and begins awaiting `client.stop_recording` at line 237.
3. Before that send settles, a new `server.start_recording` arrives.
   `beginAccepted` sees an idle recorder and starts the new recording, including
   `clearRecordingTabs()`, so a new navigation generation is installed.
4. `startRecording` sets the public state to `recording`, then sends its initial
   `browser.tab` through the ordinary three-argument `recordEvent` call.
   `RecordedEventIntake.accept` rejects it because `acceptsEvents()` remains
   false while the old `stopping` token exists. The new recording is live but
   begins without its required initial event; other external events are also
   dropped until the old stop send settles.

A related earlier-window crossing is nondeterministic: a user `start()` can
send a new start while the old drain still leaves state `recording`. If its
acknowledgement arrives before teardown, `beginOnce` treats it as a project
re-link of the old recording instead of starting the requested new one; if it
arrives after teardown, it starts a new recording. No current test covers a
new recording ID crossing the stop—only an acknowledgement for the same old ID.

**Proposed correction:** serialize every entry into a new recording behind the
current stop promise. `start()` and `beginAccepted()` should await the captured
stop operation (settling after teardown even if its reported result rejects)
before evaluating recording state/identity or beginning a handshake/generation.
Any refusal path that can mutate recording state during a stop should likewise
be ignored or deferred for that boundary. Add two held-send tests: a new server
start arriving after old teardown but before stop settlement, and a UI start /
acceptance arriving during the navigation drain. Prove the new generation
starts exactly once after the stop, its initial `browser.tab` is recorded, and
no old admitted callback can target it.

## Verified properties

- **Synchronous stop fence:** `stop()` is non-async, assigns `this.stopping`
  before invoking the async drain, and immediately returns the stored `finished`
  promise. A second stop returns that exact promise before inspecting state.
- **Single stop teardown:** all crossing stop callers share `finishStop`; the
  first caller's `notifyServer` decision is captured once. The focused tests
  cover two notifying callers and both UI/server arrival orders.
- **Late external admission:** the browser runtime handler calls
  `handleRecordingEvent` with three arguments, so its fourth argument remains
  the default `false`. `TabRecorder`, `ServerCommandChannel`, and
  `ActiveRecording` expose only three-argument `recordEvent` dependencies. Only
  `RecordedEventIntake.recordNavigation` supplies `true`, through the internal
  facade closure. Fresh commits first require `acceptsEvents()`, and content /
  content-ready input cannot forge the flag through the runtime message path.
- **Captured callback drain:** a pending navigation is removed before `run`,
  its timer is cleared, a stale timer validates identity, and its promise is
  tracked by generation. `flush` awaits running work and re-drains same-generation
  work scheduled during settlement. The focused tests cover pending, already
  running, rejection, re-drain, and stale-timer cases.
- **Ordinary generation isolation:** `clearRecordingTabs()` increments the
  generation, cancels pending timers, and causes late failures from already
  running old callbacks to be ignored by a new flush. The uncovered lifecycle
  entry described above, rather than `NavigationRecorder`'s bookkeeping, is
  what permits the new generation to begin too early.

## Intake-signature call-site audit

- `FluxIQConnection.handleRecordingEvent` is the only facade accepting the
  fourth flag; its `recordEvent` closure forwards parameters without exposing a
  runtime-controlled argument.
- `background/index.ts` passes payload, tab ID, and frame ID only.
- `ActiveRecording`, `TabRecorder`, and `ServerCommandChannel` dependency types
  remain three-argument functions and therefore cannot claim prior navigation
  admission.
- `RecordedEventIntake.acceptContentReady`, scripted navigation, and normal
  event re-entry omit the flag.
- Only the two branches of the private debounced `recordNavigation` method pass
  `true`. Its test harness preserves the fourth argument when exercising facade
  re-entry.

No external call site capable of forging `admittedNavigation` was found.

## Scope and verification

I read the audit report, the stop-fence implementation report, the final
recorder/intake sources and their changed tests, every source call site of the
changed intake/facade signature, and the relevant start-handshake path. I ran no
build or test command because live Lab validation was active, as the brief
required.

No product code, test, shared document, generated artifact, Core file, commit,
or remote was changed. This report is the only file I wrote.
