const { test } = require("node:test");
const assert = require("node:assert/strict");
const { defaultIntervals } = require("../services/defaultBookingSlots");
const local = (value) => new Date(new Date(value).getTime() + 8 * 3600000);

test("default slots use Manila weekdays from 8 AM to 5 PM, excluding elapsed times", () => {
  // Friday 10:30 AM Manila: six hourly slots remain today, including noon.
  const now = new Date("2030-01-04T02:30:00Z");
  const intervals = defaultIntervals(now, 4);
  assert.equal(intervals.length, 15); // Six Friday slots, nine Monday slots.
  assert.equal(intervals[0].startsAt.toISOString(), "2030-01-04T03:00:00.000Z");
  for (const interval of intervals) {
    const start = local(interval.startsAt);
    assert.ok(![0, 6].includes(start.getUTCDay()));
    assert.ok([8, 9, 10, 11, 12, 13, 14, 15, 16].includes(start.getUTCHours()));
    assert.equal(interval.endsAt - interval.startsAt, 3600000);
    assert.ok(interval.startsAt > now);
  }
});

test("Manila date boundaries are independent of server timezone and weekends", () => {
  // Sunday 11:30 PM UTC is already Monday 7:30 AM in Manila.
  const slots = defaultIntervals(new Date("2030-01-06T23:30:00Z"), 1);
  assert.equal(slots.length, 9);
  assert.equal(slots[0].startsAt.toISOString(), "2030-01-07T00:00:00.000Z");
  assert.equal(slots.at(-1).endsAt.toISOString(), "2030-01-07T09:00:00.000Z");
  assert.equal(defaultIntervals(new Date("2030-01-05T00:00:00Z"), 2).length, 0);
});

test("rolling defaults cover ninety days without generating past or out-of-horizon slots", () => {
  const now = new Date("2030-12-20T06:00:00Z");
  const slots = defaultIntervals(now);
  assert.ok(slots.length > 400);
  assert.ok(
    slots.every((s) => s.startsAt > now && s.startsAt < new Date(now.getTime() + 90 * 86400000))
  );
});
