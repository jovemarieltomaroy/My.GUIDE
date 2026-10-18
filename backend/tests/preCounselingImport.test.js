const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const mongoose = require('mongoose');
const Form = require('../models/preCounselingForm');
const Case = require('../models/case');
const background = {
 familyContext: 'Fixture family context', familyConstellationComments: 'Fixture family comments',
 academicContext: 'Fixture academic workload', peerSocialContext: 'Fixture social support',
 familyConstellation: [{ name: 'Fixture member', relationship: 'Parent', age: 42 }],
 psychiatricCareHistory: { hasHistory: true, description: 'Fixture psychiatric history' },
 psychologicalTherapyHistory: { hasHistory: true, description: 'Fixture therapy history' },
 previousCounselingHistory: { hasHistory: true, description: 'Fixture counseling history' },
 medicalHistory: { hasHistory: true, description: 'Fixture medical history' },
 familyMentalHealthHistory: { hasHistory: true, description: 'Fixture family history' },
 substanceUseHistory: { hasHistory: false, description: 'Fixture description retained' },
 legalHistory: { hasHistory: true, description: 'Fixture legal history' },
};
const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
test('student submission and counselor retrieval preserve every background/history answer', async () => {
 const form = new Form({ student: new mongoose.Types.ObjectId(), requestedBy: new mongoose.Types.ObjectId(), token: 'hashed-fixture', tokenExpiresAt: new Date(Date.now() + 60000) });
 let saved;
 form.save = async () => { saved = JSON.parse(JSON.stringify(form)); };
 const context = { module: { exports: {} }, require: name => {
  if (name === 'express-async-handler') return fn => fn;
  if (name === '../models/preCounselingForm') return { findOne: () => {
   const chain = { sort() { return this; }, select(fields) { assert.ok(fields.includes('backgroundAndPsychosocialHistory')); return this; }, then(resolve) { return Promise.resolve(form).then(resolve); } };
   return chain;
  } };
  if (name === '../models/student') return { findById: async () => ({ _id: form.student }) };
  if (name === '../config/emailTransporter') return {};
  return require(name);
 } };
 vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/preCounselingController'), 'utf8'), context);
 const res = response();
 await context.module.exports.submitPreCounselingForm({ params: { token: 'fixture' }, body: { consent: { hasConsent: true, confidentialityAgreementAccepted: true, dataPrivacyNoticeAccepted: true }, backgroundAndPsychosocialHistory: background } }, res);
 assert.equal(res.code, 200);
 for (const [key, value] of Object.entries(background)) {
  if (key !== 'familyConstellation') assert.deepEqual(saved.backgroundAndPsychosocialHistory[key], value, key);
 }
 const read = response();
 await context.module.exports.getLatestSubmittedPreCounselingForm({ params: { studentId: String(form.student) } }, read);
 assert.equal(read.code, 200);
 assert.deepEqual(JSON.parse(JSON.stringify(read.body.form)).backgroundAndPsychosocialHistory, saved.backgroundAndPsychosocialHistory);
});
test('New Case imports context, comments and all histories and preserves them through case serialization', async () => {
 const { importPreCounselingInformation } = await import('../../frontend/src/utils/preCounselingImport.js');
 const result = importPreCounselingInformation({ student: 'fixture', consent: {}, backgroundAndPsychosocialHistory: {} }, { backgroundAndPsychosocialHistory: background });
 assert.equal(result.student, 'fixture');
 assert.equal(result.backgroundAndPsychosocialHistory.familyConstellation[0].age, '42');
 const record = new Case({ backgroundAndPsychosocialHistory: result.backgroundAndPsychosocialHistory });
 const saved = JSON.parse(JSON.stringify(record));
 for (const [key, value] of Object.entries(background)) {
  if (key !== 'familyConstellation') assert.deepEqual(saved.backgroundAndPsychosocialHistory[key], value, key);
 }
});
test('partial older intake answers do not erase counselor context or nested history descriptions', async () => {
 const { importPreCounselingInformation } = await import('../../frontend/src/utils/preCounselingImport.js');
 const result = importPreCounselingInformation({ backgroundAndPsychosocialHistory: background }, { backgroundAndPsychosocialHistory: { psychiatricCareHistory: { hasHistory: false } } });
 assert.equal(result.backgroundAndPsychosocialHistory.familyContext, background.familyContext);
 assert.equal(result.backgroundAndPsychosocialHistory.psychiatricCareHistory.description, background.psychiatricCareHistory.description);
 assert.equal(result.backgroundAndPsychosocialHistory.psychiatricCareHistory.hasHistory, false);
});
