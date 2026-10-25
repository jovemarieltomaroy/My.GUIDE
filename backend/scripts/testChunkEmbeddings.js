require("dotenv").config();

const path = require("path");

const { readPdfByPage } = require("../services/rag/pdfReaderService");

const { chunkDocuments } = require("../services/rag/chunkingService");

const { embedChunks } = require("../services/rag/chunkEmbeddingService");

const testChunkEmbeddings = async () => {
  try {
    const pdfPath = path.join(__dirname, "../test-files/introduction-and-overview.pdf");

    const pageDocuments = await readPdfByPage(pdfPath, {
      title: "Introduction and Overview",
      resourceType: "Counseling Textbook",
      category: "Counseling Theories",
    });

    const chunks = chunkDocuments(pageDocuments, {
      chunkSize: 1000,
      chunkOverlap: 150,
    });

    console.log(`Chunks created: ${chunks.length}`);

    const testChunks = chunks;

    const embeddedChunks = await embedChunks(testChunks, {
      batchSize: 25,
    });

    console.log("\nChunk embeddings generated successfully.");

    console.log(`Total embedded chunks: ${embeddedChunks.length}`);

    console.log(`Embedding dimensions: ${embeddedChunks[0].embedding.length}`);

    console.log("\nFirst embedded chunk:");

    console.log({
      pageNumber: embeddedChunks[0].metadata.pageNumber,

      chunkIndex: embeddedChunks[0].metadata.chunkIndex,

      contentPreview: embeddedChunks[0].content.slice(0, 150),

      embeddingDimensions: embeddedChunks[0].embedding.length,

      embeddingPreview: embeddedChunks[0].embedding.slice(0, 5),
    });

    const lastChunk = embeddedChunks[embeddedChunks.length - 1];

    console.log("\nLast embedded chunk:");

    console.log({
      pageNumber: lastChunk.metadata.pageNumber,

      chunkIndex: lastChunk.metadata.chunkIndex,

      contentPreview: lastChunk.content.slice(0, 150),

      embeddingDimensions: lastChunk.embedding.length,

      embeddingPreview: lastChunk.embedding.slice(0, 5),
    });
  } catch (error) {
    console.error("\nChunk embedding test failed:");

    console.error(error.message);
    process.exitCode = 1;
  }
};

testChunkEmbeddings();
