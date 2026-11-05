const crypto = require("node:crypto");
const FIELDS = ["studentIdNumber", "firstName", "lastName", "email", "college", "program", "contactNumber", "yearLevel"];
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const invalid = () => fail("The code is invalid, expired, or already used. Request a new code.");
const normalizeId = value => {
  if (typeof value !== "string" || !value.trim() || value.length > 150)
    fail("Enter a valid student ID number.");
  return value.trim().toUpperCase();
};
const equal = (a, b) => {
  const left = Buffer.from(a, "hex"), right = Buffer.from(b, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

// Dependency injection keeps tests isolated from student records and outbound email.
function createIdentityVerification({ Challenge, Student, sendMail, secret, now = () => new Date() }) {
  const codeHash = (challenge, code) => {
    if (!secret) fail("Email verification is not configured. Please enter your details manually.", 503);
    return crypto.createHmac("sha256", secret).update(`booking-identity:${challenge}:${code}`).digest("hex");
  };
  return {
    async request(studentIdNumber, ip) {
      const id = normalizeId(studentIdNumber), date = now();
      const studentIdHash = digest(id), ipHash = digest(String(ip || "unknown"));
      const since = new Date(date.getTime() - 10 * 60000);
      const [byId, byIp] = await Promise.all([
        Challenge.countDocuments({ studentIdHash, createdAt: { $gte: since } }),
        Challenge.countDocuments({ ipHash, createdAt: { $gte: since } }),
      ]);
      if (byId >= 3 || byIp >= 10) fail("Too many verification requests. Try again in ten minutes or enter your details manually.", 429);
      const challenge = crypto.randomBytes(32).toString("hex");
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
      const hashedCode = codeHash(challenge, code);
      const student = await Student.findOne({ studentIdNumber: id, isArchived: false }).select("_id email").lean();
      await Challenge.create({ challengeHash: digest(challenge), studentIdHash, ipHash,
        student: student?._id || null, codeHash: hashedCode, createdAt: date,
        expiresAt: new Date(date.getTime() + 10 * 60000) });
      if (student?.email) {
        try {
          await sendMail({ to: student.email, subject: "My.GUIDE student information verification",
            text: `Your My.GUIDE verification code is ${code}. It expires in 10 minutes. Do not share this code. If you did not request it, ignore this email.` });
        } catch {
          // Keep the public response identical for missing records and delivery failures.
          console.error("Booking identity verification email could not be delivered.");
        }
      }
      return { challenge, message: "If an active student record matches this ID, a code has been sent to the email already on file. Check your inbox and spam folder. You may also enter your details manually." };
    },
    async verify({ studentIdNumber, challenge, code }) {
      const id = normalizeId(studentIdNumber);
      if (typeof challenge !== "string" || !/^[a-f0-9]{64}$/.test(challenge) || typeof code !== "string" || !/^\d{6}$/.test(code)) invalid();
      const date = now();
      const record = await Challenge.findOneAndUpdate({ challengeHash: digest(challenge), studentIdHash: digest(id),
        attempts: { $lt: 5 }, verifiedAt: null, consumedAt: null, expiresAt: { $gt: date } },
      { $inc: { attempts: 1 } }, { returnDocument: "after" }).lean();
      if (!record || !equal(record.codeHash, codeHash(challenge, code)) || !record.student) invalid();
      const student = await Student.findOne({ _id: record.student, studentIdNumber: id, isArchived: false }).select("firstName lastName").lean();
      if (!student) invalid();
      const confirmationToken = crypto.randomBytes(32).toString("hex");
      const verified = await Challenge.findOneAndUpdate({ _id: record._id, verifiedAt: null, consumedAt: null, expiresAt: { $gt: now() } },
        { $set: { verifiedAt: now(), confirmationHash: digest(confirmationToken) } }, { returnDocument: "after" }).lean();
      if (!verified) invalid();
      return { name: { firstName: student.firstName, lastName: student.lastName }, confirmationToken };
    },
    async confirm({ studentIdNumber, confirmationToken }) {
      const id = normalizeId(studentIdNumber);
      if (typeof confirmationToken !== "string" || !/^[a-f0-9]{64}$/.test(confirmationToken)) invalid();
      const record = await Challenge.findOneAndUpdate({ studentIdHash: digest(id), confirmationHash: digest(confirmationToken),
        verifiedAt: { $ne: null }, consumedAt: null, expiresAt: { $gt: now() } },
      { $set: { consumedAt: now() } }, { returnDocument: "after" }).lean();
      if (!record?.student) invalid();
      const student = await Student.findOne({ _id: record.student, studentIdNumber: id, isArchived: false }).select(FIELDS.join(" ")).lean();
      if (!student) invalid();
      return { identity: Object.fromEntries(FIELDS.map(field => [field, student[field] || ""])) };
    },
  };
}
module.exports = { createIdentityVerification };
