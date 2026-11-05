const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Case = require("../models/case");
const { nextCaseNumber } = require("../services/caseNumbering");

test("case numbering seeds from the highest suffix and shares the transaction", async (t) => {
  const session = {};
  t.mock.method(Case, "find", (filter) => {
    assert.equal(filter.caseNumber.$regex, "^CASE-2026-[0-9]+$");
    return { select: () => ({ session: (value) => {
      assert.equal(value, session);
      return { lean: async () => [
        { caseNumber: "CASE-2026-0006" },
        { caseNumber: "CASE-2026-0002" },
      ] };
    } }) };
  });
  t.mock.method(mongoose.connection, "collection", (name) => {
    assert.equal(name, "caseNumberCounters");
    return { findOneAndUpdate: async (filter, pipeline, options) => {
      assert.equal(filter._id, "2026");
      assert.equal(pipeline[0].$set.sequence.$add[0].$max[1], 6);
      assert.equal(options.session, session);
      assert.equal(options.upsert, true);
      return { sequence: 7 };
    } };
  });
  assert.equal(await nextCaseNumber({ year: 2026, session }), "CASE-2026-0007");
});
