export function aggregateCaseReport(type, cases) {
  const groups = new Map();
  for (const record of cases) {
    let dimensions;
    if (type === 'case-summary') dimensions = { Category: record.problemAssessment?.mainDomain || 'Not recorded', Concern: record.problemAssessment?.primaryProblems?.filter(Boolean).join('; ') || 'Not recorded', Status: record.caseStatus || 'Not recorded' };
    else if (type === 'case-status') dimensions = { Status: record.caseStatus || 'Not recorded' };
    else if (type === 'case-trends') {
      const date = new Date(record.dateOpened || record.createdAt);
      const parts = Number.isNaN(date.getTime()) ? [] : new Intl.DateTimeFormat('en', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(date);
      const month = parts.length ? `${parts.find(item => item.type === 'year').value}-${parts.find(item => item.type === 'month').value}` : 'Not recorded';
      dimensions = { Month: month, Concern: record.problemAssessment?.mainDomain || 'Not recorded' };
    } else return null;
    const key = JSON.stringify(dimensions);
    if (!groups.has(key)) groups.set(key, { ...dimensions, Cases: 0 });
    groups.get(key).Cases++;
  }
  return [...groups.values()].sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
