require("dotenv").config();

const {
    readPdfByPage,
} = require("../services/rag/pdfReaderService");

const {
    chunkDocuments,
} = require("../services/rag/chunkingService");

const {
    filterKnowledgeChunks,
    isTableOfContentsChunk,
    isIndexChunk,
    isPublisherNoiseChunk,
    isLowInformationChunk,
    isFrontMatterChunk,
} = require("../services/rag/knowledgeFilterService");


const runTest = async () => {
    try {
        const pdfPath =
            "./test-files/theory-and-practice-of-counseling-and-psychotherapy-9th-edition.pdf";

        /*
         * ---------------------------------------------
         * 1. READ PDF
         * ---------------------------------------------
         */

        console.log(
            "Reading PDF..."
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
            `Pages read: ${pageDocuments.length}`
        );


        /*
         * ---------------------------------------------
         * 2. CREATE CHUNKS
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
            `Chunks before filtering: ${allChunks.length}`
        );


        /*
         * ---------------------------------------------
         * 3. CHECK WHY CHUNKS WOULD BE REMOVED
         * ---------------------------------------------
         */

        let tableOfContentsCount = 0;
        let indexCount = 0;
        let publisherNoiseCount = 0;
        let lowInformationCount = 0;
        let frontMatterCount = 0;

        allChunks.forEach(
            (chunk) => {
                const content =
                    chunk.content || "";

                if (
                    isTableOfContentsChunk(
                        content
                    )
                ) {
                    tableOfContentsCount++;
                }

                if (
                    isIndexChunk(
                        content
                    )
                ) {
                    indexCount++;
                }

                if (
                    isPublisherNoiseChunk(
                        content
                    )
                ) {
                    publisherNoiseCount++;
                }

                if (
                    isLowInformationChunk(
                        content
                    )
                ) {
                    lowInformationCount++;
                }

                if (
                    isFrontMatterChunk(
                        content
                    )
                ) {
                    frontMatterCount++;
                }
            }
        );


        console.log(
            "\n===== FILTER DETECTION SUMMARY ====="
        );

        console.log(
            `Table of contents chunks detected: ${tableOfContentsCount}`
        );

        console.log(
            `Index chunks detected: ${indexCount}`
        );

        console.log(
            `Publisher-noise chunks detected: ${publisherNoiseCount}`
        );

        console.log(
            `Low-information chunks detected: ${lowInformationCount}`
        );

        console.log(
            `Front-matter chunks detected: ${frontMatterCount}`
        );


        /*
         * ---------------------------------------------
         * 4. FILTER CHUNKS
         * ---------------------------------------------
         */

        const filteredChunks =
            filterKnowledgeChunks(
                allChunks
            );

        const removedChunks =
            allChunks.filter(
                (chunk) =>
                    !filteredChunks.includes(
                        chunk
                    )
            );


        console.log(
            "\n===== FILTERING RESULT ====="
        );

        console.log(
            `Chunks before filtering: ${allChunks.length}`
        );

        console.log(
            `Chunks after filtering: ${filteredChunks.length}`
        );

        console.log(
            `Chunks removed: ${removedChunks.length}`
        );


        /*
         * ---------------------------------------------
         * 5. SHOW FIRST 10 REMOVED CHUNKS
         * ---------------------------------------------
         *
         * We show more than five here because
         * front-matter chunks may span several chunks.
         */

        console.log(
            "\n===== FIRST 10 REMOVED CHUNKS ====="
        );

        removedChunks
            .slice(0, 10)
            .forEach(
                (chunk, index) => {
                    const content =
                        chunk.content || "";

                    console.log(
                        `\n--- REMOVED CHUNK ${index + 1} ---`
                    );

                    console.log(
                        "Page:",
                        chunk.metadata
                            ?.pageNumber
                    );

                    console.log(
                        "Reason(s):"
                    );

                    if (
                        isTableOfContentsChunk(
                            content
                        )
                    ) {
                        console.log(
                            "- Table of contents"
                        );
                    }

                    if (
                        isIndexChunk(
                            content
                        )
                    ) {
                        console.log(
                            "- Index"
                        );
                    }

                    if (
                        isPublisherNoiseChunk(
                            content
                        )
                    ) {
                        console.log(
                            "- Publisher noise"
                        );
                    }

                    if (
                        isLowInformationChunk(
                            content
                        )
                    ) {
                        console.log(
                            "- Low information"
                        );
                    }

                    if (
                        isFrontMatterChunk(
                            content
                        )
                    ) {
                        console.log(
                            "- Front matter"
                        );
                    }

                    console.log(
                        "\nContent:"
                    );

                    console.log(
                        content
                    );
                }
            );


        /*
         * ---------------------------------------------
         * 6. SHOW FIRST 10 KEPT CHUNKS
         * ---------------------------------------------
         *
         * We show more here so we can check whether
         * any author/publication front matter still slips
         * through after the new classifier.
         */

        console.log(
            "\n===== FIRST 10 KEPT CHUNKS ====="
        );

        filteredChunks
            .slice(0, 10)
            .forEach(
                (chunk, index) => {
                    console.log(
                        `\n--- KEPT CHUNK ${index + 1} ---`
                    );

                    console.log(
                        "Page:",
                        chunk.metadata
                            ?.pageNumber
                    );

                    console.log(
                        "Source:",
                        chunk.metadata
                            ?.source
                    );

                    console.log(
                        "Title:",
                        chunk.metadata
                            ?.title
                    );

                    console.log(
                        "Resource Type:",
                        chunk.metadata
                            ?.resourceType
                    );

                    console.log(
                        "Topic:",
                        chunk.metadata
                            ?.topic
                    );

                    console.log(
                        "\nContent:"
                    );

                    console.log(
                        chunk.content
                    );
                }
            );


        /*
         * ---------------------------------------------
         * 7. SHOW MIDDLE SAMPLE CHUNKS
         * ---------------------------------------------
         */

        console.log(
            "\n===== SAMPLE KEPT CHUNKS ====="
        );

        const samplePositions = [
            Math.floor(
                filteredChunks.length *
                    0.25
            ),

            Math.floor(
                filteredChunks.length *
                    0.50
            ),

            Math.floor(
                filteredChunks.length *
                    0.75
            ),
        ];

        samplePositions.forEach(
            (position) => {
                const chunk =
                    filteredChunks[
                        position
                    ];

                if (!chunk) {
                    return;
                }

                console.log(
                    "\n--------------------------------"
                );

                console.log(
                    "Page:",
                    chunk.metadata
                        ?.pageNumber
                );

                console.log(
                    "Source:",
                    chunk.metadata
                        ?.source
                );

                console.log(
                    "\nContent:"
                );

                console.log(
                    chunk.content
                );
            }
        );


        /*
         * ---------------------------------------------
         * 8. CHECK FOR POSSIBLE FRONT-MATTER LEAKAGE
         * ---------------------------------------------
         */

        const suspiciousKeptChunks =
            filteredChunks.filter(
                (chunk) => {
                    const content =
                        (
                            chunk.content ||
                            ""
                        ).toLowerCase();

                    return (
                        content.includes(
                            "about the author"
                        ) ||
                        content.includes(
                            "recent publications by"
                        ) ||
                        content.includes(
                            "received his doctorate"
                        ) ||
                        content.includes(
                            "received her doctorate"
                        ) ||
                        content.includes(
                            "licensed psychologist"
                        ) ||
                        content.includes(
                            "national certified counselor"
                        )
                    );
                }
            );


        console.log(
            "\n===== FRONT-MATTER LEAKAGE CHECK ====="
        );

        console.log(
            `Suspicious kept chunks: ${suspiciousKeptChunks.length}`
        );

        suspiciousKeptChunks
            .slice(0, 5)
            .forEach(
                (chunk, index) => {
                    console.log(
                        `\n--- SUSPICIOUS KEPT CHUNK ${index + 1} ---`
                    );

                    console.log(
                        "Page:",
                        chunk.metadata
                            ?.pageNumber
                    );

                    console.log(
                        "Content:"
                    );

                    console.log(
                        chunk.content
                    );
                }
            );


        /*
         * ---------------------------------------------
         * DONE
         * ---------------------------------------------
         */

        console.log(
            "\nFiltering test completed."
        );

        console.log(
            "No embeddings were generated."
        );

        console.log(
            "Nothing was written to MongoDB."
        );
    } catch (error) {
        console.error(
            "\nFiltering test failed:"
        );

        console.error(
            error.message
        );
    }
};


runTest();