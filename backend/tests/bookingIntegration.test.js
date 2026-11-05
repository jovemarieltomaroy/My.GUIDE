// Opt-in, isolated local replica-set test. Never reads/writes application collections.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const User = require("../models/user");
const Intake = require("../models/counselingIntake");
const Slot = require("../models/counselorSlot");
const Case = require("../models/case");
const Student = require("../models/student");
const LegacyForm = require("../models/preCounselingForm");
const router = require("../routes/bookingRoutes");
const response = () => ({
  code: 200,
  status(value) {
    this.code = value;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
const invoke = async (route, req, method = "post") => {
  const layer = router.stack.find((l) => l.route?.path === route && l.route.methods[method]);
  const handler = layer.route.stack.at(-1).handle;
  const res = response();
  let error;
  await handler(req, res, (e) => {
    error = e;
  });
  if (error) throw error;
  return res;
};
const identity = {
  studentIdNumber: "BOOKING-FIXTURE-1",
  firstName: "Fixture",
  lastName: "Student",
  college: "CCS",
  email: "fixture-student@example.com",
  yearLevel: "1",
};
const consent = {
  hasConsent: true,
  confidentialityAgreementAccepted: true,
  dataPrivacyNoticeAccepted: true,
};

test(
  "real transactions: competing acceptance, duplicate reservation, conversion, absence and ownership transfer",
  { skip: process.env.BOOKING_INTEGRATION !== "1", timeout: 60000 },
  async () => {
    const settings = require("dotenv").parse(fs.readFileSync(path.resolve(__dirname, "../.env")));
    const uri = new URL(settings.MONGO_URI);
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(uri.hostname),
      "Integration tests are limited to a local server."
    );
    if (uri.username && !uri.searchParams.has("authSource"))
      uri.searchParams.set("authSource", uri.pathname.slice(1) || "admin");
    const database = `myguide_booking_test_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
    uri.pathname = `/${database}`;
    await mongoose.connect(uri.toString(), { serverSelectionTimeoutMS: 5000 });
    try {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      assert.ok(hello.setName || hello.msg === "isdbgrid", "Transactions require a replica set.");
      await Promise.all([User, Intake, Slot, Case, Student, LegacyForm].map((m) => m.init()));
      const users = await User.create([
        {
          email: "fixture-one@example.com",
          password: "fixture",
          firstName: "One",
          role: "Counselor-User",
          collegesHandled: ["CCS"],
        },
        {
          email: "fixture-two@example.com",
          password: "fixture",
          firstName: "Two",
          role: "Counselor-User",
          collegesHandled: ["CASS"],
        },
        {
          email: "fixture-admin@example.com",
          password: "fixture",
          firstName: "Admin",
          role: "Counselor-Admin",
        },
      ]);
      const slots = await Slot.create(
        users.map((u, i) => ({
          counselor: u._id,
          startsAt: new Date(Date.now() + (24 + i) * 3600000),
          endsAt: new Date(Date.now() + (25 + i) * 3600000),
        }))
      );
      const submitted = await invoke("/public/intakes", {
        body: {
          identity,
          consent,
          entryType: "Walk-in",
          backgroundAndPsychosocialHistory: { academicContext: "Isolated intake fixture" },
        },
      });
      const intakeId = String(submitted.body.reference);
      const shared = await invoke("/intakes", { user: users[0] }, "get");
      assert.equal(shared.body[0].identity.email, undefined);
      assert.equal(shared.body[0].identity.firstName, undefined);
      const accepts = await Promise.allSettled(
        users.slice(0, 2).map((user, i) =>
          invoke("/intakes/:id/accept", {
            params: { id: intakeId },
            user,
            body: { slotId: String(slots[i]._id) },
          })
        )
      );
      assert.equal(accepts.filter((r) => r.status === "fulfilled").length, 1);
      const intake = await Intake.findById(intakeId);
      const owner = users.find((u) => String(u._id) === String(intake.assignedCounselor));
      const other = users.find(
        (u) => u.role === "Counselor-User" && String(u._id) !== String(owner._id)
      );
      await assert.rejects(
        invoke("/intakes/:id", { params: { id: intakeId }, user: other }, "get"),
        /Accept this request/
      );
      const convert = () =>
        invoke("/intakes/:id/convert", {
          params: { id: intakeId },
          user: owner,
          body: {
            counselorNotes: "Optional counselor observations fixture.",
            currentPresentation: { narrativeDescription: "Counselor completed concern" },
            problemAssessment: {
              mainDomain: "Academic-Educational",
              primaryProblems: ["Reviewed academic difficulty"],
            },
            backgroundAndPsychosocialHistory: { academicContext: "Isolated intake fixture" },
          },
        });
      const conversions = await Promise.allSettled([convert(), convert()]);
      assert.ok(conversions.some((r) => r.status === "fulfilled"));
      assert.equal(await Case.countDocuments({ intake: intake._id }), 1);
      assert.equal(await Student.countDocuments({ studentIdNumber: identity.studentIdNumber }), 1);
      const converted = await convert();
      const unassessed = await Case.findById(converted.body.caseId);
      assert.equal(unassessed.counselorNotes, "Optional counselor observations fixture.");
      const { updateCase } = require("../controllers/caseController");
      const updateBody = async (body) => {
        let failure;
        await updateCase(
          { params: { id: String(converted.body.caseId) }, user: owner, body },
          response(),
          (error) => {
            failure = error;
          }
        );
        if (failure) throw failure;
      };
      await updateBody({
        caseFormulation: { counselorNotesSummary: "Reviewed notes summary fixture." },
      });
      assert.equal(
        (await Case.findById(converted.body.caseId)).caseFormulation.counselorNotesSummary,
        "Reviewed notes summary fixture."
      );
      await updateBody({ counselorNotes: "Revised counselor notes fixture." });
      const revisedNotes = await Case.findById(converted.body.caseId);
      assert.equal(revisedNotes.counselorNotes, "Revised counselor notes fixture.");
      assert.equal(revisedNotes.caseFormulation.counselorNotesSummary, "");

      assert.equal(
        unassessed.currentPresentation.narrativeDescription,
        "Counselor completed concern"
      );
      assert.equal(unassessed.problemAssessment.mainDomain, "Academic-Educational");
      assert.equal(
        String((await Intake.findById(intakeId)).linkedCase),
        String(converted.body.caseId)
      );
      assert.equal(
        (await Case.findById(converted.body.caseId)).backgroundAndPsychosocialHistory
          .academicContext,
        "Isolated intake fixture"
      );
      await invoke(
        "/counselors/:id/availability",
        { params: { id: String(owner._id) }, user: users[2], body: { status: "On Leave" } },
        "patch"
      );
      assert.equal((await Intake.findById(intakeId)).appointmentStatus, "Needs Rescheduling");
      const visible = await invoke("/public/slots", {}, "get");
      const defaults = await Slot.find({ source: "Default", counselor: other._id });
      assert.ok(defaults.length > 400, "Active counselors automatically receive weekday slots.");
      for (const slot of defaults) {
        const custom = slots.find((s) => String(s.counselor) === String(other._id));
        assert.ok(
          !(slot.startsAt < custom.endsAt && slot.endsAt > custom.startsAt),
          "Defaults preserve custom intervals."
        );
      }
      const blockedDefault = defaults[0];
      await invoke(
        "/slots/:id/block",
        { params: { id: String(blockedDefault._id) }, user: other, body: { isBlocked: true } },
        "patch"
      );
      const afterBlock = await invoke("/public/slots", {}, "get");
      assert.ok(afterBlock.body.every((s) => String(s._id) !== String(blockedDefault._id)));
      assert.equal((await Slot.findById(blockedDefault._id)).isBlocked, true);

      assert.ok(visible.body.every((s) => String(s.counselor._id) !== String(owner._id)));
      const { assignCounselor } = require("../controllers/caseController");
      const transferRes = response();
      let transferError;
      await assignCounselor(
        {
          params: { id: String(converted.body.caseId) },
          user: owner,
          body: {
            assignedCounselor: String(other._id),
            remarks: "Permanent ownership transfer fixture",
          },
        },
        transferRes,
        (e) => {
          transferError = e;
        }
      );
      if (transferError) throw transferError;
      let formerOwnerError;
      await assignCounselor(
        {
          params: { id: String(converted.body.caseId) },
          user: owner,
          body: { assignedCounselor: String(owner._id) },
        },
        response(),
        (error) => {
          formerOwnerError = error;
        }
      );
      assert.equal(formerOwnerError.statusCode, 403);
      const transferredCase = await Case.findById(converted.body.caseId);
      assert.equal(String(transferredCase.assignedCounselor), String(other._id));
      assert.ok(
        transferredCase.actionHistory.some(
          (action) =>
            action.action === "Reassigned" && action.remarks.includes("Permanent transfer")
        )
      );

      const transferred = await Intake.findById(intakeId);
      assert.equal(String(transferred.assignedCounselor), String(other._id));
      assert.equal(transferred.reservationActive, false);
      await assert.rejects(
        invoke("/intakes/:id", { params: { id: intakeId }, user: owner }, "get"),
        /Accept this request/
      );
      const otherSlot = slots.find((s) => String(s.counselor) === String(other._id));
      await invoke(
        "/intakes/:id/appointment",
        { params: { id: intakeId }, user: other, body: { slotId: String(otherSlot._id) } },
        "patch"
      );
      assert.equal((await Intake.findById(intakeId)).appointmentStatus, "Booked");
      const directSlot = slots[2];
      const reservations = await Promise.allSettled(
        [1, 2].map((i) =>
          invoke("/public/intakes", {
            body: {
              identity: {
                ...identity,
                studentIdNumber: `DIRECT-${i}`,
                email: `direct-${i}@example.com`,
              },
              consent,
              entryType: "Scheduled",
              slotId: String(directSlot._id),
            },
          })
        )
      );
      assert.equal(reservations.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        await Intake.countDocuments({ slot: directSlot._id, reservationActive: true }),
        1
      );
    } finally {
      // Only the unique test database created above can be removed.
      assert.equal(mongoose.connection.name, database);
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
  }
);
