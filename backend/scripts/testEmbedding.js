require("dotenv").config();

const { generateEmbedding, generateEmbeddings } = require("../services/rag/embeddingService");

/**
 * Calculates cosine similarity between two vectors.
 *
 * @param {number[]} vectorA
 * @param {number[]} vectorB
 * @returns {number}
 */
const cosineSimilarity = (vectorA, vectorB) => {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB) || vectorA.length !== vectorB.length) {
    throw new Error("Vectors must be arrays with the same dimensions.");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < vectorA.length; index += 1) {
    dotProduct += vectorA[index] * vectorB[index];

    magnitudeA += vectorA[index] ** 2;

    magnitudeB += vectorB[index] ** 2;
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
};

/**
 * Tests generating one embedding.
 */
const testSingleEmbedding = async () => {
  const sampleText =
    "Counselors may use mindfulness exercises to help clients manage anxious thoughts.";

  const embedding = await generateEmbedding(sampleText);

  console.log("\nSingle embedding test");
  console.log(`Dimensions: ${embedding.length}`);

  if (embedding.length !== 768) {
    throw new Error(`Expected 768 dimensions but received ${embedding.length}.`);
  }

  console.log("First 10 values:");
  console.log(embedding.slice(0, 10));
};

/**
 * Tests whether semantically related texts receive
 * a higher similarity score than unrelated texts.
 */
const testSemanticSimilarity = async () => {
  const texts = [
    "Mindfulness exercises may help clients manage anxious thoughts.",
    "Present-moment awareness can be practiced during periods of anxiety.",
    "MongoDB stores application data in collections.",
  ];

  const embeddings = await generateEmbeddings(texts);

  const relatedSimilarity = cosineSimilarity(embeddings[0], embeddings[1]);

  const unrelatedSimilarity = cosineSimilarity(embeddings[0], embeddings[2]);

  console.log("\nSemantic similarity test");

  console.log(`Related similarity: ${relatedSimilarity}`);

  console.log(`Unrelated similarity: ${unrelatedSimilarity}`);

  console.log(`Related score is higher: ${relatedSimilarity > unrelatedSimilarity}`);

  if (relatedSimilarity <= unrelatedSimilarity) {
    throw new Error("Semantic similarity test failed.");
  }
};

const runEmbeddingTests = async () => {
  try {
    await testSingleEmbedding();
    await testSemanticSimilarity();

    console.log("\nEmbedding tests completed successfully.");
  } catch (error) {
    console.error("\nEmbedding test failed:");
    console.error(error.message);
    process.exitCode = 1;
  }
};

runEmbeddingTests();
