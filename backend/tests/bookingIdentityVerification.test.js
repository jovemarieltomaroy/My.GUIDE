const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createIdentityVerification } = require("../services/bookingIdentityVerification");

function fixture({ exists = true, deliver = true } = {}) {
  let date = new Date("2030-01-01T00:00:00Z");
  const records = [], mail = [];
  const student = { _id: "student-1", studentIdNumber: "2026-1234", firstName: "Test", lastName: "Student",
    email: "student@example.com", college: "CCS", program: "BSCS", contactNumber: "09000000000", yearLevel: "3",
    isArchived: false, counselingNotes: "must never be released" };
  const matches = (record, query) => Object.entries(query).every(([key, value]) => {
    const actual = record[key];
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("$lt" in value) return actual < value.$lt;
      if ("$gt" in value) return actual > value.$gt;
      if ("$gte" in value) return actual >= value.$gte;
      if ("$ne" in value) return actual !== value.$ne;
    }
    return actual === value;
  });
  const Challenge = {
    async countDocuments(query) { return records.filter(record => matches(record, query)).length; },
    async create(value) { const record = { _id: String(records.length), attempts: 0, verifiedAt: null, consumedAt: null, ...value }; records.push(record); return record; },
    findOneAndUpdate(query, update) {
      const record = records.find(record => matches(record, query));
      if (record) {
        for (const [key, value] of Object.entries(update.$inc || {})) record[key] += value;
        Object.assign(record, update.$set);
      }
      return { lean: async () => record ? { ...record } : null };
    },
  };
  const Student = { findOne(query) { return { select(fields) { return { lean: async () => {
    if (!exists || !matches(student, query)) return null;
    return Object.fromEntries(fields.split(" ").map(field => [field, student[field]]));
  } }; } }; } };
  const service = createIdentityVerification({ Challenge, Student, secret: "test-secret", now: () => date,
    sendMail: async value => { if (!deliver) throw new Error("mail unavailable"); mail.push(value); } });
  const request = () => service.request(" 2026-1234 ", "test-ip");
  const code = () => mail.at(-1).text.match(/code is (\d{6})/)[1];
  const verify = challenge => service.verify({ studentIdNumber: student.studentIdNumber, challenge, code: code() });
  return { service, request, code, verify, student, records, mail, advance: ms => { date = new Date(date.getTime() + ms); } };
}

test("only verified name is released before confirmation; allowlisted identity only after confirmation", async () => {
  const f = fixture();
  const response = await f.request();
  assert.deepEqual(Object.keys(response).sort(), ["challenge", "message"]);
  assert.equal(f.mail[0].to, f.student.email);
  assert.ok(!JSON.stringify(response).includes(f.student.email));
  assert.match(f.records[0].codeHash, /^[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(f.records[0], "code"), false);
  const verified = await f.verify(response.challenge);
  assert.deepEqual(Object.keys(verified).sort(), ["confirmationToken", "name"]);
  assert.deepEqual(verified.name, { firstName: "Test", lastName: "Student" });
  const { identity } = await f.service.confirm({ studentIdNumber: "2026-1234", confirmationToken: verified.confirmationToken });
  assert.deepEqual(Object.keys(identity).sort(), ["college", "contactNumber", "email", "firstName", "lastName", "program", "studentIdNumber", "yearLevel"].sort());
  assert.equal(identity.email, f.student.email);
  assert.equal(identity.counselingNotes, undefined);
  assert.equal(identity.entryType, undefined);
  assert.equal(f.student.firstName, "Test");
});

test("missing records get the same generic response shape and cannot verify", async () => {
  const f = fixture({ exists: false });
  const response = await f.request();
  assert.equal(f.mail.length, 0);
  assert.deepEqual(Object.keys(response).sort(), ["challenge", "message"]);
  assert.equal(response.message, (await fixture().request()).message);
  await assert.rejects(f.service.verify({ studentIdNumber: "2026-1234", challenge: response.challenge, code: "000000" }), /invalid/);
});

test("five incorrect guesses lock a challenge even if the next code is correct", async () => {
  const f = fixture(), { challenge } = await f.request();
  const wrong = f.code() === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await assert.rejects(f.service.verify({ studentIdNumber: "2026-1234", challenge, code: wrong }), /invalid/);
  await assert.rejects(f.verify(challenge), /invalid/);
  assert.equal(f.records[0].attempts, 5);
});

test("expiry is checked in queries, independent of the TTL cleanup schedule", async () => {
  const f = fixture(), { challenge } = await f.request();
  f.advance(10 * 60000);
  await assert.rejects(f.verify(challenge), /expired/);
  const g = fixture(), response = await g.request(), verified = await g.verify(response.challenge);
  g.advance(10 * 60000);
  await assert.rejects(g.service.confirm({ studentIdNumber: "2026-1234", confirmationToken: verified.confirmationToken }), /expired/);
});

test("code and name-confirmation tokens are single-use and bound to the student ID", async () => {
  const f = fixture(), { challenge } = await f.request();
  await assert.rejects(f.service.verify({ studentIdNumber: "different-id", challenge, code: f.code() }), /invalid/);
  const verified = await f.verify(challenge);
  await assert.rejects(f.verify(challenge), /invalid/);
  await assert.rejects(f.service.confirm({ studentIdNumber: "different-id", confirmationToken: verified.confirmationToken }), /invalid/);
  const confirmations = await Promise.allSettled([1, 2].map(() => f.service.confirm({ studentIdNumber: "2026-1234", confirmationToken: verified.confirmationToken })));
  assert.equal(confirmations.filter(result => result.status === "fulfilled").length, 1);
});

test("archiving a student after requesting prevents disclosure", async () => {
  const f = fixture(), { challenge } = await f.request();
  f.student.isArchived = true;
  await assert.rejects(f.verify(challenge), /invalid/);
  const g = fixture(), response = await g.request(), verified = await g.verify(response.challenge);
  g.student.isArchived = true;
  await assert.rejects(g.service.confirm({ studentIdNumber: "2026-1234", confirmationToken: verified.confirmationToken }), /invalid/);
});

test("request quotas apply to student IDs and IPs, including nonexistent IDs", async () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) await f.request();
  await assert.rejects(f.request(), error => error.statusCode === 429);
  const g = fixture({ exists: false });
  for (let i = 0; i < 10; i++) await g.service.request(`unknown-${i}`, "one-ip");
  await assert.rejects(g.service.request("another-id", "one-ip"), error => error.statusCode === 429);
  g.advance(10 * 60000 + 1);
  assert.ok((await g.service.request("another-id", "one-ip")).challenge);
});

test("rejects malformed input without accepting objects as student IDs", async () => {
  const f = fixture();
  for (const value of [undefined, {}, { $ne: null }, "", "x".repeat(151)])
    await assert.rejects(f.service.request(value, "test"), /valid student ID/);
  await assert.rejects(f.service.verify({ studentIdNumber: "2026-1234", challenge: {}, code: "123456" }), /invalid/);
  await assert.rejects(f.service.confirm({ studentIdNumber: "2026-1234", confirmationToken: "bad" }), /invalid/);
});
