const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const wrap = require("express-async-handler");
const { protect, counselorOnly } = require("../middleware/authValidator");
const User = require("../models/user");
const Slot = require("../models/counselorSlot");
const Intake = require("../models/counselingIntake");
const Student = require("../models/student");
const LegacyForm = require("../models/preCounselingForm");
const Case = require("../models/case");
const { nextCaseNumber } = require("../services/caseNumbering");
const transporter = require("../config/emailTransporter");
const { availableAt, ownsIntake, validateSubmission } = require("../services/bookingRules");
const { ensureDefaultSlots } = require("../services/defaultBookingSlots");
const { releaseUnavailableBookings } = require("../services/releaseUnavailableBookings");
const router = express.Router();
const fail = (message, status = 400) => {
  const error = new Error(message);
  error.statusCode = status;
  throw error;
};
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const oid = (value) => {
  if (!mongoose.isValidObjectId(value)) fail("Invalid record ID.");
  return value;
};
const transaction = async (fn) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (error) {
    if (error.code === 20)
      fail("Booking requires MongoDB running as a replica set. See docs/BOOKING_WORKFLOW.md.", 503);
    if (error.code === 11000)
      fail("This slot or request has already been taken. Refresh and try again.", 409);
    throw error;
  } finally {
    await session.endSession();
  }
};
const editableCounselor = async (req, session) => {
  const id = oid(req.params.id);
  if (req.user.role !== "Counselor-Admin" && String(req.user._id) !== id)
    fail("You can only edit your own availability.", 403);
  const user = await User.findOne({
    _id: id,
    role: { $in: ["Counselor-Admin", "Counselor-User"] },
  }).session(session);
  if (!user) fail("Counselor not found.", 404);
  return user;
};
const reserve = async (slotId, session) => {
  const slot = await Slot.findOneAndUpdate(
    { _id: oid(slotId), isBlocked: false, startsAt: { $gt: new Date() } },
    { $inc: { revision: 1 } },
    { returnDocument: "after", session }
  );
  if (!slot) fail("This slot is no longer available.", 409);
  const counselor = await User.findOneAndUpdate(
    { _id: slot.counselor },
    { $inc: { schedulingRevision: 1 } },
    { returnDocument: "after", session }
  );
  if (!counselor || !availableAt(counselor, slot.startsAt, slot.endsAt))
    fail("The counselor is unavailable for this slot.", 409);
  if (await Intake.exists({ slot: slot._id, reservationActive: true }).session(session))
    fail("This slot has already been booked.", 409);
  return slot;
};
// Verification releases only identity fields, never counseling records.
const { createIdentityVerification } = require("../services/bookingIdentityVerification");
const identityVerification = createIdentityVerification({
  Challenge: require("../models/bookingIdentityChallenge"), Student,
  secret: process.env.JWT_SECRET,
  sendMail: message => transporter.sendMail({ from: process.env.EMAIL_USER, ...message }),
});
for (const action of ["request", "verify", "confirm"]) {
  router.post(`/public/student-identity/${action}`, (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  }, wrap(async (req, res) => {
    const result = action === "request"
      ? await identityVerification.request(req.body?.studentIdNumber, req.ip)
      : await identityVerification[action](req.body || {});
    res.json(result);
  }));
}

// Only public schedule information is returned; student records and leave reasons never appear here.
router.get(
  "/public/slots",
  wrap(async (req, res) => {
    const users = await User.find({
      isActive: true,
      role: { $in: ["Counselor-Admin", "Counselor-User"] },
    }).select("firstName lastName collegesHandled availability role isActive");
    await ensureDefaultSlots(users.map((user) => user._id));
    const occupied = await Intake.distinct("slot", { reservationActive: true });
    const slots = await Slot.find({
      isBlocked: false,
      startsAt: { $gt: new Date(), $lt: new Date(Date.now() + 90 * 86400000) },
      _id: { $nin: occupied },
    }).sort({ startsAt: 1 });
    const mapped = slots.flatMap((slot) => {
      const user = users.find((u) => String(u._id) === String(slot.counselor));
      if (!user || !availableAt(user, slot.startsAt, slot.endsAt)) return [];
      return [
        {
          _id: slot._id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          counselor: {
            _id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            collegesHandled: user.collegesHandled,
          },
        },
      ];
    });
    res.json(mapped);
  })
);
router.get(
  "/public/invitations/:token",
  wrap(async (req, res) => {
    const intake = await Intake.findOne({
      token: hash(req.params.token),
      status: "Awaiting Submission",
      tokenExpiresAt: { $gt: new Date() },
    });
    if (!intake) {
      const legacy = await LegacyForm.findOne({
        token: hash(req.params.token),
        status: "Pending",
        tokenExpiresAt: { $gt: new Date() },
      });
      const student = legacy ? await Student.findById(legacy.student) : null;
      if (!student || student.isArchived)
        fail("This invitation has expired or has already been used.", 410);
      return res.json({
        identity: Object.fromEntries(
          [
            "studentIdNumber",
            "firstName",
            "lastName",
            "email",
            "college",
            "program",
            "yearLevel",
            "contactNumber",
          ].map((k) => [k, student[k]])
        ),
        entryType: "Scheduled",
        expiresAt: legacy.tokenExpiresAt,
      });
    }
    res.json({
      identity: intake.identity,
      entryType: intake.entryType,
      expiresAt: intake.tokenExpiresAt,
    });
  })
);
// Bound repeated anonymous submissions without relying on any student record lookup.
const requests = new Map();
router.post(
  "/public/intakes",
  (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    if (requests.size > 5000)
      for (const [ip, value] of requests) if (value.until <= now) requests.delete(ip);
    const count = requests.get(key);
    if (count && count.until > now && count.count >= 30)
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    requests.set(
      key,
      count && count.until > now
        ? { ...count, count: count.count + 1 }
        : { count: 1, until: now + 3600000 }
    );
    next();
  },
  wrap(async (req, res) => {
    try {
      validateSubmission(req.body);
    } catch (error) {
      fail(error.message);
    }
    const id = await transaction(async (session) => {
      let invitation, legacy;
      if (req.body.invitationToken) {
        invitation = await Intake.findOne({
          token: hash(req.body.invitationToken),
          status: "Awaiting Submission",
          tokenExpiresAt: { $gt: new Date() },
        }).session(session);
        if (!invitation) {
          legacy = await LegacyForm.findOne({
            token: hash(req.body.invitationToken),
            status: "Pending",
            tokenExpiresAt: { $gt: new Date() },
          }).session(session);
          const student = legacy ? await Student.findById(legacy.student).session(session) : null;
          if (!student || student.isArchived)
            fail("This invitation has expired or has already been used.", 410);
          invitation = new Intake({
            identity: Object.fromEntries(
              [
                "studentIdNumber",
                "firstName",
                "lastName",
                "email",
                "college",
                "program",
                "yearLevel",
                "contactNumber",
              ].map((k) => [k, student[k]])
            ),
            legacyForm: legacy._id,
          });
        }
        if (
          invitation.identity.studentIdNumber !==
            req.body.identity.studentIdNumber.trim().toUpperCase() ||
          invitation.identity.email !== req.body.identity.email.trim().toLowerCase()
        )
          fail("Student ID and email must match the invitation.");
      }
      const intake = invitation || new Intake();
      // Copy an explicit allowlist rather than accepting model fields from a public request.
      intake.identity = Object.fromEntries(
        [
          "studentIdNumber",
          "firstName",
          "lastName",
          "email",
          "college",
          "program",
          "yearLevel",
          "contactNumber",
        ].map((k) => [k, req.body.identity[k]])
      );
      intake.entryType = req.body.entryType;
      intake.consent = {
        hasConsent: true,
        confidentialityAgreementAccepted: true,
        dataPrivacyNoticeAccepted: true,
        consentDate: new Date(),
      };
      intake.backgroundAndPsychosocialHistory = req.body.backgroundAndPsychosocialHistory || {};
      intake.status = "Pending Review";
      intake.submittedAt = new Date();
      if (req.body.preferredAt) intake.preferredAt = new Date(req.body.preferredAt);
      if (req.body.slotId) {
        const slot = await reserve(req.body.slotId, session);
        intake.slot = slot._id;
        intake.assignedCounselor = slot.counselor;
        intake.reservationActive = true;
        intake.appointmentStatus = "Booked";
      }
      intake.history.push({ action: "Submitted" });
      await intake.save({ session });
      if (legacy) {
        legacy.status = "Submitted";
        legacy.submittedAt = intake.submittedAt;
        legacy.consent = intake.consent.toObject();
        legacy.backgroundAndPsychosocialHistory =
          intake.backgroundAndPsychosocialHistory.toObject();
        await legacy.save({ session });
      }
      return intake._id;
    });
    res.status(201).json({ reference: id, message: "Your intake is pending counselor review." });
  })
);
router.use(protect, counselorOnly);
router.get(
  "/counselors",
  wrap(async (req, res) => {
    const users = await User.find({ role: { $in: ["Counselor-Admin", "Counselor-User"] } }).select(
      "firstName lastName collegesHandled availability isActive"
    );
    res.json(
      users.map((user) => {
        const value = user.toObject();
        if (req.user.role !== "Counselor-Admin" && String(user._id) !== String(req.user._id))
          delete value.availability?.reason;
        return value;
      })
    );
  })
);
router.patch(
  "/counselors/:id/availability",
  wrap(async (req, res) => {
    const { status, from, until, reason = "" } = req.body;
    if (!["Available", "On Leave", "Absent", "Unavailable"].includes(status))
      fail("Invalid availability status.");
    if (
      (from && !Number.isFinite(new Date(from).getTime())) ||
      (until && !Number.isFinite(new Date(until).getTime())) ||
      (from && until && new Date(from) >= new Date(until))
    )
      fail("Provide a valid availability date range.");
    const result = await transaction(async (session) => {
      const user = await editableCounselor(req, session);
      user.availability = {
        status,
        from: from || null,
        until: until || null,
        reason: String(reason).slice(0, 500),
      };
      user.schedulingRevision += 1;
      await user.save({ session });
      const slots = await Slot.find({ counselor: user._id, endsAt: { $gt: new Date() } }).session(
        session
      );
      const affected = slots
        .filter((s) => !availableAt(user, s.startsAt, s.endsAt))
        .map((s) => s._id);
      await releaseUnavailableBookings(Intake, affected, req.user._id, session,
        "Counselor became unavailable");
      return { message: "Availability updated. Unconverted bookings are available in the shared queue; existing cases need rescheduling." };
    });
    res.json(result);
  })
);
router.get(
  "/calendar/:id",
  wrap(async (req, res) => {
    const id = oid(req.params.id);
    if (req.user.role !== "Counselor-Admin" && id !== String(req.user._id))
      fail("You can only view your own calendar.", 403);
    await ensureDefaultSlots([id]);
    const slots = await Slot.find({ counselor: id }).sort({ startsAt: 1 });
    const appointments = await Intake.find({
      assignedCounselor: id,
      status: { $ne: "Awaiting Submission" },
    }).select(
      "identity.firstName identity.lastName slot appointmentStatus status linkedCase preferredAt"
    );
    res.json({ slots, appointments });
  })
);
router.post(
  "/counselors/:id/slots",
  wrap(async (req, res) => {
    const start = new Date(req.body.startsAt),
      end = new Date(req.body.endsAt);
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start <= new Date() ||
      end <= start ||
      end - start > 8 * 3600000
    )
      fail("Choose a future slot lasting at most eight hours.");
    await transaction(async (session) => {
      const user = await editableCounselor(req, session);
      user.schedulingRevision += 1;
      await user.save({ session });
      if (!availableAt(user, start, end)) fail("The counselor is unavailable during this period.");
      if (
        await Slot.exists({
          counselor: user._id,
          startsAt: { $lt: end },
          endsAt: { $gt: start },
        }).session(session)
      )
        fail("This overlaps an existing calendar slot.", 409);
      await Slot.create([{ counselor: user._id, startsAt: start, endsAt: end }], { session });
    });
    res.status(201).json({ message: "Bookable slot added." });
  })
);
router.patch(
  "/slots/:id/block",
  wrap(async (req, res) => {
    if (typeof req.body.isBlocked !== "boolean") fail("Specify whether the slot is blocked.");
    await transaction(async (session) => {
      const slot = await Slot.findById(oid(req.params.id)).session(session);
      if (!slot) fail("Slot not found.", 404);
      if (req.user.role !== "Counselor-Admin" && String(slot.counselor) !== String(req.user._id))
        fail("Not your calendar.", 403);
      slot.isBlocked = req.body.isBlocked;
      slot.revision += 1;
      await slot.save({ session });
      if (slot.isBlocked)
        await releaseUnavailableBookings(Intake, [slot._id], req.user._id, session,
          "Appointment slot blocked");
    });
    res.json({ message: "Calendar updated." });
  })
);
router.get(
  "/intakes",
  wrap(async (req, res) => {
    // Shared queue contains routing details only. Assignment unlocks the full intake.
    const records = await Intake.find({
      $or: [
        { assignedCounselor: null, status: "Pending Review" },
        { assignedCounselor: req.user._id, status: { $ne: "Awaiting Submission" } },
      ],
    })
      .select(
        "identity.college entryType status appointmentStatus assignedCounselor preferredAt slot submittedAt linkedCase"
      )
      .populate("slot", "startsAt endsAt")
      .sort({ submittedAt: -1 });
    res.json(records);
  })
);
router.get(
  "/intakes/:id",
  wrap(async (req, res) => {
    const intake = await Intake.findById(oid(req.params.id)).populate("slot");
    if (!intake) fail("Intake not found.", 404);
    if (!ownsIntake(intake, req.user))
      fail("Accept this request before viewing confidential responses.", 403);
    res.json(intake);
  })
);
router.post(
  "/intakes/:id/accept",
  wrap(async (req, res) => {
    await transaction(async (session) => {
      const intake = await Intake.findOne({
        _id: oid(req.params.id),
        status: "Pending Review",
        assignedCounselor: null,
      }).session(session);
      if (!intake) fail("This request has already been accepted or closed.", 409);
      const slot = await reserve(req.body.slotId, session);
      if (String(slot.counselor) !== String(req.user._id))
        fail("Choose a slot from your own calendar.", 403);
      intake.assignedCounselor = req.user._id;
      intake.slot = slot._id;
      intake.reservationActive = true;
      intake.appointmentStatus = "Booked";
      intake.history.push({ action: "Accepted", actor: req.user._id });
      await intake.save({ session });
    });
    res.json({ message: "Booking accepted." });
  })
);
router.post(
  "/intakes/:id/convert",
  wrap(async (req, res) => {
    const caseId = await transaction(async (session) => {
      const intake = await Intake.findById(oid(req.params.id)).session(session);
      if (!intake) fail("Intake not found.", 404);
      if (!ownsIntake(intake, req.user))
        fail("Only the assigned counselor can create this case.", 403);
      if (intake.linkedCase) return intake.linkedCase;
      if (intake.status !== "Pending Review") fail("This intake is no longer pending review.", 409);
      const narrative =
        req.body.currentPresentation?.narrativeDescription ?? req.body.narrativeDescription;
      const mainDomain = req.body.problemAssessment?.mainDomain ?? req.body.mainDomain;
      if (typeof narrative !== "string" || !narrative.trim())
        fail("Complete the presenting concern in the New Case form.");
      if (
        !["Academic-Educational", "Career-Vocational", "Personal-Social", "Other"].includes(
          mainDomain
        )
      )
        fail("Select the assessment domain in the New Case form.");
      if (
        req.body.problemAssessment &&
        (!Array.isArray(req.body.problemAssessment.primaryProblems) ||
          !req.body.problemAssessment.primaryProblems.some(
            (value) => typeof value === "string" && value.trim()
          ))
      )
        fail("Add at least one primary problem.");
      if (
        req.body.counselorNotes !== undefined &&
        (typeof req.body.counselorNotes !== "string" || req.body.counselorNotes.length > 20000)
      )
        fail("Counselor notes must be text of at most 20,000 characters.");
      const consent = req.body.consent || intake.consent.toObject();
      if (
        ["hasConsent", "confidentialityAgreementAccepted", "dataPrivacyNoticeAccepted"].some(
          (key) => consent[key] !== true
        )
      )
        fail("All consent acknowledgments must be accepted.");
      let student = await Student.findOne({
        studentIdNumber: intake.identity.studentIdNumber,
      }).session(session);
      if (student?.isArchived)
        fail(
          "This student record is archived. Restore it in Student Records before creating a case.",
          409
        );
      const identityMismatch = Boolean(student && student.email !== intake.identity.email);
      if (identityMismatch && req.body.identityVerified !== true)
        fail(
          "The intake email differs from the saved student email. Verify the student identity in the New Case form.",
          409
        );
      if (!student) {
        [student] = await Student.create(
          [{ ...intake.identity.toObject(), createdBy: req.user._id }],
          { session }
        );
      }
      // Serialize concurrent conversions for the same student before checking for an active case.
      await Student.updateOne({ _id: student._id }, { $inc: { __v: 1 } }, { session });
      if (
        await Case.exists({
          student: student._id,
          caseStatus: { $nin: ["Closed", "Terminated"] },
          isArchived: { $ne: true },
        }).session(session)
      )
        fail(
          "This student has an active case. Review it and explicitly link this intake if you handle that case.",
          409
        );
      const record = new Case({
        caseNumber: await nextCaseNumber({ session }),
        intake: intake._id,
        student: student._id,
        assignedCounselor: req.user._id,
        clientEntryType: intake.entryType,
        caseStatus: "Open",
        consent,
        backgroundAndPsychosocialHistory:
          req.body.backgroundAndPsychosocialHistory ||
          intake.backgroundAndPsychosocialHistory.toObject(),
        currentPresentation: {
          ...req.body.currentPresentation,
          narrativeDescription: narrative.trim(),
        },
        problemAssessment: { ...req.body.problemAssessment, mainDomain },
        counselorNotes: req.body.counselorNotes,
        mentalStatus: req.body.mentalStatus,
        caseFormulation: req.body.caseFormulation,
        referralInformation: req.body.referralInformation,
        dateOpened: new Date(),
        createdBy: req.user._id,
        actionHistory: [
          {
            action: "Created",
            remarks: identityMismatch
              ? "Created from reviewed pre-counseling intake. Counselor explicitly verified the student ID despite an email mismatch; saved student profile preserved."
              : "Created from reviewed pre-counseling intake.",
            actionBy: req.user._id,
            toCounselor: req.user._id,
            actionDate: new Date(),
          },
        ],
      });
      await record.save({ session });
      intake.linkedCase = record._id;
      intake.status = "Converted to Case";
      if (intake.legacyForm)
        await LegacyForm.updateOne(
          { _id: intake.legacyForm },
          { $set: { linkedCase: record._id, usedAt: new Date() } },
          { session }
        );
      intake.history.push({ action: "Converted to Case", actor: req.user._id });
      await intake.save({ session });
      return record._id;
    });
    res.json({ caseId });
  })
);
router.post(
  "/intakes/:id/link-case",
  wrap(async (req, res) => {
    await transaction(async (session) => {
      const intake = await Intake.findById(oid(req.params.id)).session(session);
      if (!intake || !ownsIntake(intake, req.user)) fail("Intake access denied.", 403);
      if (intake.status !== "Pending Review" || intake.linkedCase)
        fail("This intake is already closed or converted.", 409);
      const record = await Case.findOne({
        _id: oid(req.body.caseId),
        assignedCounselor: req.user._id,
        isArchived: { $ne: true },
        caseStatus: { $nin: ["Closed", "Terminated"] },
      })
        .populate("student")
        .session(session);
      if (
        !record ||
        record.student.studentIdNumber !== intake.identity.studentIdNumber ||
        record.student.email !== intake.identity.email
      )
        fail("Choose an active case you handle for this verified student.", 403);
      intake.linkedCase = record._id;
      intake.status = "Converted to Case";
      if (intake.legacyForm)
        await LegacyForm.updateOne(
          { _id: intake.legacyForm },
          { $set: { linkedCase: record._id, usedAt: new Date() } },
          { session }
        );
      intake.history.push({ action: "Linked to existing case", actor: req.user._id });
      await intake.save({ session });
    });
    res.json({
      message: "Intake linked to the existing case. Existing case notes were preserved.",
    });
  })
);
router.patch(
  "/intakes/:id/appointment",
  wrap(async (req, res) => {
    await transaction(async (session) => {
      const intake = await Intake.findById(oid(req.params.id)).session(session);
      if (!intake) fail("Intake not found.", 404);
      const owner = ownsIntake(intake, req.user);
      const admin = req.user.role === "Counselor-Admin";
      if (!owner && !admin) fail("Appointment access denied.", 403);
      if (req.body.slotId) {
        if (!["Pending Review", "Converted to Case"].includes(intake.status))
          fail("Closed intakes cannot be rescheduled.");
        const slot = await reserve(req.body.slotId, session);
        if (!admin && String(slot.counselor) !== String(req.user._id))
          fail("Only Counselor Admin can reassign a booking.", 403);
        // Reassigning an established case must use the existing case reassignment controls.
        if (intake.linkedCase && String(slot.counselor) !== String(intake.assignedCounselor))
          fail("Reassign the official case through case management first.");
        intake.slot = slot._id;
        intake.assignedCounselor = slot.counselor;
        intake.reservationActive = true;
        intake.appointmentStatus = "Booked";
        intake.history.push({ action: "Rescheduled / reassigned", actor: req.user._id });
      } else {
        if (!owner) fail("Only the handling counselor can close an appointment.", 403);
        const status = req.body.status;
        if (!["Completed", "Cancelled", "Declined"].includes(status))
          fail("Invalid appointment action.");
        if (status === "Declined" && intake.linkedCase)
          fail("An official case cannot be declined.");
        intake.appointmentStatus = status === "Completed" ? "Completed" : "Cancelled";
        intake.reservationActive = false;
        if (status === "Declined" || (status === "Cancelled" && !intake.linkedCase))
          intake.status = status;
        intake.history.push({ action: status, actor: req.user._id });
      }
      await intake.save({ session });
    });
    res.json({ message: "Appointment updated." });
  })
);
router.get(
  "/case-assignments",
  wrap(async (req, res) => {
    if (req.user.role !== "Counselor-Admin") fail("Counselor Admin access required.", 403);
    res.json(
      await Case.find({ isArchived: { $ne: true } })
        .select("caseNumber assignedCounselor student caseStatus")
        .populate("student", "college")
        .sort({ createdAt: -1 })
    );
  })
);
router.get(
  "/intakes/:id/existing-cases",
  wrap(async (req, res) => {
    const intake = await Intake.findById(oid(req.params.id));
    if (!intake || !ownsIntake(intake, req.user)) fail("Intake access denied.", 403);
    const student = await Student.findOne({
      studentIdNumber: intake.identity.studentIdNumber,
      email: intake.identity.email,
      isArchived: { $ne: true },
    }).select("_id");
    if (!student) return res.json([]);
    res.json(
      await Case.find({
        student: student._id,
        assignedCounselor: req.user._id,
        isArchived: { $ne: true },
        caseStatus: { $nin: ["Closed", "Terminated"] },
      }).select("caseNumber caseStatus")
    );
  })
);
router.get(
  "/rescheduling",
  wrap(async (req, res) => {
    if (req.user.role !== "Counselor-Admin") fail("Counselor Admin access required.", 403);
    res.json(
      await Intake.find({ appointmentStatus: "Needs Rescheduling" })
        .select("identity.college assignedCounselor slot status linkedCase")
        .populate("slot", "startsAt endsAt")
    );
  })
);
router.post(
  "/invitations",
  wrap(async (req, res) => {
    const student = await Student.findById(oid(req.body.studentId));
    if (!student || student.isArchived) fail("Active student record required.", 404);
    const token = crypto.randomBytes(32).toString("hex");
    const intake = await Intake.create({
      identity: Object.fromEntries(
        [
          "studentIdNumber",
          "firstName",
          "lastName",
          "email",
          "college",
          "program",
          "yearLevel",
          "contactNumber",
        ].map((k) => [k, student[k]])
      ),
      entryType: "Scheduled",
      status: "Awaiting Submission",
      token: hash(token),
      tokenExpiresAt: new Date(Date.now() + 7 * 86400000),
      history: [{ action: "Invited", actor: req.user._id }],
    });
    try {
      await transporter.sendMail({
        to: student.email,
        subject: "My.GUIDE counseling booking and pre-counseling form",
        text: `Complete your booking and pre-counseling intake: ${process.env.FRONTEND_URL || "http://localhost:5174"}/booking/${token}\nThis private link expires in seven days.`,
      });
    } catch (error) {
      await Intake.deleteOne({ _id: intake._id, status: "Awaiting Submission" });
      throw error;
    }
    res.status(201).json({ message: "Private booking invitation sent." });
  })
);
// Keep booking errors explicit for clients, including validation failures.
router.use((error, req, res, next) => {
  if (error.code === 20)
    return res.status(503).json({
      message: "Automatic booking availability requires MongoDB running as a replica set.",
    });
  if (error.name === "ValidationError" || error.name === "CastError")
    return res.status(400).json({ message: error.message });
  if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
  next(error);
});
module.exports = router;
