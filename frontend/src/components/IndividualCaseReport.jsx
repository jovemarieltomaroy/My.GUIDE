const name = person => [person?.firstName, person?.middleName, person?.lastName].filter(Boolean).join(' ') || 'Not recorded';
const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' }).format(new Date(value)) : 'Not recorded';
const combine = values => values.filter(value => typeof value === 'string' && value.trim()).join('\n\n') || 'Not recorded.';
export default function IndividualCaseReport({ record, generatedAt }) {
  const plans = record.interventionPlans || [];
  const notes = record.progressNotes || [];
  const formulation = record.caseFormulation || {};
  const sections = [
    ['I. Presenting Concern', record.currentPresentation?.narrativeDescription || formulation.presentingProblem || 'Not recorded.'],
    ['II. Assessment and Case Formulation', combine([formulation.presentingProblem, formulation.formulationNarrative, formulation.counselorAssessment])],
    ['III. Intervention Plan', combine(plans.map(plan => combine([plan.problem, plan.goal, plan.planOfAction, plan.timeSpan])))],
    ['IV. Counseling Progress', combine(notes.map(note => `${date(note.noteDate || note.createdAt)}\n${combine([note.progressSummary, note.actionTaken, note.remarks])}`))],
    ['V. Follow-up and Recommendations', combine([...plans.map(plan => plan.followUpPlan), ...(record.followUps || []).map(item => `${date(item.followUpDate)} · ${item.followUpType || 'Follow-up'}${item.purpose ? `: ${item.purpose}` : ''}`)])],
  ];
  return <article className="individual-case-report">
    <header className="case-report-letterhead"><p>MINDANAO STATE UNIVERSITY – ILIGAN INSTITUTE OF TECHNOLOGY</p><p>Office of Guidance and Counseling</p><h2>INDIVIDUAL COUNSELING CASE REPORT</h2><span>CONFIDENTIAL</span></header>
    <dl className="case-report-metadata">{[
      ['Case Number', record.caseNumber], ['Date Generated', date(generatedAt)],
      ['Student Name', name(record.student)], ['Student ID', record.student?.studentIdNumber],
      ['College / Program', [record.student?.college, record.student?.program].filter(Boolean).join(' / ')], ['Case Status', record.caseStatus],
    ].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>
    <div>{sections.map(([title,body]) => <section className="case-report-section" key={title}><h3>{title}</h3><p>{body}</p></section>)}</div>
    <footer className="case-report-signature"><p>Prepared by</p><strong>{name(record.assignedCounselor)}</strong><p>Assigned Guidance Counselor</p><p>Office of Guidance and Counseling</p></footer>
  </article>;
}
