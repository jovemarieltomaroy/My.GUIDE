const mongoose = require("mongoose");
const Case = require("../models/case");

// Seed from the largest existing suffix, including archived cases and numbering gaps.
async function nextCaseNumber({ year = new Date().getFullYear(), session } = {}) {
  const records = await Case.find({
    caseNumber: { $regex: `^CASE-${year}-[0-9]+$` },
  }).select("caseNumber").session(session || null).lean();
  const maximum = records.reduce(
    (max, record) => Math.max(max, Number(record.caseNumber.split("-")[2])),
    0
  );
  // One atomic counter is shared by manual creation and intake conversion.
  const counter = await mongoose.connection.collection("caseNumberCounters").findOneAndUpdate(
    { _id: String(year) },
    [{ $set: { sequence: { $add: [{ $max: [{ $ifNull: ["$sequence", 0] }, maximum] }, 1] } } }],
    { upsert: true, returnDocument: "after", ...(session ? { session } : {}) }
  );
  return `CASE-${year}-${String(counter.sequence).padStart(4, "0")}`;
}

module.exports = { nextCaseNumber };
