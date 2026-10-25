const { generateEmbeddings } = require("./embeddingService");

/**
 * Adds embeddings to text chunks in batches.
 *
 * @param {Array<object>} chunks - Chunks containing a content field.
 * @param {object} options - Embedding options.
 * @param {number} options.batchSize - Number of chunks per API request.
 * @returns {Promise<Array<object>>}
 */
const embedChunks = async (chunks, { batchSize = 25 } = {}) => {
  if (!Array.isArray(chunks)) {
    throw new Error("Chunks must be provided as an array.");
  }

  if (chunks.length === 0) {
    return [];
  }

  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("Batch size must be a positive integer.");
  }

  const embeddedChunks = [];

  for (let startIndex = 0; startIndex < chunks.length; startIndex += batchSize) {
    const batch = chunks.slice(startIndex, startIndex + batchSize);

    const texts = batch.map((chunk, batchIndex) => {
      if (!chunk || typeof chunk.content !== "string" || !chunk.content.trim()) {
        throw new Error(`Chunk at index ${startIndex + batchIndex} has invalid content.`);
      }

      return chunk.content;
    });

    const embeddings = await generateEmbeddings(texts);

    const embeddedBatch = batch.map((chunk, batchIndex) => ({
      ...chunk,
      embedding: embeddings[batchIndex],
    }));

    embeddedChunks.push(...embeddedBatch);

    console.log(`Embedded ${embeddedChunks.length} of ${chunks.length} chunks.`);
  }

  return embeddedChunks;
};

module.exports = {
  embedChunks,
};
