// Shared by model parsing and the save boundary. No historical-record migration.
const RECOMMENDATION_OUTPUT_VERSION = "goal-followup-v3";
const normalize = (value) => value.toLowerCase().replace(/\s+/g, " ").trim();
function validateRecommendationOutput(response, caseData = {}) {
  const goal = typeof response?.goal === "string" ? response.goal.trim() : "";
  if (goal.length < 15 || goal.length > 600 ||
      /support\s+(?:the\s+)?student\s+through\s+appropriate\s+interventions|guarantee|definitely will|will definitely/i.test(goal))
    throw new Error("The model must provide a specific, outcome-focused goal. No recommendation was saved.");
  const goalWords = goal.toLowerCase().match(/[a-z0-9]+/g) || [];
  const titleWords = new Set((Array.isArray(response.recommendations) ? response.recommendations : []).flatMap((item) =>
    typeof item.intervention === "string" ? item.intervention.toLowerCase().match(/[a-z0-9]+/g) || [] : []));
  if (goalWords.every((word) => titleWords.has(word) || ["and", "including", "with", "through"].includes(word)))
    throw new Error("The intervention goal lists techniques instead of describing an intended outcome. No recommendation was saved.");
  const followUpPlan = typeof response?.followUpPlan === "string" ? response.followUpPlan.trim() : "";
  if (followUpPlan.length < 20 || followUpPlan.length > 2000 ||
      !/\b(?:review|evaluate|assess|monitor|check|discuss|explore|observe|consider|determine)(?:s|ing)?\b/i.test(followUpPlan) ||
      /\b(?:in|after|within|every)\s+(?:\d+|one|two|three|four|a)\s+(?:days?|weeks?|months?|years?)\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\bnext\s+(?:week|month|year)\b|\b(?:tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(followUpPlan))
    throw new Error("The model must provide follow-up evaluation activities without dates or timelines. No recommendation was saved.");
  const schedule = caseData.progressContext?.latestProgress?.timeSpan?.trim();
  if (schedule && normalize(followUpPlan).includes(normalize(schedule)))
    throw new Error("The follow-up plan must describe evaluation activities, not repeat the documented schedule. No recommendation was saved.");
  return { goal, followUpPlan };
}
module.exports = { validateRecommendationOutput, RECOMMENDATION_OUTPUT_VERSION };
