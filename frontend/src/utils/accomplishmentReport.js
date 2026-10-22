const NOT_TRACKED = 'Not tracked';
const studentId = record => {
  const student = record.student;
  return typeof student === 'string' ? student : String(student?._id || student?.id || '');
};
const uniqueStudents = records => new Set(records.map(studentId).filter(Boolean)).size;

export function buildAccomplishmentReport(records, { start = null, end = null } = {}) {
  const inPeriod = value => {
    if (!value) return false;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && (!start || date >= start) && (!end || date < end);
  };
  const intakes = records.filter(record => inPeriod(record.dateOpened || record.createdAt));
  const intakeCount = uniqueStudents(intakes);
  const followedUp = uniqueStudents(intakes.filter(record => record.followUps?.some(followUp =>
    followUp.status === 'Completed' && inPeriod(followUp.completedAt))));
  const closed = records.filter(record => record.caseStatus === 'Closed' && inPeriod(record.dateClosed)).length;
  const percentage = intakeCount ? `${(followedUp / intakeCount * 100).toFixed(1)}%` : 'N/A';
  const rows = [];
  const add = (number, group, indicator, target = '—', count = NOT_TRACKED, percent = NOT_TRACKED, remarks = 'Additional structured records are required.') =>
    rows.push({ No: number, Group: group, Indicator: indicator, Target: target, 'Actual count': count, 'Actual percentage': percent, Remarks: remarks });
  const intakeNote = 'Each student is counted once in this domain if a case was opened during the selected period. A student may appear in more than one domain.';
  add(1, 'Research', 'Complete the research project', 'Complete');
  add('', 'Student intake', 'Number of student intakes', '—', intakeCount, 'N/A', 'Each student is counted once if at least one case was opened for them during the selected period.');
  for (const [index, domain] of ['Personal-Social', 'Academic-Educational', 'Career-Vocational'].entries()) {
    add(index + 2, 'Student intake', domain, '—', uniqueStudents(intakes.filter(record => record.problemAssessment?.mainDomain === domain)), 'N/A', intakeNote);
  }
  add(5, 'Follow-up', 'Intake students followed up', 'At least 50%', followedUp, percentage,
    'Of the students with a case opened during the selected period, the percentage who also had a follow-up completed during that period. Pending follow-ups are excluded.');
  add(6, 'Case outcomes', 'Case closure', '—', closed, 'N/A', 'Cases closed during the selected period, including those opened earlier. Cases that are currently reopened are excluded.');
  for (const [index, reason] of ['transfer', 'graduation', 'disciplinary reasons', 'unforeseen circumstances', 'unresponsiveness'].entries()) {
    add(index + 7, 'Case outcomes', `Preterminated due to ${reason}`, '—', NOT_TRACKED, 'N/A', 'Termination reasons are free text; reliable category totals cannot be calculated.');
  }
  for (const [index, destination] of ['Psychologist', 'Psychiatrist', 'Clinic (nurse/doctor)', 'LSO — legal assistance', 'OSDS / OASG — financial assistance', 'OSDS — disciplinary/grievance', 'CLASS/LAV — tutorial'].entries()) {
    add(index + 12, 'Outgoing referrals', `Students referred to ${destination}`, '100%', NOT_TRACKED, NOT_TRACKED, 'Referral destinations and the eligible referral population are not tracked.');
  }
  const facultyIntakes = intakes.filter(record => record.clientEntryType === 'Referred' &&
    ['Faculty-Referred', 'Staff-Referred'].includes(record.referralInformation?.referralSource));
  add(19, 'Incoming referrals', 'Faculty / staff referrals catered', '75%', uniqueStudents(facultyIntakes), NOT_TRACKED,
    'Distinct intake students recorded as faculty/staff referred. All referral requests, including those not catered, are not tracked, so the percentage is unavailable.');
  for (const [index, source] of ['Parents / guardians', 'Peer facilitators', 'General public'].entries()) {
    add(index + 20, 'Incoming referrals', `${source} referrals catered`, '75%', NOT_TRACKED, NOT_TRACKED, 'Existing referral-source categories do not distinguish this group or track all referral requests.');
  }
  const remaining = [
    [23, 'Testing', 'Target population administered tests', '50%'],
    [24, 'Testing', 'Requested test-result interpretations provided', '100%'],
    [25, 'Student inventory', 'First-year inventory completed', '100%'],
    [26, 'Student inventory', 'Updated inventory — shiftees', '100%'],
    [27, 'Student inventory', 'Updated inventory — transferred out', '100%'],
    [28, 'Student inventory', 'Updated inventory — leave of absence', '100%'],
    [29, 'Student inventory', 'First-year students with an initial interview', '75%'],
    [30, 'Training and activities', 'Trainings / symposia conducted', 'At least 2'],
    [31, 'Training and activities', 'Target population attending trainings', 'At least 10%'],
    [32, 'Training and activities', 'Very satisfactory training / symposium ratings', 'At least 80%'],
    [33, 'Training and activities', 'SPF activities conducted', 'At least 5'],
    [34, 'Institutional accomplishments', 'MOAs with educational institutions for interns', '—'],
    [35, 'Institutional accomplishments', 'OGC personnel attending training', 'At least 1 personnel'],
    [36, 'Institutional accomplishments', 'OGC personnel engaged in self-care', 'At least 50%'],
    [37, 'Institutional accomplishments', 'Student-profile / program-effectiveness / counseling-outcomes datasets submitted', 'At least 1'],
    [38, 'Institutional accomplishments', 'Collaborations with other personnel / offices', 'At least 1'],
    [39, 'Institutional accomplishments', 'HEIs / organizations / professionals engaged for resource sharing', '—'],
    [40, 'Institutional accomplishments', 'Budget utilization', 'At least 90%'],
    [42, 'Institutional accomplishments', 'Institutional activities engaged in', '—'],
    [43, 'Institutional accomplishments', 'Committees with OGC personnel membership', '—'],
  ];
  remaining.forEach(args => add(...args));
  const unknownStudents = intakes.filter(record => !studentId(record)).length;
  const otherDomains = uniqueStudents(intakes.filter(record => !['Personal-Social', 'Academic-Educational', 'Career-Vocational'].includes(record.problemAssessment?.mainDomain)));
  return {
    rows,
    summary: [
      { label: 'Student intakes', value: intakeCount, note: 'Distinct students in the period' },
      { label: 'Intakes followed up', value: followedUp, note: `${percentage} of intake students` },
      { label: 'Cases closed', value: closed, note: 'Recorded closure date in period' },
      { label: 'Other / unrecorded domain', value: otherDomains, note: 'Intake students outside the three listed domains' },
    ],
    notes: [
      'Targets are copied from the supplied template; they are not system-calculated accomplishments.',
      'This report includes non-archived cases you are allowed to access. It uses current records, so reopening a case or updating student information may change earlier reports.',
      'Intakes are counted by when a case was opened, follow-ups by when they were completed, and closures by when a case was closed. The selected end date is included, using Philippine time. Incoming referral counts include students with recorded intakes; requests that did not lead to an intake are not included.',
      'Each student is counted once in the intake total. A student with cases in different domains may be counted in each of those domains, so domain counts may add up to more than the intake total.',
      ...(unknownStudents ? [`${unknownStudents} intake case(s) lack a student ID and are excluded from student totals because the student could not be identified reliably.`] : []),
      'Not tracked means the information needed to calculate the result is unavailable. N/A means a percentage does not apply or there were no student intakes to calculate it from. Neither means zero accomplishments.',
      'Indicator 41 was not present in the supplied reference and is omitted.',
    ],
  };
}
