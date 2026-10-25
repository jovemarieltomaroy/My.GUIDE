require("dotenv").config();

const mongoose = require("mongoose");

const {
  generateInterventionRecommendations,
} = require("../services/rag/interventionRecommendationService");

const runTest = async () => {
  try {
    /*
     * ---------------------------------------------
     * 1. CONNECT TO MONGODB
     * ---------------------------------------------
     */

    console.log("Connecting to MongoDB...");

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected.");

    /*
     * ---------------------------------------------
     * 2. TEMPORARY SAMPLE CASE
     * ---------------------------------------------
     *
     * Later this will come from the
     * actual My.GUIDE Case model.
     */

    const caseData = {
      currentPresentation:
        "The student reports feeling anxious and overwhelmed because of increasing academic responsibilities.",

      problemAssessment:
        "The student is having difficulty organizing school requirements and managing academic pressure.",

      caseFormulationFactors:
        "Academic workload and fear of falling behind appear to contribute to the student's stress.",

      backgroundAndPsychosocialHistory:
        "No additional relevant background information is available for this test.",

      caseFormulation:
        "The student's current concern appears primarily related to academic stress and difficulty managing responsibilities.",
    };

    /*
     * ---------------------------------------------
     * 3. GENERATE RECOMMENDATIONS
     * ---------------------------------------------
     *
     * We temporarily keep the same retrieval
     * query used in previous tests so we can
     * compare results fairly.
     *
     * Later we can remove this override and
     * allow the service to build the retrieval
     * query automatically from caseData.
     */

    console.log("\nGenerating intervention recommendations...");

    const result = await generateInterventionRecommendations(caseData, {
      retrievalQuery: `Student experiencing anxiety,
                        academic stress, and difficulty
                        managing school responsibilities.`,

      limit: 5,

      numCandidates: 50,

      temperature: 0.2,

      numPredict: 3000,
    });

    /*
     * ---------------------------------------------
     * 4. DISPLAY RETRIEVED REFERENCES
     * ---------------------------------------------
     */

    console.log("\n========== RETRIEVED REFERENCES ==========\n");

    result.retrievedReferences.forEach((reference) => {
      console.log(`REFERENCE ${reference.referenceNumber}`);

      console.log(`Title: ${reference.title}`);

      console.log(`Source: ${reference.source}`);

      console.log(`Resource Type: ${reference.resourceType}`);

      console.log(`Resource ID: ${reference.resourceId || "None"}`);

      console.log(`Page: ${reference.pageNumber ?? "Unknown"}`);

      console.log(`Score: ${reference.score ?? "Not available"}`);

      console.log("");
    });

    /*
     * ---------------------------------------------
     * 5. DISPLAY FINAL RESULT
     * ---------------------------------------------
     */

    console.log("========== FINAL RECOMMENDATION ==========\n");

    console.log(JSON.stringify(result, null, 2));

    console.log("\n==========================================");

    console.log("\nRecommendation test completed.");
  } catch (error) {
    console.error("\nRecommendation test failed:");

    console.error(error.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();

      console.log("\nMongoDB disconnected.");
    }
  }
};

runTest();
