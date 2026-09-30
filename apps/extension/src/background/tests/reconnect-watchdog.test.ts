import assert from "node:assert/strict";
import test from "node:test";

import { RECONNECT_ALARM_NAME, ReconnectWatchdog, wantsReconnectAlarm, type ReconnectAlarms, type ReconnectWatchState } from "../reconnect-watchdog";

const down: ReconnectWatchState = { paired: true, autoReconnect: true, disconnectedByPerson: false, connectionState: "reconnecting" };

function fakeAlarms(): ReconnectAlarms & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    create: (name, info) => { calls.push(`create ${name} ${info.periodInMinutes}`); },
    clear: (name) => { calls.push(`clear ${name}`); }
  };
}

test("an alarm is wanted only while a paired, auto-reconnecting, not-disconnected browser is down", () => {
  assert.equal(wantsReconnectAlarm(down), true);
  assert.equal(wantsReconnectAlarm({ ...down, connectionState: "error" }), true);
  assert.equal(wantsReconnectAlarm({ ...down, connectionState: "disconnected" }), true);
  assert.equal(wantsReconnectAlarm({ ...down, connectionState: "connected" }), false);
  assert.equal(wantsReconnectAlarm({ ...down, connectionState: "pairing" }), false);
  assert.equal(wantsReconnectAlarm({ ...down, paired: false }), false);
  assert.equal(wantsReconnectAlarm({ ...down, autoReconnect: false }), false);
  assert.equal(wantsReconnectAlarm({ ...down, disconnectedByPerson: true }), false);
});

test("the watchdog sets the alarm when the connection drops and clears it when it is back, once each", () => {
  const alarms = fakeAlarms();
  const watchdog = new ReconnectWatchdog(alarms);
  watchdog.sync(down);
  watchdog.sync({ ...down, connectionState: "connecting" });
  watchdog.sync({ ...down, connectionState: "connected" });
  watchdog.sync({ ...down, connectionState: "connected" });
  assert.deepEqual(alarms.calls, [`create ${RECONNECT_ALARM_NAME} 0.5`, `clear ${RECONNECT_ALARM_NAME}`]);
});

test("a new worker says what it wants on its first sync, so an alarm a stopped worker left is cleared", () => {
  const alarms = fakeAlarms();
  new ReconnectWatchdog(alarms).sync({ ...down, connectionState: "connected" });
  assert.deepEqual(alarms.calls, [`clear ${RECONNECT_ALARM_NAME}`]);
});

test("without the alarms API the watchdog does nothing", () => {
  assert.doesNotThrow(() => new ReconnectWatchdog(undefined).sync(down));
});

test("an alarm the browser refuses leaves the watchdog free to try again", () => {
  let attempts = 0;
  const watchdog = new ReconnectWatchdog({ create: () => { attempts += 1; throw new Error("no permission"); }, clear: () => undefined });
  watchdog.sync(down);
  watchdog.sync(down);
  assert.equal(attempts, 2);
});
