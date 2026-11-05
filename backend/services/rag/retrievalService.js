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

const compactAnswerLines = (text) => String(text || "").replace(/_{3,}/g, " ").replace(/\s+/g, " ").trim();

// Blank writing lines can split a one-page exercise into many near-duplicate
// hits. Combine only approved candidate passages from the same resource/page.
// The highest scoring hit retains its identity, score, and page attribution.
const selectRetrievalContext = (candidates, limit) => {
  const pageGroups = new Map();
  const pageKey = (chunk) => PRACTICAL_RESOURCE_TYPES.includes(chunk.metadata?.resourceType) &&
    chunk.metadata?.resourceId && Number.isInteger(chunk.metadata?.pageNumber)
    ? `${chunk.metadata.resourceId}:${chunk.metadata.pageNumber}` : null;
  for (const chunk of candidates) {
    const key = pageKey(chunk);
    if (key) pageGroups.set(key, [...(pageGroups.get(key) || []), chunk]);
  }
  const seenPages = new Set();
  const resourceCounts = new Map();
  const selected = [];
  for (const chunk of candidates) {
    const key = pageKey(chunk);
    if (key && seenPages.has(key)) continue;
    const resourceId = chunk.metadata?.resourceId || String(chunk._id);
    if ((resourceCounts.get(resourceId) || 0) >= 2) continue;
    let content = compactAnswerLines(chunk.content);
    if (key) {
      const ordered = [...pageGroups.get(key)].sort((a, b) => (a.metadata.chunkIndex || 0) - (b.metadata.chunkIndex || 0));
      let merged = "";
      for (const part of ordered) {
        const text = compactAnswerLines(part.content);
        if (!text || merged.includes(text)) continue;
        let overlap = Math.min(merged.length, text.length);
        while (overlap >= 20 && merged.slice(-overlap) !== text.slice(0, overlap)) overlap--;
        merged += `${merged ? " " : ""}${text.slice(overlap >= 20 ? overlap : 0)}`;
      }
      // Keep context bounded. Large pages retain the actual retrieved passage.
      if (merged.length <= 4000) content = compactAnswerLines(merged);
      seenPages.add(key);
    }
    selected.push({ ...chunk, content });
    resourceCounts.set(resourceId, (resourceCounts.get(resourceId) || 0) + 1);
    if (selected.length === limit) break;
  }
  return selected;
};

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

  return selectRetrievalContext(filteredResults, limit);
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

  if (!(await KnowledgeChunk.exists({}))) return [];
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
  if (!(await KnowledgeChunk.exists({}))) return [];
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
  selectRetrievalContext,
};
