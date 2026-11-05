const { validateRecommendationOutput } = require("./recommendationOutputValidation");
const { reviewInterventionActions } = require("./evidenceReviewService");
const { retrieveInterventionMaterials, filterEligibleChunks } = require("./retrievalService");

const { buildInterventionPrompt } = require("./promptBuilderService");

const { generateResponse } = require("../llm/ollamaService");

// Constrain decoding as well as describing the format in the prompt. Plain
// JSON mode guarantees syntax only, not required fields or citation ranges.
const buildOutputSchema = (referenceCount, updated) => {
  const text = { type: "string", minLength: 1 };
  const referenceNumber = { type: "integer", minimum: 1, maximum: referenceCount };
  const action = { type: "object", required: ["action", "referenceNumbers", ...(updated ? ["changeType", "changeReason"] : [])],
    properties: { action: text, referenceNumbers: { type: "array", minItems: 1, items: referenceNumber },
      changeType: { enum: ["new", "adjusted", "continued"] }, changeReason: text } };
  return { anyOf: [
    { type: "object", required: ["status", "reason", "recommendations"], properties: {
      status: { const: "insufficient_reference_material" }, reason: text,
      recommendations: { type: "array", maxItems: 0, items: { type: "object" } },
    } },
    { type: "object", required: ["status", "goal", "followUpPlan", "recommendations", ...(updated ? ["updateAssessment"] : [])], properties: {
      status: { const: "ok" }, goal: { type: "string", minLength: 15, maxLength: 600 },
      followUpPlan: { type: "string", minLength: 20, maxLength: 2000 },
      updateAssessment: { type: "object", required: ["decision", "outcomeConsidered", "proposedNextStepsConsidered", "justification"], properties: {
        decision: { enum: ["revise", "continue", "mixed"] }, outcomeConsidered: { const: true },
        proposedNextStepsConsidered: { const: true }, justification: text,
      } },
      recommendations: { type: "array", minItems: 1, maxItems: 3, items: { type: "object",
        required: ["intervention", "rationale", "counselorActions", "supportingResource"], properties: {
          intervention: text, rationale: text,
          counselorActions: { type: "array", minItems: 1, maxItems: 2, items: action },
          supportingResource: { anyOf: [{ type: "null" }, { type: "object", required: ["referenceNumber"], properties: { referenceNumber } }] },
        } } },
    } },
  ] };
};

/**
 * Removes optional Markdown fences.
 *
 * @param {string} text
 * @returns {string}
 */
const cleanJsonResponse = (text) => {
  if (typeof text !== "string") {
    throw new Error("Gemma response must be a string.");
  }

  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
};

/**
 * Resolves a reference number against
 * the actual retrieved chunk.
 *
 * @param {number} referenceNumber
 * @param {Array<object>} retrievedChunks
 *
 * @returns {object}
 */
const resolveReference = (referenceNumber, retrievedChunks) => {
  if (!Number.isInteger(referenceNumber)) {
    throw new Error(`Invalid reference number: ${referenceNumber}`);
  }

  if (referenceNumber < 1 || referenceNumber > retrievedChunks.length) {
    throw new Error(`Reference ${referenceNumber} does not exist among the retrieved references.`);
  }

  const chunk = retrievedChunks[referenceNumber - 1];

  return {
    referenceNumber,

    source: chunk.metadata?.source || "Unknown",

    title: chunk.metadata?.title || chunk.metadata?.source || "Unknown",

    resourceType: chunk.metadata?.resourceType || "reference",

    topic: chunk.metadata?.topic || "Not specified",

    pageNumber: chunk.metadata?.pageNumber ?? null,

    score: typeof chunk.score === "number" ? chunk.score : null,
  };
};

/**
 * Resolves a selected supporting PDF/resource.
 *
 * @param {object|null} supportingResource
 * @param {Array<object>} retrievedChunks
 *
 * @returns {object|null}
 */
const resolveSupportingResource = (supportingResource, retrievedChunks) => {
  if (supportingResource === null) {
    return null;
  }

  if (!supportingResource || !Number.isInteger(supportingResource.referenceNumber)) {
    throw new Error("Invalid supporting resource returned by Gemma.");
  }

  const referenceNumber = supportingResource.referenceNumber;

  if (referenceNumber < 1 || referenceNumber > retrievedChunks.length) {
    throw new Error(`Supporting resource reference ${referenceNumber} does not exist.`);
  }

  const chunk = retrievedChunks[referenceNumber - 1];

  const resourceType = chunk.metadata?.resourceType || "reference";

  const allowedResourceTypes = ["worksheet", "handout"];

  if (!allowedResourceTypes.includes(resourceType)) {
    console.warn(
      `Ignoring invalid supporting resource selection: Reference ${referenceNumber} has resource type "${resourceType}".`
    );

    return null;
  }

  return {
    referenceNumber,

    resourceId: chunk.metadata?.resourceId || null,

    title: chunk.metadata?.title || chunk.metadata?.source || "Unknown",

    source: chunk.metadata?.source || "Unknown",

    resourceType,

    topic: chunk.metadata?.topic || "Not specified",

    approvalStatus: chunk.metadata?.approvalStatus || "unspecified",

    originalFilename: chunk.metadata?.originalFilename || null,

    relativeFilePath: chunk.metadata?.relativeFilePath || null,

    pageNumber: chunk.metadata?.pageNumber ?? null,
  };
};
/**
 * Finds a practical supporting resource from the
 * references already selected for counselor actions.
 *
 * This is used only as a safe fallback when Gemma
 * does not explicitly select a supporting resource
 * or selects an invalid resource type.
 *
 * A resource is never chosen merely because it is
 * a worksheet. It must already support one of the
 * recommendation's counselor actions.
 */
const findSupportingResourceFromActions = (recommendation, retrievedChunks) => {
  const allowedResourceTypes = ["worksheet", "handout"];

  if (!recommendation || !Array.isArray(recommendation.counselorActions)) {
    return null;
  }

  const referencedNumbers = [
    ...new Set(
      recommendation.counselorActions
        .flatMap((action) =>
          Array.isArray(action.referenceNumbers) ? action.referenceNumbers : []
        )
        .filter((referenceNumber) => Number.isInteger(referenceNumber))
    ),
  ];

  for (const referenceNumber of referencedNumbers) {
    if (referenceNumber < 1 || referenceNumber > retrievedChunks.length) {
      continue;
    }

    const chunk = retrievedChunks[referenceNumber - 1];

    const resourceType = chunk.metadata?.resourceType || "reference";

    if (!allowedResourceTypes.includes(resourceType)) {
      continue;
    }

    /*
     * Do not construct the resource manually.
     * Let the existing resolver return the real
     * resource ID, filename, path, title, etc.
     */
    return resolveSupportingResource(
      {
        referenceNumber,
      },
      retrievedChunks
    );
  }

  return null;
};

/**
 * Resolves one counselor action and
 * its individual supporting references.
 *
 * @param {object} action
 * @param {Array<object>} retrievedChunks
 * @param {number} recommendationIndex
 * @param {number} actionIndex
 *
 * @returns {object}
 */
const resolveCounselorAction = (action, retrievedChunks, recommendationIndex, actionIndex) => {
  if (!action || typeof action !== "object") {
    throw new Error(
      `Recommendation ${recommendationIndex + 1}, action ${actionIndex + 1} is invalid.`
    );
  }

  if (typeof action.action !== "string" || !action.action.trim()) {
    throw new Error(
      `Recommendation ${recommendationIndex + 1}, action ${actionIndex + 1} is missing action text.`
    );
  }

  if (!Array.isArray(action.referenceNumbers)) {
    throw new Error(
      `Recommendation ${recommendationIndex + 1}, action ${actionIndex + 1} is missing referenceNumbers.`
    );
  }

  if (action.referenceNumbers.length === 0) {
    console.warn(
      `Skipping Recommendation ${recommendationIndex + 1}, action ${actionIndex + 1}: no supporting references were provided.`
    );

    return null;
  }

  const references = action.referenceNumbers.map((referenceNumber) =>
    resolveReference(referenceNumber, retrievedChunks)
  );

  return {
    action: action.action,
    changeType: ["continued", "adjusted", "new"].includes(action.changeType) ? action.changeType : undefined,
    changeReason: typeof action.changeReason === "string" ? action.changeReason.trim() : "",
    references,
    evidenceStatus: action.evidenceStatus,
    evidenceNeedsReview: action.evidenceChecks?.some((check) => check.support !== "direct") || false,
    classificationNeedsReview: action.classificationNeedsReview || action.classificationCorrected || false,
  };
};

/**
 * Validates and enriches Gemma's
 * structured recommendation response.
 *
 * @param {object} parsedResponse
 * @param {Array<object>} retrievedChunks
 *
 * @returns {object}
 */
const resolveRecommendationResponse = (parsedResponse, retrievedChunks) => {
  if (!parsedResponse || typeof parsedResponse !== "object") {
    throw new Error("Gemma returned an invalid recommendation object.");
  }

  if (!Array.isArray(parsedResponse.recommendations)) {
    throw new Error('Gemma response is missing the "recommendations" array.');
  }

  /*
   * ---------------------------------------------
   * INSUFFICIENT REFERENCES
   * ---------------------------------------------
   */

  if (parsedResponse.status === "insufficient_reference_material") {
    return {
      status: "insufficient_reference_material",

      reason:
        parsedResponse.reason || "No sufficient intervention reference material was identified.",

      recommendations: [],
    };
  }

  /*
   * ---------------------------------------------
   * NORMAL RESPONSE
   * ---------------------------------------------
   */

  if (parsedResponse.status !== "ok") {
    throw new Error(`Unexpected Gemma response status: ${parsedResponse.status}`);
  }

  const resolvedRecommendations = parsedResponse.recommendations
    .map((recommendation, recommendationIndex) => {
      /*
       * -------------------------------
       * BASIC VALIDATION
       * -------------------------------
       */

      if (typeof recommendation.intervention !== "string" || !recommendation.intervention.trim()) {
        throw new Error(
          `Recommendation ${recommendationIndex + 1} is missing a valid intervention name.`
        );
      }

      if (typeof recommendation.rationale !== "string" || !recommendation.rationale.trim()) {
        throw new Error(`Recommendation ${recommendationIndex + 1} is missing a valid rationale.`);
      }

      if (!Array.isArray(recommendation.counselorActions)) {
        throw new Error(`Recommendation ${recommendationIndex + 1} is missing counselorActions.`);
      }

      if (recommendation.counselorActions.length === 0) {
        throw new Error(`Recommendation ${recommendationIndex + 1} has no counselor actions.`);
      }

      /*
       * -------------------------------
       * RESOLVE EACH ACTION
       * -------------------------------
       */

      const counselorActions = recommendation.counselorActions
        .map((action, actionIndex) =>
          resolveCounselorAction(action, retrievedChunks, recommendationIndex, actionIndex)
        )
        .filter(Boolean);

      if (counselorActions.length === 0) {
        console.warn(
          `Skipping Recommendation ${recommendationIndex + 1}: no grounded counselor actions remained after validation.`
        );

        return null;
      }

      /*
       * -------------------------------
       * RESOLVE OPTIONAL RESOURCE
       * -------------------------------
       */

      let supportingResource = null;

      /*
       * First respect Gemma's explicit selection.
       */
      if (recommendation.supportingResource && counselorActions.some((action) =>
        action.references.some((reference) => reference.referenceNumber === recommendation.supportingResource.referenceNumber))) {
        supportingResource = resolveSupportingResource(
          recommendation.supportingResource,
          retrievedChunks
        );
      }

      /*
       * If Gemma did not select a valid practical
       * resource, check the resources that already
       * support its counselor actions.
       *
       * This does NOT choose an unrelated worksheet.
       */
      if (!supportingResource) {
        supportingResource = findSupportingResourceFromActions(recommendation, retrievedChunks);
      }

      /*
       * -------------------------------
       * FINAL RECOMMENDATION
       * -------------------------------
       */

      return {
        intervention: recommendation.intervention,

        rationale: recommendation.rationale,

        counselorActions,

        supportingResource,
        // Include eligible materials actually cited by surviving actions. Retrieval
        // alone never makes a PDF a suggestion; reference-type evidence stays evidence.
        supportingResources: [...new Map([
          ...(supportingResource ? [supportingResource] : []),
          ...counselorActions.flatMap((action) => action.references)
            .filter((reference) => ["worksheet", "handout"].includes(reference.resourceType))
            .map((reference) => resolveSupportingResource({ referenceNumber: reference.referenceNumber }, retrievedChunks)),
        ].map((resource) => [resource.resourceId || resource.referenceNumber, resource])).values()],
      };
    })
    .filter(Boolean);

  if (resolvedRecommendations.length === 0) {
    return {
      status: "insufficient_reference_material",

      reason:
        "No sufficiently grounded intervention recommendations remained after reference validation.",

      recommendations: [],
    };
  }

  return {
    status: "ok",

    reason: null,

    recommendations: resolvedRecommendations,
  };
};

/**
 * Main reusable recommendation service.
 *
 * @param {object} caseData
 * @param {object} options
 *
 * @returns {Promise<object>}
 */
const generateInterventionRecommendations = async (caseData, options = {}) => {
  if (!caseData || typeof caseData !== "object") {
    throw new Error("Valid case data is required.");
  }

  const {
    retrievalQuery,
    limit = 5,
    numCandidates = 50,
    temperature = 0.2,
    numPredict = 2000,
  } = options;

  /*
   * ---------------------------------------------
   * BUILD RETRIEVAL QUERY
   * ---------------------------------------------
   */

  const finalRetrievalQuery =
    retrievalQuery ||
    [
      caseData.recommendationType === "updated" && caseData.progressContext
        ? JSON.stringify(caseData.progressContext.latestProgress || {}) : "",
      caseData.counselorNotes,
      caseData.currentPresentation,

      caseData.problemAssessment,

      caseData.caseFormulationFactors,

      caseData.caseFormulation,
    ]
      .filter((value) => typeof value === "string" && value.trim())
      .join("\n");

  // Strict opt-in: never emit counseling text or student/case identifiers.
  const developmentDiagnostics = typeof process !== "undefined" && process.env.NODE_ENV === "development";
  const progress = caseData.recommendationType === "updated" ? caseData.progressContext?.latestProgress : null;
  const progressValues = progress ? [progress.progressSummary, progress.studentResponse,
    progress.goalProgress, progress.supportingNote, progress.newPlanOfAction, progress.remarks]
    .filter((value) => typeof value === "string" && value.trim()) : [];
  const normalize = (value) => value.replace(/\s+/g, " ").trim();
  const progressInQuery = progressValues.length > 0 && progressValues.every((value) =>
    normalize(finalRetrievalQuery).includes(normalize(value)));
  if (developmentDiagnostics) console.debug("[intervention-generation] retrieval", {
    generationMode: caseData.recommendationType || "initial",
    selectedProgressNoteId: caseData.sourceProgressNoteId ? String(caseData.sourceProgressNoteId) : null,
    previousInterventionPlanId: caseData.previousPlanId ? String(caseData.previousPlanId) : null,
    updatedConcernsIncludedInRagQuery: progressInQuery,
  });

  if (!finalRetrievalQuery.trim()) {
    throw new Error("Unable to build a retrieval query from the case information.");
  }

  /*
   * ---------------------------------------------
   * RETRIEVAL
   * ---------------------------------------------
   */

  let retrievedChunks = await retrieveInterventionMaterials(finalRetrievalQuery, {
    targetedQuery: progress?.newPlanOfAction || null,
    evidenceLimit: limit,

    practicalLimit: 3,

    numCandidates,
  });

  if (developmentDiagnostics) console.debug("[intervention-generation] references", {
    references: retrievedChunks.map((chunk) => ({
      title: chunk.metadata?.title || chunk.metadata?.source || "Unknown",
      similarityScore: typeof chunk.score === "number" && Number.isFinite(chunk.score) ? chunk.score : null,
    })),
  });

  if (retrievedChunks.length === 0) {
    return {
      status: "insufficient_reference_material",

      reason: "No relevant reference material was retrieved from the knowledge base.",

      recommendations: [],

      retrievedReferences: [],
    };
  }

  /*
   * ---------------------------------------------
   * BUILD PROMPT
   * ---------------------------------------------
   */

  retrievedChunks = await filterEligibleChunks(retrievedChunks);
  if (!retrievedChunks.length)
    return {
      status: "insufficient_reference_material",
      reason: "The supporting resources are no longer active.",
      recommendations: [],
      retrievedReferences: [],
    };

  const prompt = buildInterventionPrompt(caseData, retrievedChunks);
  if (developmentDiagnostics) console.debug("[intervention-generation] prompt", {
    generationMode: caseData.recommendationType || "initial",
    progressInformationIncludedInPrompt: progressValues.length > 0 && progressValues.every((value) => prompt.includes(value)),
    previousInterventionIncludedInPrompt: Boolean(caseData.progressContext?.previousIntervention) &&
      prompt.includes(JSON.stringify(caseData.progressContext.previousIntervention, null, 2)),
  });

  /*
   * ---------------------------------------------
   * GENERATE
   * ---------------------------------------------
   */

  const attempts = [];
  let generationAttemptCount = 0;
  const fail = (status, reason, categories = []) => ({ status, reason, recommendations: [], retrievedReferences: [], _failureCategories: categories });
  const sameActivity = (action) => JSON.stringify([String(action.action || "").trim().toLowerCase().replace(/\s+/g, " "), action.changeType || "", String(action.changeReason || "").trim()]);
  async function runAttempt(generationPrompt, allowedActions = null) {
    let generatedCount = null;
    const attemptFail = (status, reason, categories = []) => ({ ...fail(status, reason, categories), _counts: { generated: generatedCount, passed: null, rejected: null } });
    generationAttemptCount++;
    const rawResponse = await generateResponse(generationPrompt, {
      temperature,
      numPredict,

      /*
       * This service requires a structured
       * recommendation object, so instruct
       * Ollama to constrain its response
       * to valid JSON.
       */
      json: true,
      schema: buildOutputSchema(retrievedChunks.length, caseData.recommendationType === "updated"),
    });

    /*
     * ---------------------------------------------
     * CLEAN + PARSE JSON
     * ---------------------------------------------
     */

    const stillEligible = await filterEligibleChunks(retrievedChunks);
    if (stillEligible.length !== retrievedChunks.length) {
      return {
        status: "insufficient_reference_material",
        reason: "Supporting resources changed during generation. Please try again.",
        recommendations: [],
        retrievedReferences: [],
      };
    }
    const cleanedResponse = cleanJsonResponse(rawResponse);

    let parsedResponse;

    try {
      parsedResponse = JSON.parse(cleanedResponse);
      if (developmentDiagnostics) console.debug("[intervention-generation] response", {
        validJson: true, originalPlanFallbackTriggered: false,
        populated: { recommendations: Array.isArray(parsedResponse?.recommendations) && parsedResponse.recommendations.length > 0,
          interventions: parsedResponse?.recommendations?.every?.((item) => Boolean(item.intervention?.trim())),
          counselorActions: parsedResponse?.recommendations?.every?.((item) => item.counselorActions?.some?.((action) => Boolean(action.action?.trim()))),
          updateAssessment: Boolean(parsedResponse?.updateAssessment) },
      });
    } catch (error) {
      if (developmentDiagnostics) console.debug("[intervention-generation] response", { validJson: false, originalPlanFallbackTriggered: false });
      return attemptFail("malformed_model_output", "The model returned invalid output. No draft was saved.", ["invalid_json"]);
    }

    /*
     * ---------------------------------------------
     * RESOLVE REFERENCES
     * ---------------------------------------------
     */

    if (!parsedResponse || !["ok", "insufficient_reference_material"].includes(parsedResponse.status) || !Array.isArray(parsedResponse.recommendations))
      return attemptFail("malformed_model_output", "The model returned an invalid recommendation format. No draft was saved.", ["invalid_structure"]);
    generatedCount = parsedResponse.recommendations.reduce((count, item) => count + (Array.isArray(item?.counselorActions) ? item.counselorActions.length : 0), 0);
    try {
      if (parsedResponse?.status === "ok") {
        validateRecommendationOutput(parsedResponse, caseData);
        if (!Array.isArray(parsedResponse.recommendations) || !parsedResponse.recommendations.length || parsedResponse.recommendations.length > 3)
          throw new Error("Invalid recommendation structure");
        for (const item of parsedResponse.recommendations) {
          if (typeof item.intervention !== "string" || !item.intervention.trim() || typeof item.rationale !== "string" || !item.rationale.trim() ||
              !Array.isArray(item.counselorActions) || !item.counselorActions.length || item.counselorActions.length > 2)
            throw new Error("Invalid action structure");
          for (const action of item.counselorActions) {
            if (typeof action.action !== "string" || !action.action.trim() || !Array.isArray(action.referenceNumbers))
              throw new Error("Invalid action fields");
            if (action.referenceNumbers.some((number) => !Number.isInteger(number) || number < 1 || number > retrievedChunks.length))
              return attemptFail("malformed_model_output", "The model returned invalid citations. No draft was saved.", ["invalid_citation"]);
          }
        }
        if (allowedActions) {
          if (caseData.recommendationType === "updated") {
            const assessment = parsedResponse.updateAssessment;
            if (!assessment || !["revise", "continue", "mixed"].includes(assessment.decision) ||
                assessment.outcomeConsidered !== true || assessment.proposedNextStepsConsidered !== true ||
                typeof assessment.justification !== "string" || !assessment.justification.trim())
              throw new Error("Missing corrective adjustment explanation");
            if (parsedResponse.recommendations.some((item) => item.counselorActions.some((action) =>
              typeof action.changeReason !== "string" || !action.changeReason.trim())))
              throw new Error("Missing corrective action rationale");
          }
          const used = new Set();
          for (const item of parsedResponse.recommendations) for (const action of item.counselorActions) {
            const key = normalize(action.action).toLowerCase();
            const allowed = allowedActions.find((candidate) => normalize(candidate.action).toLowerCase() === key);
            if (!allowed || used.has(key) || !action.referenceNumbers.length || action.referenceNumbers.some((number) => !allowed.referenceNumbers.includes(number)))
              return attemptFail("needs_regeneration", "The corrected recommendation still contains unsupported or inconsistent activities. No draft was saved.", ["outside_supported_action_set"]);
            used.add(key);
          }
        }
      }
    } catch (error) {
      // All errors created in this block are fixed validation messages; never
      // expose the generated response or case text.
      const safeMessages = ["Invalid recommendation structure", "Invalid action structure", "Invalid action fields", "Missing corrective adjustment explanation", "Missing corrective action rationale"];
      const detail = safeMessages.includes(error.message) || error.message.startsWith("The model must provide") ||
        error.message.startsWith("The intervention goal") || error.message.startsWith("The follow-up plan must")
        ? error.message : "Required recommendation fields failed validation.";
      return attemptFail("malformed_model_output", `The model returned an incomplete or invalid recommendation. ${detail} No draft was saved.`, ["invalid_structure_or_required_fields"]);
    }
    try {
      parsedResponse = await reviewInterventionActions(parsedResponse, caseData, retrievedChunks, generateResponse, { requireConsistency: true });
    } catch (error) {
      if (/Local evidence review|Too many counselor actions/.test(error.message))
        return { ...attemptFail("malformed_model_output", "The automated evidence review was incomplete. No draft was saved.", ["malformed_evidence_review"]), _counts: { generated: generatedCount, passed: null, rejected: null } };
      throw error;
    }
    // The review call also takes time: check authoritative eligibility again.
    const eligibleAfterReview = await filterEligibleChunks(retrievedChunks);
    if (eligibleAfterReview.length !== retrievedChunks.length) return {
      status: "insufficient_reference_material", reason: "Supporting resources changed during evidence review. Please try again.", recommendations: [], retrievedReferences: [],
    };
    let resolvedResponse;
    try { resolvedResponse = resolveRecommendationResponse(parsedResponse, retrievedChunks); }
    catch { return attemptFail("malformed_model_output", "The model returned invalid recommendation fields. No draft was saved.", ["invalid_resolved_fields"]); }
    const reviewedActionsForCounts = (parsedResponse.recommendations || []).flatMap((item) => item.counselorActions || []);
    const retainedCount = resolvedResponse.recommendations.reduce((count, item) => count + item.counselorActions.length, 0);
    const removedCount = generatedCount - retainedCount;
    const categories = [...new Set(reviewedActionsForCounts.flatMap((action) =>
      !(action.evidenceChecks || []).length ? ["missing_action_citations"] :
        action.evidenceChecks.filter((check) => check.support !== "direct").map((check) => check.failureCategory || (check.support === "background" ? "background_only" : "insufficient_action_support"))))];
    const counts = { generated: generatedCount, passed: retainedCount, rejected: removedCount };
    attempts.push({ ...counts, failureCategories: categories, correctiveRetry: Boolean(allowedActions) });
    // Removing only an exact duplicate within the same recommendation does not
    // change the activities described by its summaries. No prose rewriting needed.
    const duplicateOnly = removedCount > 0 && parsedResponse.recommendations.every((item) => {
      const kept = item.counselorActions.filter((action) => action.referenceNumbers.length > 0);
      return item.counselorActions.filter((action) => !action.referenceNumbers.length).every((action) => kept.some((candidate) => sameActivity(candidate) === sameActivity(action)));
    });
    if (developmentDiagnostics) console.debug("[intervention-generation] consistency", {
      ...counts, failureCategories: categories, correctiveRetry: Boolean(allowedActions), duplicateOnly,
    });
    if (resolvedResponse.status !== "ok") {
      // Counts and failure codes are safe to log without exposing case text,
      // source passages, model output, or student identifiers.
      console.warn("[intervention-generation] no-supported-activities", {
        attempt: generationAttemptCount, retrievedChunks: retrievedChunks.length,
        modelStatus: parsedResponse.status, ...counts, failureCategories: categories,
      });
      const reason = parsedResponse.status === "insufficient_reference_material"
        ? "The model could not identify supported activities in the retrieved knowledge-base passages. No draft was saved."
        : categories.length === 1 && categories[0] === "missing_action_citations"
          ? "The model generated activities without supporting citations. No draft was saved. Try generating again."
          : "The generated activities did not pass evidence validation against the retrieved knowledge-base passages. No draft was saved. Review the material for explicit activity instructions.";
      return { ...attemptFail("insufficient_reference_material", reason, categories), _counts: counts,
        _rejectedActions: reviewedActionsForCounts.map((action) => ({ action: action.action, evidenceChecks: action.evidenceChecks })),
      };
    }
    if (parsedResponse._consistencyPassed !== true) return {
      ...attemptFail("needs_regeneration", "The recommendation did not pass the consistency check. No draft was saved.", [...categories, "consistency_check_failed"]),
      _counts: counts,
      _allowedActions: resolvedResponse.recommendations.flatMap((item) => item.counselorActions.map((action) => ({
        action: action.action, referenceNumbers: action.references.map((reference) => reference.referenceNumber),
        changeType: action.changeType, changeReason: action.changeReason,
      }))),
      _rejectedActions: reviewedActionsForCounts.filter((action) => !action.referenceNumbers.length).map((action) => ({ action: action.action, evidenceChecks: action.evidenceChecks })),
    };
    if (removedCount > 0 && !duplicateOnly) return {
      ...attemptFail("needs_regeneration", "Some activities lacked support. The remaining recommendation needs correction.", [...categories, "dependent_fields_stale"]),
      _counts: counts,
      _allowedActions: resolvedResponse.recommendations.flatMap((item) => item.counselorActions.map((action) => ({
        action: action.action, referenceNumbers: action.references.map((reference) => reference.referenceNumber),
        changeType: action.changeType, changeReason: action.changeReason,
      }))),
      _rejectedActions: reviewedActionsForCounts.filter((action) => !action.referenceNumbers.length).map((action) => ({ action: action.action, evidenceChecks: action.evidenceChecks })),
    };
    const generationWarnings = [];
    const reviewedActions = parsedResponse.recommendations?.flatMap((item) => item.counselorActions || []) || [];
    if (reviewedActions.some((action) => action.evidenceChecks?.some((check) => check.support !== "direct")))
      generationWarnings.push("Some citations supplied background information or insufficient technique support and were excluded. Actions with no direct support were omitted. Verify retained evidence before approval.");
    if (reviewedActions.some((action) => action.evidenceStatus === "insufficient"))
      generationWarnings.push("Review the generated goal and follow-up evaluation for alignment with the retained actions after unsupported activities were omitted.");
    if (reviewedActions.some((action) => action.classificationNeedsReview || action.classificationCorrected))
      generationWarnings.push("Some action classifications were uncertain or corrected during history review. Verify them against the previous intervention.");
    if (developmentDiagnostics) console.debug("[intervention-generation] evidence-review", {
      reviewedActions: reviewedActions.length,
      directCitations: reviewedActions.reduce((sum, action) => sum + (action.referenceNumbers?.length || 0), 0),
      excludedCitations: reviewedActions.reduce((sum, action) => sum + (action.evidenceChecks?.filter((check) => check.support !== "direct").length || 0), 0),
    });
    let updateAssessment;
    if (caseData.recommendationType === "updated" && resolvedResponse.status === "ok") {
      const assessment = parsedResponse.updateAssessment;
      const validAssessment = assessment && ["revise", "continue", "mixed"].includes(assessment.decision) &&
        assessment.outcomeConsidered === true && assessment.proposedNextStepsConsidered === true &&
        typeof assessment.justification === "string" && assessment.justification.trim();
      if (validAssessment) updateAssessment = {
        decision: assessment.decision, outcomeConsidered: true, proposedNextStepsConsidered: true,
        justification: assessment.justification.trim(),
      };
      else generationWarnings.push("The model did not explicitly explain consideration of the latest outcome and proposed next steps. Counselor review is required.");
      const tokens = (text) => new Set((text || "").toLowerCase().match(/[a-z0-9]+/g) || []);
      const previous = tokens(caseData.progressContext?.previousIntervention?.planOfAction);
      const generated = tokens(resolvedResponse.recommendations.map((item) =>
        [item.intervention, ...item.counselorActions.map((action) => action.action)].join(" ")).join(" "));
      const shared = [...generated].filter((word) => previous.has(word)).length;
      const overlap = previous.size && generated.size ? 2 * shared / (previous.size + generated.size) : 0;
      const substantialOverlap = overlap >= 0.75;
      if (substantialOverlap) generationWarnings.push("The updated recommendation substantially overlaps with the previous plan. Review the justification for retaining earlier strategies.");
      if (developmentDiagnostics) console.debug("[intervention-generation] revision-review", {
        substantialOverlap, overlapScore: Number(overlap.toFixed(3)),
        outcomeAndNextStepsExplicitlyConsidered: Boolean(validAssessment), warningCount: generationWarnings.length,
      });
      if (substantialOverlap && !validAssessment) return {
        ...attemptFail("needs_regeneration", "The recommendation did not explain its response to prior outcomes. No draft was saved.", ["outcome_not_explained"]),
        _counts: counts,
        _allowedActions: resolvedResponse.recommendations.flatMap((item) => item.counselorActions.map((action) => ({
          action: action.action, referenceNumbers: action.references.map((reference) => reference.referenceNumber),
          changeType: action.changeType, changeReason: action.changeReason,
        }))),
        generationWarnings,
      };
    }


    /*
     * ---------------------------------------------
     * RETURN RESULT
     * ---------------------------------------------
     */

    const usedReferences = new Set(resolvedResponse.recommendations.flatMap((item) =>
      item.counselorActions.flatMap((action) => action.references.map((reference) => reference.referenceNumber))));
    return {
      ...resolvedResponse,
      _counts: counts,
      consistencyStatus: allowedActions ? "corrected_and_validated" : duplicateOnly ? "duplicate_reconciled" : "validated",
      generationWarnings,
      goal: parsedResponse.goal?.trim(),
      followUpPlan: parsedResponse.followUpPlan?.trim(),
      updateAssessment,

      retrievedReferences: retrievedChunks.map((chunk, index) => {
        return {
          referenceNumber: index + 1,

          source: chunk.metadata?.source || "Unknown",

          title: chunk.metadata?.title || chunk.metadata?.source || "Unknown",

          resourceType: chunk.metadata?.resourceType || "reference",

          resourceId: chunk.metadata?.resourceId || null,

          pageNumber: chunk.metadata?.pageNumber ?? null,

          score: typeof chunk.score === "number" ? chunk.score : null,
        };
      }).filter((reference) => usedReferences.has(reference.referenceNumber)),
    };
  }

  const initial = await runAttempt(prompt);
  let finalResult = initial;
  let correctiveRetryOccurred = false;
  let groundingRetryOccurred = false;
  if (initial.status === "needs_regeneration" && initial._allowedActions?.length) {
    const eligibleForRetry = await filterEligibleChunks(retrievedChunks);
    if (eligibleForRetry.length !== retrievedChunks.length) {
      finalResult = fail("insufficient_reference_material", "Supporting resources changed. Please try again.", ["resources_changed"]);
    } else {
      correctiveRetryOccurred = true;
      const allowedByText = new Map();
      for (const action of initial._allowedActions) {
        const key = normalize(action.action).toLowerCase();
        const previous = allowedByText.get(key);
        if (previous) previous.referenceNumbers = [...new Set([...previous.referenceNumbers, ...action.referenceNumbers])];
        else allowedByText.set(key, { ...action, referenceNumbers: [...action.referenceNumbers] });
      }
      const allowedActions = [...allowedByText.values()];
      const correctionPrompt = `${prompt}

CORRECTIVE_RETRY_ONLY — one complete replacement, not appended actions.
The earlier result failed evidence or consistency checks. Rebuild ALL output fields,
including goal, intervention titles, group rationales, action reasons, follow-up,
and updateAssessment, from ONLY the allowed supported activities below.
Use each allowed activity at most once, copy its action text exactly, and cite
only its allowed referenceNumbers. You may omit redundant allowed activities.
Never restore rejected activities, introduce new techniques, or infer that a
related technique (such as prioritizing from breaking tasks down) was included.
The original case, progress, previous outcomes, and reference passages above
remain authoritative. Keep the documented schedule separate from follow-up evaluation.
Return the same complete JSON structure. If a coherent complete plan cannot be
supported, return insufficient_reference_material. Do not fabricate evidence.
VALIDATION_FAILURES_AND_ALLOWED_ACTIVITIES:
${JSON.stringify({ failureCategories: initial._failureCategories, rejectedActions: initial._rejectedActions, allowedActions })}`;
      finalResult = await runAttempt(correctionPrompt, allowedActions);
    }
  } else if (initial.status === "insufficient_reference_material" && initial._counts?.generated > 0 &&
      initial._failureCategories?.length && initial._failureCategories.every((category) =>
        ["background_only", "insufficient_action_support", "unmatched_support_quote"].includes(category))) {
    // A valid JSON plan can still propose techniques absent from the passages.
    // Retry once from the sources, then apply the full independent review again.
    // Never retry missing/malformed reviews as if they established a lack of support.
    const eligibleForRetry = await filterEligibleChunks(retrievedChunks);
    if (eligibleForRetry.length !== retrievedChunks.length) {
      finalResult = fail("insufficient_reference_material", "Supporting resources changed. Please try again.", ["resources_changed"]);
    } else {
      groundingRetryOccurred = true;
      finalResult = await runAttempt(`${prompt}

SOURCE_GROUNDED_RETRY — return one complete replacement plan.
All activities in the earlier attempt failed evidence validation. Treat the
rejected activities below as untrusted model output, never as source evidence.
Start by locating an explicit instruction, exercise, or counselor activity in
the supplied reference Content. Propose only an activity actually described
there and relevant to the documented case. Prefer ONE recommendation with ONE
simple activity and ONE directly supporting citation. Do not combine techniques
or add steps from general knowledge. A passage explaining symptoms or theory
does not support teaching an unrelated technique. A description of an exercise
supports using that exercise, not additional techniques absent from the passage.
Build the goal, rationale, follow-up, and any updateAssessment solely around the
supported activity. Return insufficient_reference_material if the passages contain
no relevant activity instructions. Do not fabricate a plan to force success.
REJECTED_ACTIVITIES_AND_CHECKS:
${JSON.stringify(initial._rejectedActions || [])}`);
    }
  }
  if (developmentDiagnostics) console.debug("[intervention-generation] recovery", {
    initialGeneratedActions: initial._counts?.generated ?? null,
    initialPassingActions: initial._counts?.passed ?? null,
    initialRejectedActions: initial._counts?.rejected ?? null,
    failureCategories: initial._failureCategories || attempts[0]?.failureCategories || [],
    correctiveRetryOccurred, groundingRetryOccurred, generationAttempts: generationAttemptCount, reviewedAttempts: attempts.length, finalOutcome: finalResult.status,
    finalFailureCategories: finalResult._failureCategories || [],
  });
  if (correctiveRetryOccurred && finalResult.status === "needs_regeneration")
    finalResult.reason = "The corrected recommendation could not be aligned with supported activities. No draft was saved.";
  const { _allowedActions, _rejectedActions, _counts, _failureCategories, ...publicResult } = finalResult;
  return { ...publicResult, correctiveRetryOccurred, groundingRetryOccurred };
};

module.exports = {
  generateInterventionRecommendations,
};
