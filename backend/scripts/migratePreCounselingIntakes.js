// Additive migration: preserve legacy forms and their original answers. Dry-run by default.
require("dotenv").config();
const mongoose = require("mongoose");
const Form = require("../models/preCounselingForm");
const Intake = require("../models/counselingIntake");
const Student = require("../models/student");
async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI);
  try {
    await Intake.init();
    let eligible = 0,
      skipped = 0,
      migrated = 0;
    for await (const form of Form.find({ status: "Submitted", linkedCase: null }).cursor()) {
      if (await Intake.exists({ legacyForm: form._id })) {
        skipped++;
        continue;
      }
      const student = await Student.findById(form.student);
      if (!student || student.isArchived || !student.college) {
        skipped++;
        continue;
      }
      eligible++;
      if (apply) {
        await Intake.updateOne(
          { legacyForm: form._id },
          {
            $setOnInsert: {
              legacyForm: form._id,
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
              status: "Pending Review",
              appointmentStatus: "Unassigned",
              consent: form.consent.toObject(),
              backgroundAndPsychosocialHistory: form.backgroundAndPsychosocialHistory.toObject(),
              submittedAt: form.submittedAt,
              history: [{ action: "Imported legacy submitted form", at: new Date() }],
            },
          },
          { upsert: true, runValidators: true }
        );
        migrated++;
      }
    }
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", eligible, skipped, migrated }));
  } finally {
    await mongoose.disconnect();
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { main };
