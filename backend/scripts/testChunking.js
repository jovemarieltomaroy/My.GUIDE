const path = require("path");

const {
    readPdfByPage,
} = require("../services/rag/pdfReaderService");

const {
    chunkDocuments,
} = require("../services/rag/chunkingService");

const testChunking = async () => {
    try {
        const pdfPath = path.join(
            __dirname,
            "../test-files/theory-and-practice-of-counseling-and-psychotherapy-9th-edition.pdf"
        );

        const pageDocuments = await readPdfByPage(pdfPath, {
            title: "Introduction and Overview",
            resourceType: "Counseling Textbook",
            category: "Counseling Theories",
        });

        const chunks = chunkDocuments(pageDocuments, {
            chunkSize: 1000,
            sentenceOverlap: 2,
        });

        console.log("Chunking completed.");
        console.log(`Pages processed: ${pageDocuments.length}`);
        console.log(`Chunks created: ${chunks.length}`);

        // Show only the first 5 chunks for easier checking.
        const chunksToShow = chunks.slice(0, 5);

        for (const chunk of chunksToShow) {
            console.log("\n====================================");

            console.log(
                `Page ${chunk.metadata.pageNumber} | Chunk ${chunk.metadata.chunkIndex}`
            );

            console.log(
                `Sentences: ${chunk.metadata.sentenceCount}`
            );

            console.log(
                `Characters: ${chunk.metadata.characterCount}`
            );

            console.log("------------------------------------");
            console.log(chunk.content);
        }
    } catch (error) {
        console.error("Chunking test failed:");
        console.error(error.message);
        process.exitCode = 1;
    }
};

testChunking();