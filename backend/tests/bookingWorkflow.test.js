const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Intake = require("../models/counselingIntake");
const Slot = require("../models/counselorSlot");
const User = require("../models/user");
const Case = require("../models/case");
const { availableAt, ownsIntake, validateSubmission } = require("../services/bookingRules");
const identity = {
  studentIdNumber: "2026-1",
  firstName: "Test",
  lastName: "Student",
  email: "test@example.com",
  college: "CCS",
  yearLevel: "1",
};
const consent = {
  hasConsent: true,
  confidentialityAgreementAccepted: true,
  dataPrivacyNoticeAccepted: true,
};
const response = () => ({
  code: 200,
  status(code) {
    this.code = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
const chain = (value) => ({
  select() {
    return this;
  },
  populate() {
    return this;
  },
  session() {
    return Promise.resolve(value);
  },
  // Mongoose queries are intentionally thenable in these persistence doubles.
  // oxlint-disable-next-line unicorn/no-thenable
  then(ok, bad) {
    return Promise.resolve(value).then(ok, bad);
  },
});
const invoke = async (handler, req, res = response()) => {
  let failure;
  await handler(req, res, (error) => {
    failure = error;
  });
  if (failure) throw failure;
  return res;
};

test("dated availability respects absence boundaries and inactive accounts", () => {
  const user = {
    role: "Counselor-User",
    isActive: true,
    availability: {
      status: "On Leave",
      from: "2030-01-10T00:00:00Z",
      until: "2030-01-12T00:00:00Z",
    },
  };
  assert.equal(
    availableAt(user, new Date("2030-01-09T23:00Z"), new Date("2030-01-10T00:00Z")),
    true
  );
  assert.equal(
    availableAt(user, new Date("2030-01-10T01:00Z"), new Date("2030-01-10T02:00Z")),
    false
  );
  assert.equal(
    availableAt(user, new Date("2030-01-12T00:00Z"), new Date("2030-01-12T01:00Z")),
    true
  );
  user.availability = { status: "Absent" };
  assert.equal(availableAt(user, new Date(), new Date()), false);
  user.availability.status = "Available";
  user.isActive = false;
  assert.equal(availableAt(user, new Date(), new Date()), false);
});
test("active counselors without a saved availability status default to available", () => {
  const user = { role: "Counselor-User", isActive: true };
  const start = new Date("2030-01-10T01:00:00Z");
  const end = new Date("2030-01-10T02:00:00Z");
  assert.equal(availableAt(user, start, end), true);
  user.availability = {};
  assert.equal(availableAt(user, start, end), true);
  user.availability = { status: "Unavailable" };
  assert.equal(availableAt(user, start, end), false);
});

test("walk-ins require explicit consent; scheduled shared requests require a future time", () => {
  assert.doesNotThrow(() => validateSubmission({ identity, consent, entryType: "Walk-in" }));
  assert.throws(
    () =>
      validateSubmission({
        identity,
        consent: { ...consent, hasConsent: "true" },
        entryType: "Walk-in",
      }),
    /consent/
  );
  assert.throws(
    () => validateSubmission({ identity, consent, entryType: "Scheduled" }),
    /future preferred time/
  );
  assert.doesNotThrow(() =>
    validateSubmission({
      identity,
      consent,
      entryType: "Scheduled",
      preferredAt: "2099-01-01T00:00Z",
    })
  );
});
test("each intake has its own ID and the database indexes enforce one active reservation and one conversion", async () => {
  const a = new Intake({ identity, consent, entryType: "Walk-in" });
  const b = new Intake({ identity, consent, entryType: "Walk-in" });
  await a.validate();
  await b.validate();
  assert.notEqual(String(a._id), String(b._id));
  assert.equal(a.linkedCase, null);
  assert.equal(a.status, "Pending Review");
  assert.ok(
    Intake.schema
      .indexes()
      .some(
        ([fields, opts]) =>
          fields.slot === 1 &&
          opts.unique &&
          opts.partialFilterExpression.reservationActive === true
      )
  );
  assert.ok(Case.schema.indexes().some(([fields, opts]) => fields.intake === 1 && opts.unique));
  a.assignedCounselor = new mongoose.Types.ObjectId();
  assert.equal(ownsIntake(a, { _id: a.assignedCounselor }), true);
  assert.equal(
    ownsIntake(a, { _id: new mongoose.Types.ObjectId(), role: "Counselor-Admin" }),
    false
  );
});
test("case access follows permanent assignment; legacy temporary grants never authorize access", async () => {
  const guard = require("../middleware/caseOwnership");
  const original = Case.findById;
  const owner = new mongoose.Types.ObjectId(),
    other = new mongoose.Types.ObjectId(),
    caseId = new mongoose.Types.ObjectId();
  const record = { assignedCounselor: owner, temporaryCounselor: [] };
  Case.findById = () => chain(record);
  try {
    let passed = false;
    await guard({ path: `/${caseId}`, user: { _id: owner } }, response(), () => {
      passed = true;
    });
    assert.equal(passed, true);
    for (const role of ["Counselor-User", "Counselor-Admin"])
      assert.equal(
        (await invoke(guard, { path: `/${caseId}`, user: { _id: other, role } })).code,
        403
      );
    record.temporaryCounselor.push({
      counselor: other,
      isActive: true,
      accessUntil: new Date(Date.now() + 60000),
    });
    passed = false;
    await guard({ path: `/${caseId}/timeline`, user: { _id: other } }, response(), () => {
      passed = true;
    });
    assert.equal(passed, false);
  } finally {
    Case.findById = original;
  }
});
test("acceptance only takes a pending unassigned request into the accepting counselor’s free slot", async () => {
  const router = require("../routes/bookingRoutes");
  const handler = router.stack.find((layer) => layer.route?.path === "/intakes/:id/accept").route
    .stack[0].handle;
  const originals = [
    mongoose.startSession,
    Intake.findOne,
    Slot.findOneAndUpdate,
    User.findOneAndUpdate,
    Intake.exists,
  ];
  const owner = new mongoose.Types.ObjectId(),
    slotId = new mongoose.Types.ObjectId(),
    intakeId = new mongoose.Types.ObjectId();
  let saved = false,
    ended = false;
  const intake = {
    _id: intakeId,
    history: [],
    async save() {
      saved = true;
    },
  };
  mongoose.startSession = async () => ({
    async withTransaction(fn) {
      await fn();
    },
    async endSession() {
      ended = true;
    },
  });
  Intake.findOne = (filter) => {
    assert.equal(filter.assignedCounselor, null);
    assert.equal(filter.status, "Pending Review");
    return chain(intake);
  };
  Slot.findOneAndUpdate = () =>
    chain({
      _id: slotId,
      counselor: owner,
      startsAt: new Date("2099-01-01T01:00Z"),
      endsAt: new Date("2099-01-01T02:00Z"),
    });
  User.findOneAndUpdate = () =>
    chain({
      _id: owner,
      isActive: true,
      role: "Counselor-User",
      availability: { status: "Available" },
    });
  Intake.exists = () => chain(null);
  try {
    const req = {
      params: { id: String(intakeId) },
      user: { _id: owner },
      body: { slotId: String(slotId) },
    };
    await invoke(handler, req);
    assert.equal(saved, true);
    assert.equal(ended, true);
    assert.equal(intake.reservationActive, true);
    assert.equal(intake.appointmentStatus, "Booked");
    saved = false;
    Intake.exists = () => chain({ _id: intakeId });
    await assert.rejects(invoke(handler, req), /already been booked/);
    assert.equal(saved, false);
    Intake.exists = () => chain(null);
    await assert.rejects(
      invoke(handler, { ...req, user: { _id: new mongoose.Types.ObjectId() } }),
      /own calendar/
    );
    assert.equal(saved, false);
    Intake.findOne = () => chain(null);
    await assert.rejects(invoke(handler, req), /already been accepted/);
  } finally {
    [
      mongoose.startSession,
      Intake.findOne,
      Slot.findOneAndUpdate,
      User.findOneAndUpdate,
      Intake.exists,
    ] = originals;
  }
});
test("intake details stay private until assignment; conversion returns the same case on retry", async () => {
  const router = require("../routes/bookingRoutes");
  const detail = router.stack.find((layer) => layer.route?.path === "/intakes/:id").route.stack[0]
    .handle;
  const convert = router.stack.find((layer) => layer.route?.path === "/intakes/:id/convert").route
    .stack[0].handle;
  const originals = [mongoose.startSession, Intake.findById];
  const owner = new mongoose.Types.ObjectId(),
    intakeId = new mongoose.Types.ObjectId(),
    caseId = new mongoose.Types.ObjectId();
  const record = { assignedCounselor: null };
  Intake.findById = () => chain(record);
  mongoose.startSession = async () => ({
    async withTransaction(fn) {
      await fn();
    },
    async endSession() {},
  });
  try {
    const req = { params: { id: String(intakeId) }, user: { _id: owner }, body: {} };
    await assert.rejects(invoke(detail, req), /Accept this request/);
    await assert.rejects(invoke(convert, req), /Only the assigned/);
    record.assignedCounselor = owner;
    record.status = "Pending Review";
    await assert.rejects(invoke(convert, req), /presenting concern/);
    record.linkedCase = caseId;
    assert.equal(String((await invoke(convert, req)).body.caseId), String(caseId));
  } finally {
    [mongoose.startSession, Intake.findById] = originals;
  }
});
test("public intake submission ignores forged ownership, case links, and status", async () => {
  const router = require("../routes/bookingRoutes");
  const handler = router.stack
    .find((layer) => layer.route?.path === "/public/intakes")
    .route.stack.at(-1).handle;
  const originals = [mongoose.startSession, Intake.prototype.save];
  let saved;
  mongoose.startSession = async () => ({
    async withTransaction(fn) {
      await fn();
    },
    async endSession() {},
  });
  Intake.prototype.save = async function () {
    await this.validate();
    saved = this.toObject();
    return this;
  };
  try {
    const res = await invoke(handler, {
      body: {
        identity: { ...identity, isArchived: true },
        consent,
        entryType: "Walk-in",
        assignedCounselor: new mongoose.Types.ObjectId(),
        linkedCase: new mongoose.Types.ObjectId(),
        status: "Converted to Case",
        reservationActive: true,
        backgroundAndPsychosocialHistory: { academicContext: "Current intake only" },
      },
    });
    assert.equal(res.code, 201);
    assert.ok(res.body.reference);
    assert.equal(saved.status, "Pending Review");
    assert.equal(saved.assignedCounselor, null);
    assert.equal(saved.linkedCase, null);
    assert.equal(saved.reservationActive, false);
    assert.equal(saved.identity.isArchived, undefined);
    assert.equal(saved.backgroundAndPsychosocialHistory.academicContext, "Current intake only");
  } finally {
    [mongoose.startSession, Intake.prototype.save] = originals;
  }
});
test("conversion copies this exact intake, validates a real case, and never changes an existing student profile", async (t) => {
  const Student = require("../models/student");
  const router = require("../routes/bookingRoutes");
  const handler = router.stack.find((layer) => layer.route?.path === "/intakes/:id/convert").route
    .stack[0].handle;
  t.mock.method(Case, "find", () => ({
    select: () => ({ session: () => ({ lean: async () => [] }) }),
  }));
  t.mock.method(mongoose.connection, "collection", () => ({
    findOneAndUpdate: async () => ({ sequence: 7 }),
  }));
  const originals = [
    mongoose.startSession,
    Intake.findById,
    Student.findOne,
    Student.updateOne,
    Case.exists,
    Case.prototype.save,
    Intake.prototype.save,
  ];
  const owner = new mongoose.Types.ObjectId(),
    studentId = new mongoose.Types.ObjectId();
  const intake = new Intake({
    identity,
    consent,
    entryType: "Walk-in",
    assignedCounselor: owner,
    backgroundAndPsychosocialHistory: {
      academicContext: "Only this intake",
      medicalHistory: { hasHistory: true, description: "Intake fixture" },
    },
  });
  let record,
    studentLocked = false;
  mongoose.startSession = async () => ({
    async withTransaction(fn) {
      await fn();
    },
    async endSession() {},
  });
  Intake.findById = () => chain(intake);
  Student.findOne = () => chain({ _id: studentId, email: identity.email, isArchived: false });
  Student.updateOne = async (filter, update) => {
    assert.equal(String(filter._id), String(studentId));
    assert.deepEqual(update, { $inc: { __v: 1 } });
    studentLocked = true;
  };
  Case.exists = () => chain(null);
  Case.prototype.save = async function () {
    await this.validate();
    record = this.toObject();
    return this;
  };
  Intake.prototype.save = async function () {
    await this.validate();
    return this;
  };
  try {
    const req = {
      params: { id: String(intake._id) },
      user: { _id: owner },
      body: { narrativeDescription: "Reviewed concern", mainDomain: "Academic-Educational" },
    };
    const res = await invoke(handler, req);
    assert.ok(studentLocked);
    assert.match(record.caseNumber, /^CASE-\d{4}-0007$/);
    assert.equal(String(record.student), String(studentId));
    assert.equal(String(record.assignedCounselor), String(owner));
    assert.equal(String(record.intake), String(intake._id));
    assert.equal(String(intake.linkedCase), String(res.body.caseId));
    assert.equal(intake.status, "Converted to Case");
    assert.equal(record.backgroundAndPsychosocialHistory.academicContext, "Only this intake");
    assert.equal(
      record.backgroundAndPsychosocialHistory.medicalHistory.description,
      "Intake fixture"
    );
    assert.equal(record.currentPresentation.narrativeDescription, "Reviewed concern");
  } finally {
    [
      mongoose.startSession,
      Intake.findById,
      Student.findOne,
      Student.updateOne,
      Case.exists,
      Case.prototype.save,
      Intake.prototype.save,
    ] = originals;
  }
});

test("case creation requires assessment for both intake-linked and direct cases", async () => {
  for (const intake of [undefined, new mongoose.Types.ObjectId()]) {
    const record = new Case({
      intake,
      caseNumber: "FIXTURE",
      student: new mongoose.Types.ObjectId(),
      assignedCounselor: new mongoose.Types.ObjectId(),
      clientEntryType: "Walk-in",
    });
    await assert.rejects(record.validate(), (error) =>
      Boolean(
        error.errors["currentPresentation.narrativeDescription"] &&
        error.errors["problemAssessment.mainDomain"]
      )
    );
  }
});

test("temporary grants are retired and permanent transfer routes accept counselor roles", async () => {
  const routes = require("../routes/caseRoutes");
  const grant = routes.stack
    .find((layer) => layer.route?.path === "/:id/temporary-access")
    .route.stack.at(-1).handle;
  assert.equal((await invoke(grant, {})).code, 410);
  assert.ok(
    routes.stack.some((layer) => layer.route?.path === "/:id/transfer" && layer.route.methods.patch)
  );
});
