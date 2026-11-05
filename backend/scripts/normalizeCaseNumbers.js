// Preview by default; --apply changes only legacy intake case numbers.
require("dotenv").config({ path: require("path").join(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
const Case = require("../models/case");
const { nextCaseNumber } = require("../services/caseNumbering");

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const records = await Case.find({ caseNumber: /^CASE-INTAKE-[0-9]{4}-/ })
      .sort({ dateOpened: 1, _id: 1 }).select("caseNumber").lean();
    if (!process.argv.includes("--apply")) {
      console.log(JSON.stringify({ mode: "preview", eligible: records.length }));
      return;
    }
    for (const record of records) {
      const year = Number(record.caseNumber.split("-")[2]);
      const caseNumber = await nextCaseNumber({ year });
      const result = await Case.updateOne(
        { _id: record._id, caseNumber: record.caseNumber },
        { $set: { caseNumber } }
      );
      console.log(JSON.stringify({ previous: record.caseNumber, caseNumber, updated: result.modifiedCount }));
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
