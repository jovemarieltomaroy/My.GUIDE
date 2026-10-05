require("dotenv").config();

const mongoose = require("mongoose");

const {
    readPdfByPage,
} = require("../services/rag/pdfReaderService");

const {
    chunkDocuments,
} = require("../services/rag/chunkingService");

const {
    filterKnowledgeChunks,
} = require("../services/rag/knowledgeFilterService");

const {
    embedChunks,
} = require("../services/rag/chunkEmbeddingService");

const {
    storeEmbeddedChunks,
} = require("../services/rag/vectorStoreService");


const runTest = async () => {
    try {

        console.log(
            "Connecting to MongoDB..."
        );

        await mongoose.connect(
            process.env.MONGO_URI
        );

        console.log(
            "MongoDB connected."
        );


        const pdfPath =
            "./test-files/theory-and-practice-of-counseling-and-psychotherapy-9th-edition.pdf";

        console.log(
            "\nReading PDF..."
        );

        const pageDocuments =
            await readPdfByPage(
                pdfPath,
                {
                    source:
                        "Theory and Practice of Counseling and Psychotherapy",

                    title:
                        "Theory and Practice of Counseling and Psychotherapy",

                    resourceType:
                        "reference",

                    topic:
                        "Counseling Theories and Interventions",
                }
            );

        console.log(
            `Read ${pageDocuments.length} pages.`
        );


        /*
         * ---------------------------------------------
         * 3. CREATE CHUNKS
         * ---------------------------------------------
         */

        console.log(
            "\nCreating chunks..."
        );

        const allChunks =
            chunkDocuments(
                pageDocuments
            );

        console.log(
            `Created ${allChunks.length} chunks before filtering.`
        );


        /*
         * ---------------------------------------------
         * 4. FILTER LOW-VALUE CHUNKS
         * ---------------------------------------------
         */

        console.log(
            "\nFiltering low-value chunks..."
        );

        const filteredChunks =
            filterKnowledgeChunks(
                allChunks
            );

        const removedCount =
            allChunks.length -
            filteredChunks.length;

        console.log(
            `Removed ${removedCount} low-value chunks.`
        );

        console.log(
            `${filteredChunks.length} chunks will be embedded.`
        );


        /*
         * Safety check.
         */
        if (
            filteredChunks.length === 0
        ) {
            throw new Error(
                "No chunks remained after filtering."
            );
        }


        /*
         * ---------------------------------------------
         * 5. GENERATE EMBEDDINGS
         * ---------------------------------------------
         */

        console.log(
            "\nGenerating embeddings..."
        );

        const embeddedChunks =
            await embedChunks(
                filteredChunks
            );

        console.log(
            `Generated embeddings for ${embeddedChunks.length} chunks.`
        );

        if (
            embeddedChunks.length > 0
        ) {
            console.log(
                `Embedding dimensions: ${embeddedChunks[0].embedding.length}`
            );
        }


        /*
         * ---------------------------------------------
         * 6. STORE IN MONGODB
         * ---------------------------------------------
         */

        console.log(
            "\nStoring chunks in MongoDB..."
        );

        const storedChunks =
            await storeEmbeddedChunks(
                embeddedChunks
            );

        console.log(
            `Stored ${storedChunks.length} chunks successfully.`
        );


        /*
         * ---------------------------------------------
         * DONE
         * ---------------------------------------------
         */

        console.log(
            "\nVector store ingestion completed successfully."
        );
    } catch (error) {
        console.error(
            "\nVector store ingestion failed:"
        );

        console.error(
            error.message
        );
    } finally {
        await mongoose.disconnect();

        console.log(
            "MongoDB disconnected."
        );
    }
};


runTest();