const { test } = require('node:test');
const assert = require('node:assert/strict');
const cases = [
 { caseStatus: 'Open', dateOpened: '2026-10-01T00:00:00Z', problemAssessment: { mainDomain: 'Academic', primaryProblems: ['Stress'] } },
 { caseStatus: 'Open', dateOpened: '2026-10-10T00:00:00Z', problemAssessment: { mainDomain: 'Academic', primaryProblems: ['Stress'] } },
 { caseStatus: 'Closed', dateOpened: '2026-09-30T18:00:00Z', problemAssessment: { mainDomain: 'Academic', primaryProblems: ['Time management'] } },
];
test('case summary groups category, concern and status without exposing student identities', async () => {
 const { aggregateCaseReport } = await import('../../frontend/src/utils/reportAggregates.js');
 const rows = aggregateCaseReport('case-summary', cases);
 assert.equal(rows.length, 2); assert.equal(rows.reduce((sum,row)=>sum+row.Cases,0), 3);
 assert.equal(rows.find(row=>row.Concern==='Stress').Cases,2);
 assert.deepEqual(Object.keys(rows[0]), ['Category','Concern','Status','Cases']);
});
test('monthly trends use Manila month boundaries and preserve total counts', async () => {
 const { aggregateCaseReport } = await import('../../frontend/src/utils/reportAggregates.js');
 const rows = aggregateCaseReport('case-trends', cases);
 assert.equal(rows.length,1); assert.equal(rows[0].Month,'2026-10'); assert.equal(rows[0].Cases,3);
});
test('case status counts handle empty data and missing statuses', async () => {
 const { aggregateCaseReport } = await import('../../frontend/src/utils/reportAggregates.js');
 assert.deepEqual(aggregateCaseReport('case-status', []), []);
 const rows=aggregateCaseReport('case-status',[...cases,{}]);
 assert.equal(rows.find(row=>row.Status==='Open').Cases,2);
 assert.equal(rows.find(row=>row.Status==='Not recorded').Cases,1);
});

test('combined report preserves case totals across all breakdowns and excludes identities', async () => {
 const { buildCombinedCaseReport } = await import('../../frontend/src/utils/reportAggregates.js');
 const records = [...cases, { student: { firstName: 'Private name' }, caseNumber: 'PRIVATE-CASE' }];
 const sections = buildCombinedCaseReport(records);
 assert.equal(sections.length, 4);
 for (const section of sections) {
  assert.equal(section.rows.reduce((sum, row) => sum + row.Cases, 0), records.length);
 }
 const domains = sections.find(section => section.title === 'Cases by domain').rows;
 assert.equal(domains.find(row => row.Domain === 'Academic').Share, '75.0%');
 assert.equal(domains.find(row => row.Domain === 'Not recorded').Cases, 1);
 const trends = sections.find(section => section.title === 'Monthly case trends').rows;
 assert.equal(trends.find(row => row.Month === '2026-10').Cases, 3);
 assert.equal(trends.find(row => row.Month === 'Not recorded').Cases, 1);
 assert.ok(!JSON.stringify(sections).includes('Private name'));
 assert.ok(!JSON.stringify(sections).includes('PRIVATE-CASE'));
});

test('combined report handles an empty filtered set', async () => {
 const { buildCombinedCaseReport } = await import('../../frontend/src/utils/reportAggregates.js');
 assert.ok(buildCombinedCaseReport([]).every(section => section.rows.length === 0));
});
