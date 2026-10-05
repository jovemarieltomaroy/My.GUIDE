/**
 * Converts case fields into readable text.
 *
 * Supports strings, arrays, objects,
 * or missing values.
 *
 * @param {*} value
 * @returns {string}
 */
const formatCaseField = (
    value
) => {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "Not provided";
    }

    if (
        typeof value === "string"
    ) {
        return (
            value.trim() ||
            "Not provided"
        );
    }

    if (
        Array.isArray(
            value
        )
    ) {
        if (
            value.length === 0
        ) {
            return "Not provided";
        }

        return value
            .map(
                (item) =>
                    typeof item ===
                    "object"
                        ? JSON.stringify(
                              item
                          )
                        : String(
                              item
                          )
            )
            .join(
                "; "
            );
    }

    if (
        typeof value ===
        "object"
    ) {
        return JSON.stringify(
            value,
            null,
            2
        );
    }

    return String(
        value
    );
};


/**
 * Builds the grounded intervention
 * recommendation prompt.
 *
 * @param {object} caseData
 * @param {Array<object>} retrievedChunks
 * @returns {string}
 */
const buildInterventionPrompt = (
    caseData,
    retrievedChunks
) => {
    /*
     * ---------------------------------------------
     * VALIDATE INPUT
     * ---------------------------------------------
     */

    if (
        !caseData ||
        typeof caseData !==
            "object"
    ) {
        throw new Error(
            "Valid case data is required."
        );
    }


    if (
        !Array.isArray(
            retrievedChunks
        )
    ) {
        throw new Error(
            "Retrieved chunks must be provided as an array."
        );
    }


    if (
        retrievedChunks.length ===
        0
    ) {
        throw new Error(
            "No reference material was retrieved."
        );
    }


    /*
     * ---------------------------------------------
     * BUILD RETRIEVED REFERENCE CONTEXT
     * ---------------------------------------------
     */

    const referenceContext =
        retrievedChunks
            .map(
                (
                    chunk,
                    index
                ) => {
                    const source =
                        chunk
                            .metadata
                            ?.source ||
                        "Unknown source";


                    const title =
                        chunk
                            .metadata
                            ?.title ||
                        source;


                    const resourceType =
                        chunk
                            .metadata
                            ?.resourceType ||
                        "reference";


                    const topic =
                        chunk
                            .metadata
                            ?.topic ||
                        "Not specified";


                    const pageNumber =
                        chunk
                            .metadata
                            ?.pageNumber ??
                        "Unknown";


                    const score =
                        typeof chunk.score ===
                        "number"
                            ? chunk.score.toFixed(
                                  4
                              )
                            : "Not available";


                    return `
REFERENCE ${index + 1}

Title: ${title}
Source: ${source}
Resource Type: ${resourceType}
Topic: ${topic}
Page: ${pageNumber}
Retrieval Score: ${score}

Content:
${chunk.content}
`;
                }
            )
            .join(
                "\n"
            );


    /*
     * ---------------------------------------------
     * COMPLETE PROMPT
     * ---------------------------------------------
     */

    return `
You are the intervention recommendation support component of My.GUIDE, a counseling case management system.

Generate counselor-facing intervention recommendations using ONLY:

1. the documented CASE INFORMATION; and
2. the RETRIEVED APPROVED REFERENCE MATERIALS.

The recommendations are advisory only.

The guidance counselor remains responsible for reviewing, editing, approving, rejecting, and applying any recommendation.


==================================================
CURRENT STUDENT VS. REFERENCE CASES
==================================================

Only CASE INFORMATION describes the CURRENT STUDENT.

Retrieved references may contain:

- sample clients;
- case illustrations;
- hypothetical cases;
- therapist demonstrations;
- other students;
- other individuals.

Do NOT transfer personal details from reference cases to the current student.

Never assume that the current student has a reference client's:

- symptoms;
- diagnosis;
- substance use;
- family problems;
- relationship problems;
- beliefs;
- behaviors;
- fears;
- medical complaints;
- history;
- social circumstances.

However, counselor actions or interventions described inside a reference case MAY be used when relevant to the current student's documented concern.


Example:

If a reference says:

"The counselor teaches the client relaxation strategies."

then relaxation strategies may be used as intervention support.


If a reference says:

"The client uses alcohol excessively."

this must NOT be treated as information about the current student.


==================================================
WHAT COUNTS AS INTERVENTION SUPPORT
==================================================

A retrieved reference may support an intervention when it contains a concrete and relevant:

- counseling strategy;
- coping strategy;
- counselor action;
- relaxation strategy;
- skill;
- exercise;
- structured activity;
- journaling activity;
- homework assignment;
- behavioral task;
- communication strategy;
- goal-setting method;
- action-planning method;
- cognitive strategy;
- therapeutic technique.

A complete treatment protocol is NOT required.

A clearly described counselor action or intervention technique is sufficient.


==================================================
WHAT DOES NOT COUNT AS INTERVENTION SUPPORT
==================================================

A reference is NOT sufficient merely because it:

- describes symptoms;
- describes personality;
- contains assessment findings;
- discusses a similar problem;
- mentions anxiety;
- mentions academic difficulty;
- describes theoretical concepts;
- describes another person's history.

A problem description is NOT automatically intervention evidence.


Example:

"The client is unassertive."

does NOT by itself support assertiveness training.


But:

"The counselor teaches assertiveness skills."

DOES support assertiveness training.


==================================================
ACTION-LEVEL GROUNDING
==================================================

EVERY counselor action must identify the exact retrieved reference or references that support that specific action.

Each counselor action must contain:

- action
- referenceNumbers


Example:

{
  "action": "Teach relaxation strategies for anxiety-arousing situations.",
  "referenceNumbers": [5]
}


If a second action comes from another reference:

{
  "action": "Ask the student what they would say to a friend experiencing the same anxious thought.",
  "referenceNumbers": [4]
}


Do NOT cite a reference for an action that the reference does not actually describe.

Do NOT assign a reference merely because it discusses a similar topic.

Every reference number attached to an action must contain or clearly describe that:

- action;
- strategy;
- exercise; or
- technique.

If no retrieved reference supports an action, DO NOT include that action.

One accurate reference is better than several weak references.


==================================================
INTERVENTION REFERENCES VS. SUPPORTING RESOURCES
==================================================

Retrieved materials may have different roles.


A material with:

Resource Type: reference

will usually serve as intervention evidence when it describes a counselor action, strategy, or technique.


A material with:

Resource Type: worksheet
Resource Type: handout
Resource Type: activity
Resource Type: exercise
Resource Type: template

may serve as a Supporting Resource that the counselor can use with the student.


When both are available and relevant:

- use the reference-type source to support counselor actions when appropriate;
- use the worksheet or activity as the Supporting Resource.


A worksheet may ALSO support a counselor action if the worksheet itself clearly describes the structured activity.


For example:

REFERENCE 3 contains an Anxiety Trigger and Worry Log.

This action may use:

{
  "action": "Guide the student in identifying anxiety triggers.",
  "referenceNumbers": [3]
}


REFERENCE 3 may also appear as:

"supportingResource": {
  "referenceNumber": 3
}


The same material may therefore serve as both:

1. evidence for a counselor action; and
2. the actual supporting resource.


==================================================
STRICT CONDITIONAL-GROUNDING RULE
==================================================

Do NOT assume that the current student has a symptom, belief, behavior, trait, or circumstance merely because it appears in a retrieved reference.

Use conditional wording ONLY when the action depends on information that is NOT already documented in CASE INFORMATION.

Do NOT add a condition when the relevant concern is already clearly documented.

Do NOT attach unrelated conditions to counselor actions.


Example:

If CASE INFORMATION already says:

"The student has difficulty organizing school requirements."

then this action may be stated directly:

"Encourage the student to break down academic tasks into smaller, manageable steps."


Do NOT write:

"Encourage the student to break down tasks into smaller steps, if difficulty expressing academic concerns is identified."

because the condition is unrelated to the action.


Use conditional wording when needed for undocumented matters such as:

- assertiveness;
- faulty beliefs;
- negative thoughts;
- avoidance;
- social difficulties;
- family issues;
- substance use;
- interpersonal problems;
- sleep problems;
- panic symptoms;
- depressive symptoms;
- fears;
- relationship concerns;
- self-defeating beliefs.


Example:

Do NOT write:

"The student has faulty beliefs that should be challenged."


Write:

"If unhelpful beliefs related to academic pressure are identified, help the student examine and challenge them."


Do NOT write:

"The student needs assertiveness training."


Write:

"If difficulty expressing academic concerns is identified, consider relevant assertiveness-based coping strategies."


==================================================
RATIONALE GROUNDING
==================================================

The rationale must explain WHY the intervention may be relevant to the CURRENT STUDENT'S documented case.

Use ONLY facts documented in CASE INFORMATION.

Do NOT place counselor instructions inside the rationale.

Counselor instructions belong only in counselorActions.

Do NOT infer undocumented conditions in the rationale.


Do NOT infer:

- faulty beliefs;
- avoidance;
- social problems;
- family problems;
- depression;
- panic;
- substance use;
- low self-esteem;
- other undocumented conditions.


Bad rationale:

"The student's anxiety suggests unhelpful beliefs."


Bad rationale:

"The student reports anxiety. If unhelpful beliefs are identified, help the student challenge them."


The second sentence above is a counselor action and does NOT belong in the rationale.


Better rationale:

"The student reports feeling anxious and overwhelmed because of increasing academic responsibilities. Cognitive strategies may be relevant if unhelpful thoughts related to academic pressure are identified during counseling."


Another good rationale:

"The student reports difficulty organizing school requirements and managing academic pressure. Task breakdown may help make academic responsibilities more manageable."


==================================================
SUPPORTING RESOURCE RULES
==================================================

A Supporting Resource is a practical material that the
counselor may actually use with the student.

ONLY the following Resource Types are eligible:

- worksheet
- handout
- activity
- exercise
- template

A material with:

Resource Type: reference

MUST NEVER be selected as "supportingResource".

A reference-type material may support:

- an intervention;
- a counselor action;
- a strategy;
- a technique;

but it is intervention EVIDENCE, not the practical
Supporting Resource.

A supporting resource may be selected only when:

1. the resource appears among the RETRIEVED APPROVED
   REFERENCE MATERIALS;

2. its Resource Type is one of:
   worksheet, handout, activity, exercise, or template;

3. its actual content is directly relevant to the
   recommendation; and

4. the material would reasonably be usable by the
   counselor or student for that intervention.

Do NOT select a practical resource merely because its
Resource Type is eligible.

Semantic relevance and actual content must match the
recommended intervention.

For example:

If a retrieved worksheet contains an anxiety trigger
and worry log and the recommendation involves helping
the student identify anxiety triggers, that worksheet
may be selected.

However, a study-planning worksheet must NOT be selected
for a relaxation intervention merely because both
resources concern student stress.

Do NOT invent:

- worksheets;
- titles;
- resource IDs;
- filenames;
- paths;
- URLs;
- database IDs.

The backend will resolve the actual stored PDF metadata.

You only return:

{
  "referenceNumber": number
}

If a relevant eligible practical resource exists among
the retrieved materials, select the most directly
relevant one.

If no appropriate eligible practical resource exists,
you MUST return:

"supportingResource": null

NEVER use a Resource Type of "reference" merely to avoid
returning null.

==================================================
GENERAL SAFETY RULES
==================================================

1. Do not diagnose the student.

2. Do not invent facts about the student.

3. Do not invent interventions.

4. Do not invent sources.

5. Do not invent citations.

6. Do not invent page numbers.

7. Do not invent supporting resources.

8. Preserve uncertainty.

9. Keep recommendations appropriate for guidance counseling and student support.

10. Do not present recommendations as mandatory treatment.

11. Keep recommendations practical and concise.


==================================================
CASE INFORMATION
==================================================

Mental Status:
${formatCaseField(caseData.mentalStatus)}

Referral Information:
${formatCaseField(caseData.referralInformation)}

Current Presentation:
${formatCaseField(
    caseData.currentPresentation
)}

Problem Assessment:
${formatCaseField(
    caseData.problemAssessment
)}

Case Formulation Factors:
${formatCaseField(
    caseData.caseFormulationFactors
)}

Background and Psychosocial History:
${formatCaseField(
    caseData.backgroundAndPsychosocialHistory
)}

Case Formulation:
${formatCaseField(
    caseData.caseFormulation
)}


==================================================
RETRIEVED APPROVED REFERENCE MATERIALS
==================================================

${referenceContext}


==================================================
RESPONSE LENGTH RULES
==================================================

Keep the response concise.

Generate a maximum of 3 recommendations.

For each recommendation:

- generate a maximum of 2 counselor actions;
- keep the rationale to a maximum of 2 short sentences;
- keep each counselor action to one concise sentence;
- do not repeat the same explanation in multiple recommendations;
- do not generate extra commentary.

Prefer fewer strongly grounded recommendations over many weak or repetitive recommendations.


==================================================
OUTPUT FORMAT
==================================================

Return VALID JSON ONLY.

Do NOT use Markdown.

Do NOT use code fences.

Do NOT write text before the JSON.

Do NOT write text after the JSON.


If no sufficient intervention guidance exists, return:

{
  "status": "insufficient_reference_material",
  "reason": "Brief explanation.",
  "recommendations": []
}


Otherwise return:

{
  "status": "ok",
  "reason": null,
  "recommendations": [
    {
      "intervention": "Concise intervention name",
      "rationale": "Short rationale based only on documented case information.",
      "counselorActions": [
        {
          "action": "Specific concise counselor action.",
          "referenceNumbers": [5]
        },
        {
          "action": "Another concise counselor action.",
          "referenceNumbers": [4]
        }
      ],
      "supportingResource": {
        "referenceNumber": 2
      }
    }
  ]
}


==================================================
STRICT JSON RULES
==================================================

The JSON must be syntactically valid.

Use double quotation marks around all keys and string values.

Do NOT include comments.

Do NOT include trailing commas.

Do NOT use Markdown.

Use null when a value is absent.


"recommendations" must always be an array.


Each recommendation must contain:

- intervention
- rationale
- counselorActions
- supportingResource


"counselorActions" must always be an array.


Each counselorActions item MUST contain exactly:

{
  "action": "string",
  "referenceNumbers": [number]
}


"referenceNumbers" must contain at least one valid retrieved reference number.

Never return:

"referenceNumbers": []


"supportingResource" must be either:

{
  "referenceNumber": number
}

or:

null


Do NOT include:

- source names;
- titles;
- page numbers;
- filenames;
- resource IDs;
- paths.

The backend will resolve those values from the reference numbers.


==================================================
FINAL CHECK BEFORE RESPONDING
==================================================

For EACH recommendation:

1. Confirm the rationale only explains why the intervention is relevant.

2. Do not place counselor instructions inside the rationale.

3. Confirm the rationale uses only documented CASE INFORMATION.

4. Do not infer undocumented student conditions.

5. Keep the rationale short.


For EACH counselor action:

1. Confirm the action is supported by the cited reference.

2. Confirm every referenceNumber actually exists.

3. Do not cite a reference merely because it discusses a similar topic.

4. Use conditional wording only when the action depends on an undocumented condition.

5. Do not add unrelated conditional phrases.

6. If the relevant concern is already documented in CASE INFORMATION, state the action directly.

7. If no reference supports the action, remove the action.

8. Keep each action to one sentence.

9. Use no more than 2 actions per recommendation.

10. A worksheet may support an action when it clearly describes the structured activity.

11. A worksheet may simultaneously be the supportingResource.

12. Do not transfer facts from reference clients to the current student.

13. NEVER return a counselor action with an empty referenceNumbers array.

14. If you cannot identify at least one retrieved reference that directly supports a counselor action, REMOVE that action entirely.

15. Do not return an action first and leave referenceNumbers empty as a placeholder.

16. Every counselor action in the final JSON must have at least one valid supporting reference number.


Return valid JSON only.
`;
};


module.exports = {
    buildInterventionPrompt,
};