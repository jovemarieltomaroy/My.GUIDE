const EMBEDDING_PROVIDER = (process.env.EMBEDDING_PROVIDER || "ollama").trim().toLowerCase();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "embeddinggemma";

/**
 * Validates the environment configuration required by
 * the selected embedding provider.
 *
 * @returns {void}
 */
const validateEmbeddingConfiguration = () => {
  switch (EMBEDDING_PROVIDER) {
    case "ollama":
      if (!OLLAMA_BASE_URL) {
        throw new Error("OLLAMA_BASE_URL is missing from the environment variables.");
      }

      if (!OLLAMA_EMBEDDING_MODEL) {
        throw new Error("OLLAMA_EMBEDDING_MODEL is missing from the environment variables.");
      }

      break;

    default:
      throw new Error(`Unsupported embedding provider: ${EMBEDDING_PROVIDER}`);
  }
};

/**
 * Validates and normalizes text values before embedding.
 *
 * @param {string[]} texts - Raw text values to normalize.
 * @returns {string[]}
 */
const normalizeEmbeddingTexts = (texts) => {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error("At least one text value is required.");
  }

  return texts.map((text, index) => {
    if (typeof text !== "string" || !text.trim()) {
      throw new Error(`Text at index ${index} is empty or invalid.`);
    }

    return text.replace(/\s+/g, " ").trim();
  });
};

/**
 * Generates embeddings using Ollama.
 *
 * @param {string[]} texts - Normalized text values.
 * @returns {Promise<number[][]>}
 */
const generateOllamaEmbeddings = async (texts) => {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      model: OLLAMA_EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`Ollama embedding request failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.embeddings)) {
    throw new Error("Ollama returned an invalid embedding response.");
  }

  return data.embeddings;
};

/**
 * Validates embeddings returned by the active provider.
 *
 * @param {number[][]} embeddings - Provider results.
 * @param {number} expectedCount - Expected result count.
 * @returns {void}
 */
const validateEmbeddingResults = (embeddings, expectedCount) => {
  if (!Array.isArray(embeddings) || embeddings.length !== expectedCount) {
    throw new Error("The embedding provider returned an incomplete number of results.");
  }

  const invalidEmbeddingIndex = embeddings.findIndex(
    (embedding) =>
      !Array.isArray(embedding) ||
      embedding.length === 0 ||
      embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))
  );

  if (invalidEmbeddingIndex !== -1) {
    throw new Error(`The embedding at index ${invalidEmbeddingIndex} is invalid.`);
  }

  const expectedDimensions = embeddings[0].length;

  const hasInconsistentDimensions = embeddings.some(
    (embedding) => embedding.length !== expectedDimensions
  );

  if (hasInconsistentDimensions) {
    throw new Error("The embedding provider returned vectors with inconsistent dimensions.");
  }
};

/**
 * Generates embeddings for multiple text values.
 *
 * @param {string[]} texts - Text values to embed.
 * @returns {Promise<number[][]>}
 */
const generateEmbeddings = async (texts) => {
  validateEmbeddingConfiguration();

  const normalizedTexts = normalizeEmbeddingTexts(texts);

  let embeddings;

  switch (EMBEDDING_PROVIDER) {
    case "ollama":
      embeddings = await generateOllamaEmbeddings(normalizedTexts);
      break;

    default:
      throw new Error(`Unsupported embedding provider: ${EMBEDDING_PROVIDER}`);
  }

  validateEmbeddingResults(embeddings, normalizedTexts.length);

  return embeddings;
};

/**
 * Generates an embedding for one text value.
 *
 * @param {string} text - Text to embed.
 * @returns {Promise<number[]>}
 */
const generateEmbedding = async (text) => {
  const embeddings = await generateEmbeddings([text]);

  return embeddings[0];
};

module.exports = {
  generateEmbedding,
  generateEmbeddings,
};
