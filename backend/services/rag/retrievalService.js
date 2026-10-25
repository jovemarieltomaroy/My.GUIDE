const KnowledgeResource = require("../../models/knowledgeResource");
const { isResourceEligible } = require("../resourceEligibility");

// Read authoritative parent records on every retrieval; no eligibility cache.
const filterEligibleChunks = async (chunks) => {
  const ids = [
    ...new Set(
      chunks
        .map((chunk) => chunk.metadata?.resourceId)
        .filter((id) => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id))
    ),
  ];
  if (!ids.length) return [];
  const resources = await KnowledgeResource.find({ _id: { $in: ids } }).lean();
  const eligible = new Map(
    resources.filter(isResourceEligible).map((resource) => [String(resource._id), resource])
  );
  return chunks
    .filter(
      (chunk) =>
        chunk.metadata?.approvalStatus === "approved" && eligible.has(chunk.metadata?.resourceId)
    )
    .map((chunk) => {
      const parent = eligible.get(chunk.metadata.resourceId);
      return {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          title: parent.title,
          source: parent.title,
          topic: parent.topic,
          resourceType: parent.resourceType,
        },
      };
    });
};

const KnowledgeChunk = require("../../models/knowledgeChunk");

const { generateEmbedding } = require("./embeddingService");

const VECTOR_INDEX_NAME = process.env.VECTOR_INDEX_NAME || "knowledge_vector_index";

const { PRACTICAL_RESOURCE_TYPES } = require("../resourceEligibility");

/**
 * Validates common retrieval options.
 */
const validateRetrievalOptions = ({ limit, numCandidates, minimumScore }) => {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Retrieval limit must be a positive integer.");
  }

  if (!Number.isInteger(numCandidates) || numCandidates < limit) {
    throw new Error("numCandidates must be greater than or equal to limit.");
  }

  if (
    typeof minimumScore !== "number" ||
    !Number.isFinite(minimumScore) ||
    minimumScore < 0 ||
    minimumScore > 1
  ) {
    throw new Error("minimumScore must be a number between 0 and 1.");
  }
};

/**
 * Runs MongoDB Atlas vector search.
 *
 * The filter is applied after vector search intentionally.
 * This avoids requiring resourceType to be configured as
 * an Atlas Vector Search filter field.
 */
const runVectorSearch = async ({
  queryEmbedding,
  limit,
  numCandidates,
  minimumScore,
  resourceTypes = null,
}) => {
  const searchLimit = Math.max(limit * 10, 50);

  const candidateCount = Math.max(numCandidates, searchLimit);

  const results = await KnowledgeChunk.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,

        path: "embedding",

        queryVector: queryEmbedding,

        numCandidates: candidateCount,

        limit: searchLimit,
      },
    },

    {
      $project: {
        _id: 1,
        content: 1,
        metadata: 1,

        score: {
          $meta: "vectorSearchScore",
        },
      },
    },
  ]);

  let filteredResults = results.filter(
    (result) =>
      typeof result.score === "number" &&
      result.score >= minimumScore &&
      result.metadata?.approvalStatus === "approved"
  );

  filteredResults = await filterEligibleChunks(filteredResults);

  if (Array.isArray(resourceTypes) && resourceTypes.length > 0) {
    filteredResults = filteredResults.filter((result) =>
      resourceTypes.includes(result.metadata?.resourceType)
    );
  }

  return filteredResults.slice(0, limit);
};

/**
 * Retrieves knowledge chunks that are semantically
 * related to the given query.
 */
const retrieveRelevantChunks = async (
  query,
  { limit = 5, numCandidates = 50, minimumScore = 0, resourceTypes = null } = {}
) => {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("A valid retrieval query is required.");
  }

  validateRetrievalOptions({
    limit,
    numCandidates,
    minimumScore,
  });

  const queryEmbedding = await generateEmbedding(query.trim());

  return runVectorSearch({
    queryEmbedding,
    limit,
    numCandidates,
    minimumScore,
    resourceTypes,
  });
};

/**
 * Retrieves both:
 *
 * 1. strong general intervention evidence; and
 * 2. relevant practical resources such as worksheets.
 *
 * Practical resources are NOT automatically selected.
 * They are only added to the candidate context so the
 * LLM has a real practical PDF available when relevant.
 */
const retrieveInterventionMaterials = async (
  query,
  { evidenceLimit = 5, practicalLimit = 3, numCandidates = 75, minimumScore = 0, targetedQuery = null } = {}
) => {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("A valid retrieval query is required.");
  }

  validateRetrievalOptions({
    limit: evidenceLimit,
    numCandidates,
    minimumScore,
  });

  validateRetrievalOptions({
    limit: practicalLimit,
    numCandidates,
    minimumScore,
  });

  // Updated plans search proposed next steps separately so long history cannot
  // dilute the adjustment target. Keep original results as additional evidence.
  const targetedResults = typeof targetedQuery === "string" && targetedQuery.trim()
    ? await retrieveRelevantChunks(targetedQuery, { limit: evidenceLimit, numCandidates, minimumScore }) : [];
  const queryEmbedding = await generateEmbedding(query.trim());

  const [evidenceResults, practicalResults] = await Promise.all([
    runVectorSearch({
      queryEmbedding,
      limit: evidenceLimit,
      numCandidates,
      minimumScore,
    }),

    runVectorSearch({
      queryEmbedding,
      limit: practicalLimit,
      numCandidates,
      minimumScore,
      resourceTypes: PRACTICAL_RESOURCE_TYPES,
    }),
  ]);

  /*
   * Keep the strongest general evidence first.
   *
   * Then append practical resources that are not
   * already represented.
   *
   * Deduplication is primarily by chunk _id.
   */
  const combined = [];
  const seenChunkIds = new Set();
  const resourceCounts = new Map();

  const addResult = (result) => {
    const chunkId = result?._id ? String(result._id) : null;

    if (chunkId && seenChunkIds.has(chunkId)) {
      return;
    }

    if (chunkId) {
      seenChunkIds.add(chunkId);
    }

    const resourceKey = result.metadata?.resourceId || result.metadata?.title || chunkId;
    if (targetedResults.length && (resourceCounts.get(resourceKey) || 0) >= 2) return;
    resourceCounts.set(resourceKey, (resourceCounts.get(resourceKey) || 0) + 1);
    combined.push(result);
  };

  targetedResults.forEach(addResult);
  evidenceResults.forEach(addResult);

  practicalResults.forEach(addResult);

  return targetedResults.length ? combined.slice(0, evidenceLimit + practicalLimit) : combined;
};

module.exports = {
  filterEligibleChunks,
  retrieveRelevantChunks,
  retrieveInterventionMaterials,
  PRACTICAL_RESOURCE_TYPES,
};
