const { test } = require("node:test");
const assert = require("node:assert/strict");
const { releaseUnavailableBookings } = require("../services/releaseUnavailableBookings");

test("absence releases only unconverted bookings and preserves case ownership", async () => {
  const records = [
    { slot: "affected", reservationActive: true, status: "Pending Review", linkedCase: null, assignedCounselor: "original" },
    { slot: "affected", reservationActive: true, status: "Converted to Case", linkedCase: "case", assignedCounselor: "original" },
    { slot: "other", reservationActive: true, status: "Pending Review", linkedCase: null, assignedCounselor: "original" },
    { slot: "affected", reservationActive: false, status: "Cancelled", linkedCase: null, assignedCounselor: "original" },
  ];
  const session = {};
  const Intake = { async updateMany(query, update, options) {
    assert.equal(options.session, session);
    for (const record of records) {
      if (!query.slot.$in.includes(record.slot) || record.reservationActive !== query.reservationActive) continue;
      if (query.status && record.status !== query.status) continue;
      if ("linkedCase" in query && record.linkedCase !== query.linkedCase) continue;
      Object.assign(record, update.$set);
      (record.history ||= []).push(update.$push.history);
    }
  } };
  await releaseUnavailableBookings(Intake, ["affected"], "actor", session, "Counselor became unavailable");
  assert.equal(records[0].assignedCounselor, null);
  assert.equal(records[0].reservationActive, false);
  assert.equal(records[0].appointmentStatus, "Needs Rescheduling");
  assert.equal(records[0].slot, "affected"); // Retain the original appointment time for routing.
  assert.equal(records[0].history.length, 1);
  assert.match(records[0].history[0].action, /shared queue/);
  assert.equal(records[1].assignedCounselor, "original");
  assert.equal(records[1].appointmentStatus, "Needs Rescheduling");
  assert.equal(records[2].appointmentStatus, undefined);
  assert.equal(records[3].appointmentStatus, undefined);
});
