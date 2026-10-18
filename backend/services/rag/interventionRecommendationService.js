const {
    retrieveInterventionMaterials,
    filterEligibleChunks,
} = require(
    "./retrievalService"
);

const {
    buildInterventionPrompt,
} = require(
    "./promptBuilderService"
);

const {
    generateResponse,
} = require(
    "../llm/ollamaService"
);


/**
 * Removes optional Markdown fences.
 *
 * @param {string} text
 * @returns {string}
 */
const cleanJsonResponse = (
    text
) => {
    if (
        typeof text !==
        "string"
    ) {
        throw new Error(
            "Gemma response must be a string."
        );
    }

    return text
        .trim()
        .replace(
            /^```json\s*/i,
            ""
        )
        .replace(
            /^```\s*/i,
            ""
        )
        .replace(
            /\s*```$/,
            ""
        )
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
const resolveReference = (
    referenceNumber,
    retrievedChunks
) => {
    if (
        !Number.isInteger(
            referenceNumber
        )
    ) {
        throw new Error(
            `Invalid reference number: ${referenceNumber}`
        );
    }


    if (
        referenceNumber < 1 ||
        referenceNumber >
            retrievedChunks.length
    ) {
        throw new Error(
            `Reference ${referenceNumber} does not exist among the retrieved references.`
        );
    }


    const chunk =
        retrievedChunks[
            referenceNumber - 1
        ];


    return {
        referenceNumber,

        source:
            chunk.metadata
                ?.source ||
            "Unknown",

        title:
            chunk.metadata
                ?.title ||
            chunk.metadata
                ?.source ||
            "Unknown",

        resourceType:
            chunk.metadata
                ?.resourceType ||
            "reference",

        topic:
            chunk.metadata
                ?.topic ||
            "Not specified",

        pageNumber:
            chunk.metadata
                ?.pageNumber ??
            null,

        score:
            typeof chunk.score ===
            "number"
                ? chunk.score
                : null,
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
const resolveSupportingResource = (
    supportingResource,
    retrievedChunks
) => {
    if (
        supportingResource ===
        null
    ) {
        return null;
    }


    if (
        !supportingResource ||
        !Number.isInteger(
            supportingResource
                .referenceNumber
        )
    ) {
        throw new Error(
            "Invalid supporting resource returned by Gemma."
        );
    }


    const referenceNumber =
        supportingResource
            .referenceNumber;


    if (
        referenceNumber < 1 ||
        referenceNumber >
            retrievedChunks.length
    ) {
        throw new Error(
            `Supporting resource reference ${referenceNumber} does not exist.`
        );
    }


    const chunk =
        retrievedChunks[
            referenceNumber - 1
        ];


    const resourceType =
        chunk.metadata
            ?.resourceType ||
        "reference";


    const allowedResourceTypes = [
        "worksheet",
        "handout",
    ];


    if (
        !allowedResourceTypes.includes(
            resourceType
        )
    ) {
        console.warn(
            `Ignoring invalid supporting resource selection: Reference ${referenceNumber} has resource type "${resourceType}".`
        );

        return null;
    }

    return {
        referenceNumber,

        resourceId:
            chunk.metadata
                ?.resourceId ||
            null,

        title:
            chunk.metadata
                ?.title ||
            chunk.metadata
                ?.source ||
            "Unknown",

        source:
            chunk.metadata
                ?.source ||
            "Unknown",

        resourceType,

        topic:
            chunk.metadata
                ?.topic ||
            "Not specified",

        approvalStatus:
            chunk.metadata
                ?.approvalStatus ||
            "unspecified",

        originalFilename:
            chunk.metadata
                ?.originalFilename ||
            null,

        relativeFilePath:
            chunk.metadata
                ?.relativeFilePath ||
            null,

        pageNumber:
            chunk.metadata
                ?.pageNumber ??
            null,
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
const findSupportingResourceFromActions = (
    recommendation,
    retrievedChunks
) => {
    const allowedResourceTypes = [
        "worksheet",
        "handout",
    ];

    if (
        !recommendation ||
        !Array.isArray(
            recommendation.counselorActions
        )
    ) {
        return null;
    }

    const referencedNumbers = [
        ...new Set(
            recommendation.counselorActions
                .flatMap(
                    (action) =>
                        Array.isArray(
                            action.referenceNumbers
                        )
                            ? action.referenceNumbers
                            : []
                )
                .filter(
                    (referenceNumber) =>
                        Number.isInteger(
                            referenceNumber
                        )
                )
        ),
    ];

    for (
        const referenceNumber
        of referencedNumbers
    ) {
        if (
            referenceNumber < 1 ||
            referenceNumber >
                retrievedChunks.length
        ) {
            continue;
        }

        const chunk =
            retrievedChunks[
                referenceNumber - 1
            ];

        const resourceType =
            chunk.metadata
                ?.resourceType ||
            "reference";

        if (
            !allowedResourceTypes.includes(
                resourceType
            )
        ) {
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
const resolveCounselorAction = (
    action,
    retrievedChunks,
    recommendationIndex,
    actionIndex
) => {
    if (
        !action ||
        typeof action !==
            "object"
    ) {
        throw new Error(
            `Recommendation ${recommendationIndex + 1}, action ${actionIndex + 1} is invalid.`
        );
    }


    if (
        !action.action ||
        typeof action.action !==
            "string"
    ) {
        throw new Error(
            `Recommendation ${recommendationIndex + 1}, action ${actionIndex + 1} is missing action text.`
        );
    }


    if (
        !Array.isArray(
            action.referenceNumbers
        )
    ) {
        throw new Error(
            `Recommendation ${recommendationIndex + 1}, action ${actionIndex + 1} is missing referenceNumbers.`
        );
    }


    if (
        action.referenceNumbers
            .length === 0
    ) {
        console.warn(
            `Skipping Recommendation ${recommendationIndex + 1}, action ${actionIndex + 1}: no supporting references were provided.`
        );

        return null;
    }


    const references =
        action.referenceNumbers
            .map(
                (
                    referenceNumber
                ) =>
                    resolveReference(
                        referenceNumber,
                        retrievedChunks
                    )
            );


    return {
        action:
            action.action,

        references,
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
const resolveRecommendationResponse = (
    parsedResponse,
    retrievedChunks
) => {
    if (
        !parsedResponse ||
        typeof parsedResponse !==
            "object"
    ) {
        throw new Error(
            "Gemma returned an invalid recommendation object."
        );
    }


    if (
        !Array.isArray(
            parsedResponse
                .recommendations
        )
    ) {
        throw new Error(
            'Gemma response is missing the "recommendations" array.'
        );
    }


    /*
     * ---------------------------------------------
     * INSUFFICIENT REFERENCES
     * ---------------------------------------------
     */

    if (
        parsedResponse.status ===
        "insufficient_reference_material"
    ) {
        return {
            status:
                "insufficient_reference_material",

            reason:
                parsedResponse.reason ||
                "No sufficient intervention reference material was identified.",

            recommendations: [],
        };
    }


    /*
     * ---------------------------------------------
     * NORMAL RESPONSE
     * ---------------------------------------------
     */

    if (
        parsedResponse.status !==
        "ok"
    ) {
        throw new Error(
            `Unexpected Gemma response status: ${parsedResponse.status}`
        );
    }


    const resolvedRecommendations =
        parsedResponse
            .recommendations
            .map(
                (
                    recommendation,
                    recommendationIndex
                ) => {
                    /*
                     * -------------------------------
                     * BASIC VALIDATION
                     * -------------------------------
                     */

                    if (
                        !recommendation
                            .intervention ||
                        typeof recommendation
                            .intervention !==
                            "string"
                    ) {
                        throw new Error(
                            `Recommendation ${recommendationIndex + 1} is missing a valid intervention name.`
                        );
                    }


                    if (
                        !recommendation
                            .rationale ||
                        typeof recommendation
                            .rationale !==
                            "string"
                    ) {
                        throw new Error(
                            `Recommendation ${recommendationIndex + 1} is missing a valid rationale.`
                        );
                    }


                    if (
                        !Array.isArray(
                            recommendation
                                .counselorActions
                        )
                    ) {
                        throw new Error(
                            `Recommendation ${recommendationIndex + 1} is missing counselorActions.`
                        );
                    }


                    if (
                        recommendation
                            .counselorActions
                            .length === 0
                    ) {
                        throw new Error(
                            `Recommendation ${recommendationIndex + 1} has no counselor actions.`
                        );
                    }


                    /*
                     * -------------------------------
                     * RESOLVE EACH ACTION
                     * -------------------------------
                     */

                    const counselorActions =
                    recommendation
                        .counselorActions
                        .map(
                            (
                                action,
                                actionIndex
                            ) =>
                                resolveCounselorAction(
                                    action,
                                    retrievedChunks,
                                    recommendationIndex,
                                    actionIndex
                                )
                        )
                        .filter(Boolean);

                        if (
                            counselorActions.length === 0
                        ) {
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
                        if (
                            recommendation
                                .supportingResource
                        ) {
                            supportingResource =
                                resolveSupportingResource(
                                    recommendation
                                        .supportingResource,
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
                            supportingResource =
                                findSupportingResourceFromActions(
                                    recommendation,
                                    retrievedChunks
                                );
                        }


                    /*
                     * -------------------------------
                     * FINAL RECOMMENDATION
                     * -------------------------------
                     */

                    return {
                        intervention:
                            recommendation
                                .intervention,

                        rationale:
                            recommendation
                                .rationale,

                        counselorActions,

                        supportingResource,
                    };
                }
            )
            .filter(Boolean);     
            
            if (
                resolvedRecommendations.length === 0
            ) {
                return {
                    status:
                        "insufficient_reference_material",

                    reason:
                        "No sufficiently grounded intervention recommendations remained after reference validation.",

                    recommendations: [],
                };
            }

    return {
        status: "ok",

        reason: null,

        recommendations:
            resolvedRecommendations,
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
const generateInterventionRecommendations =
    async (
        caseData,
        options = {}
    ) => {
        if (
            !caseData ||
            typeof caseData !==
                "object"
        ) {
            throw new Error(
                "Valid case data is required."
            );
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
                caseData
                    .currentPresentation,

                caseData
                    .problemAssessment,

                caseData
                    .caseFormulationFactors,

                caseData
                    .caseFormulation,
            ]
                .filter(
                    (
                        value
                    ) =>
                        typeof value ===
                            "string" &&
                        value.trim()
                )
                .join(
                    "\n"
                );


        if (
            !finalRetrievalQuery
                .trim()
        ) {
            throw new Error(
                "Unable to build a retrieval query from the case information."
            );
        }


        /*
         * ---------------------------------------------
         * RETRIEVAL
         * ---------------------------------------------
         */

        let retrievedChunks =
            await retrieveInterventionMaterials(
                finalRetrievalQuery,
                {
                    evidenceLimit:
                        limit,

                    practicalLimit:
                        3,

                    numCandidates,
                }
            );


        if (
            retrievedChunks.length ===
            0
        ) {
            return {
                status:
                    "insufficient_reference_material",

                reason:
                    "No relevant reference material was retrieved from the knowledge base.",

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
        if (!retrievedChunks.length) return { status: "insufficient_reference_material", reason: "The supporting resources are no longer active.", recommendations: [], retrievedReferences: [] };

        const prompt =
            buildInterventionPrompt(
                caseData,
                retrievedChunks
            );


        /*
         * ---------------------------------------------
         * GENERATE
         * ---------------------------------------------
         */

       const rawResponse =
        await generateResponse(
            prompt,
            {
                temperature,
                numPredict,

                /*
                * This service requires a structured
                * recommendation object, so instruct
                * Ollama to constrain its response
                * to valid JSON.
                */
                json: true,
            }
        );


        /*
         * ---------------------------------------------
         * CLEAN + PARSE JSON
         * ---------------------------------------------
         */

        const stillEligible = await filterEligibleChunks(retrievedChunks);
        if (stillEligible.length !== retrievedChunks.length) {
            return { status: 'insufficient_reference_material', reason: 'Supporting resources changed during generation. Please try again.', recommendations: [], retrievedReferences: [] };
        }
        const cleanedResponse =
            cleanJsonResponse(
                rawResponse
            );



        let parsedResponse;


        try {
            parsedResponse =
                JSON.parse(
                    cleanedResponse
                );
        } catch (
            error
        ) {
            throw new Error(
                `Gemma returned invalid JSON: ${error.message}`
            );
        }


        /*
         * ---------------------------------------------
         * RESOLVE REFERENCES
         * ---------------------------------------------
         */

        const resolvedResponse =
            resolveRecommendationResponse(
                parsedResponse,
                retrievedChunks
            );


        /*
         * ---------------------------------------------
         * RETURN RESULT
         * ---------------------------------------------
         */

        return {
            ...resolvedResponse,

            retrievedReferences:
                retrievedChunks.map(
                    (
                        chunk,
                        index
                    ) => {
                        return {
                            referenceNumber:
                                index + 1,

                            source:
                                chunk
                                    .metadata
                                    ?.source ||
                                "Unknown",

                            title:
                                chunk
                                    .metadata
                                    ?.title ||
                                chunk
                                    .metadata
                                    ?.source ||
                                "Unknown",

                            resourceType:
                                chunk
                                    .metadata
                                    ?.resourceType ||
                                "reference",

                            resourceId:
                                chunk
                                    .metadata
                                    ?.resourceId ||
                                null,

                            pageNumber:
                                chunk
                                    .metadata
                                    ?.pageNumber ??
                                null,

                            score:
                                typeof chunk.score ===
                                "number"
                                    ? chunk.score
                                    : null,
                        };
                    }
                ),
        };
    };


module.exports = {
    generateInterventionRecommendations,
};