const { test } = require('node:test');
const assert = require('node:assert/strict');
const period = { start: new Date('2026-01-01T00:00:00+08:00'), end: new Date('2026-07-01T00:00:00+08:00') };
const record = (id, opened, extra = {}) => ({ student: { _id: id }, dateOpened: opened, problemAssessment: { mainDomain: 'Academic-Educational' }, ...extra });

test('report periods use inclusive Manila dates and do not overflow across short months', async () => {
  const { getPeriodRange } = await import('../../frontend/src/utils/reportPeriod.js');
  const custom = getPeriodRange('custom', '2026-01-01', '2026-06-30');
  assert.equal(custom.start.toISOString(), '2025-12-31T16:00:00.000Z');
  assert.equal(custom.end.toISOString(), '2026-06-30T16:00:00.000Z');
  const rolling = getPeriodRange('6-months', '', '', new Date('2026-03-31T18:00:00Z'));
  assert.equal(rolling.start.toISOString(), '2025-10-31T16:00:00.000Z');
  assert.equal(rolling.end.toISOString(), '2026-04-01T16:00:00.000Z');
});

test('accomplishments deduplicate students, use completed follow-ups and include earlier cases closed in period', async () => {
  const { buildAccomplishmentReport } = await import('../../frontend/src/utils/accomplishmentReport.js');
  const report = buildAccomplishmentReport([
    record('a', '2026-01-01T00:00:00+08:00', { followUps: [{ status: 'Completed', completedAt: '2026-06-30T23:59:59+08:00' }] }),
    record('a', '2026-02-01', { problemAssessment: { mainDomain: 'Personal-Social' } }),
    record('b', '2026-02-01', { followUps: [{ status: 'Pending', followUpDate: '2026-03-01' }] }),
    record('c', '2026-03-01', { followUps: [{ status: 'Completed', completedAt: '2026-07-01T00:00:00+08:00' }] }),
    record('old', '2025-12-01', { caseStatus: 'Closed', dateClosed: '2026-04-01' }),
    record('future', '2026-07-01T00:00:00+08:00'),
  ], period);
  const intake = report.rows.find(row => row.Indicator === 'Number of student intakes');
  assert.equal(intake['Actual count'], 3);
  const followUp = report.rows.find(row => row.No === 5);
  assert.equal(followUp['Actual count'], 1);
  assert.equal(followUp['Actual percentage'], '33.3%');
  assert.equal(report.rows.find(row => row.No === 6)['Actual count'], 1);
  assert.equal(report.rows.find(row => row.No === 3)['Actual count'], 3);
  assert.equal(report.rows.find(row => row.No === 2)['Actual count'], 1);
});

test('unsupported indicators stay unavailable and referral counts do not invent a denominator', async () => {
  const { buildAccomplishmentReport } = await import('../../frontend/src/utils/accomplishmentReport.js');
  const report = buildAccomplishmentReport([
    record('a', '2026-02-01', { clientEntryType: 'Referred', referralInformation: { referralSource: 'Faculty-Referred' } }),
    record('a', '2026-03-01', { clientEntryType: 'Referred', referralInformation: { referralSource: 'Staff-Referred' } }),
    record('b', '2026-03-01', { caseStatus: 'Terminated', terminationReason: 'Graduation', terminatedAt: '2026-04-01' }),
  ], period);
  assert.equal(report.rows.find(row => row.No === 19)['Actual count'], 1);
  assert.equal(report.rows.find(row => row.No === 19)['Actual percentage'], 'Not tracked');
  assert.equal(report.rows.find(row => row.No === 8)['Actual count'], 'Not tracked');
  assert.equal(report.rows.find(row => row.No === 40)['Actual percentage'], 'Not tracked');
  assert.ok(report.rows.every(row => row.No !== 41));
  const empty = buildAccomplishmentReport([], period);
  assert.equal(empty.rows.find(row => row.No === 5)['Actual percentage'], 'N/A');
  assert.equal(empty.summary[0].value, 0);
});

test('missing student identity and completion dates are not treated as confirmed accomplishments', async () => {
  const { buildAccomplishmentReport } = await import('../../frontend/src/utils/accomplishmentReport.js');
  const report = buildAccomplishmentReport([
    record('', '2026-02-01'),
    record('a', '2026-02-01', { followUps: [{ status: 'Completed' }] }),
  ], period);
  assert.equal(report.summary[0].value, 1);
  assert.equal(report.rows.find(row => row.No === 5)['Actual count'], 0);
  assert.ok(report.notes.some(note => note.includes('1 intake case(s) lack')));
});

test('Excel export round-trips numeric counts and percentages, preserves missing values and excludes identities', async () => {
  const { buildAccomplishmentReport } = await import('../../frontend/src/utils/accomplishmentReport.js');
  const { createAccomplishmentWorkbook } = await import('../../frontend/src/utils/accomplishmentWorkbook.js');
  const report = buildAccomplishmentReport([record('SECRET-ID', '2026-02-01', {
    student: { _id: 'SECRET-ID', firstName: 'PRIVATE-NAME' },
    followUps: [{ status: 'Completed', completedAt: '2026-04-01' }],
  })], period);
  const workbook = await createAccomplishmentWorkbook({ report, period: 'January–June 2026', coverage: 'Assigned cases', filters: 'All domains', generatedBy: 'Counselor', generatedAt: '2026-10-19' });
  const buffer = await workbook.xlsx.writeBuffer();
  const restored = new workbook.constructor();
  await restored.xlsx.load(buffer);
  const sheet = restored.getWorksheet('OPCR Accomplishment');
  let followUp, unsupported;
  sheet.eachRow(row => {
    if (row.getCell(2).value === 'Intake students followed up') followUp = row;
    if (row.getCell(2).value === 'Budget utilization') unsupported = row;
  });
  assert.equal(followUp.getCell(4).value, 1);
  assert.equal(followUp.getCell(5).value, 1);
  assert.equal(followUp.getCell(5).numFmt, '0.0%');
  assert.equal(unsupported.getCell(5).value, 'Not tracked');
  assert.equal(sheet.getCell('A1').fill.fgColor.argb, 'FFFFFF00');
  assert.equal(sheet.pageSetup.orientation, 'landscape');
  assert.ok(!JSON.stringify(sheet.model).includes('PRIVATE-NAME'));
  assert.ok(!JSON.stringify(sheet.model).includes('SECRET-ID'));
});
