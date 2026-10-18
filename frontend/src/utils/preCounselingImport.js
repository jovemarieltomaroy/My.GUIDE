const textFields = ['familyContext', 'familyConstellationComments', 'academicContext', 'peerSocialContext'];
const historyFields = ['psychiatricCareHistory', 'psychologicalTherapyHistory', 'previousCounselingHistory', 'medicalHistory', 'familyMentalHealthHistory', 'substanceUseHistory', 'legalHistory'];

// Import every intake section explicitly; partial/older submissions preserve existing values.
export function importPreCounselingInformation(current, submitted) {
  const previous = current.backgroundAndPsychosocialHistory || {};
  const background = submitted.backgroundAndPsychosocialHistory || {};
  const history = { ...previous };
  for (const field of textFields) {
    if (typeof background[field] === 'string') history[field] = background[field];
  }
  for (const field of historyFields) {
    const answer = background[field];
    history[field] = {
      hasHistory: previous[field]?.hasHistory ?? false,
      description: previous[field]?.description ?? '',
    };
    if (typeof answer?.hasHistory === 'boolean') history[field].hasHistory = answer.hasHistory;
    if (typeof answer?.description === 'string') history[field].description = answer.description;
  }
  if (background.familyConstellation?.length) {
    history.familyConstellation = background.familyConstellation.map(member => ({
      name: member.name || '', age: member.age == null ? '' : String(member.age),
      relationship: member.relationship || '', parentType: member.parentType || 'Not Applicable',
      isSignificantPerson: Boolean(member.isSignificantPerson), remarks: member.remarks || '',
    }));
  }
  return { ...current, consent: { ...current.consent, ...(submitted.consent || {}) }, backgroundAndPsychosocialHistory: history };
}
