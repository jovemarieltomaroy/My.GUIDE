const fs = require(
    "fs"
);

const path = require(
    "path"
);

const {
    readPdfByPage,
} = require(
    "./pdfReaderService"
);

const {
    chunkDocuments,
} = require(
    "./chunkingService"
);

const {
    filterKnowledgeChunks,
} = require(
    "./knowledgeFilterService"
);

const {
    embedChunks,
} = require(
    "./chunkEmbeddingService"
);

const {
    storeEmbeddedChunks,
} = require(
    "./vectorStoreService"
);


/**
 * Validates metadata supplied for
 * one knowledge resource.
 *
 * @param {object} metadata
 */
const validateMetadata = (
    metadata
) => {
    if (
        !metadata ||
        typeof metadata !==
            "object"
    ) {
        throw new Error(
            "Resource metadata is required."
        );
    }

    if (
        !metadata.title ||
        typeof metadata.title !==
            "string"
    ) {
        throw new Error(
            "Resource title is required."
        );
    }

    if (
        !metadata.source ||
        typeof metadata.source !==
            "string"
    ) {
        throw new Error(
            "Resource source is required."
        );
    }

    if (
        !metadata.resourceType ||
        typeof metadata.resourceType !==
            "string"
    ) {
        throw new Error(
            "Resource type is required."
        );
    }

    if (
        !metadata.topic ||
        typeof metadata.topic !==
            "string"
    ) {
        throw new Error(
            "Resource topic is required."
        );
    }
};


/**
 * Normalizes metadata before attaching
 * it to pages and chunks.
 *
 * @param {object} metadata
 * @param {string} resolvedPath
 *
 * @returns {object}
 */
const normalizeMetadata = (
    metadata,
    resolvedPath
) => {
    /*
     * Convert absolute local path into a
     * backend-relative path.
     *
     * Example:
     *
     * test-files/worksheets/
     * calm-down-skills-practice.pdf
     */
    const relativeFilePath =
        path.relative(
            process.cwd(),
            resolvedPath
        );


    return {
        source:
            metadata.source.trim(),

        title:
            metadata.title.trim(),

        resourceType:
            metadata.resourceType
                .trim()
                .toLowerCase(),

        topic:
            metadata.topic.trim(),

        approvalStatus:
            metadata.approvalStatus
                ?.trim()
                .toLowerCase() ||
            "unspecified",

        resourceId:
            metadata.resourceId
                ?.trim() ||
            null,

        originalFilename:
            metadata.originalFilename
                ?.trim() ||
            path.basename(
                resolvedPath
            ),

        relativeFilePath,
    };
};


/**
 * Ingests one PDF knowledge resource.
 *
 * Pipeline:
 *
 * PDF
 * ↓
 * read + clean
 * ↓
 * chunk
 * ↓
 * filter
 * ↓
 * embed
 * ↓
 * store
 *
 * @param {object} options
 * @param {string} options.filePath
 * @param {object} options.metadata
 * @param {boolean} options.store
 *
 * @returns {Promise<object>}
 */
const ingestKnowledgeResource =
    async ({
        filePath,
        metadata,
        store = true,
    }) => {
        /*
         * ---------------------------------------------
         * 1. VALIDATE FILE
         * ---------------------------------------------
         */

        if (
            !filePath ||
            typeof filePath !==
                "string"
        ) {
            throw new Error(
                "A PDF file path is required."
            );
        }


        const resolvedPath =
            path.resolve(
                filePath
            );


        if (
            !fs.existsSync(
                resolvedPath
            )
        ) {
            throw new Error(
                `PDF file not found: ${resolvedPath}`
            );
        }


        if (
            path.extname(
                resolvedPath
            ).toLowerCase() !==
            ".pdf"
        ) {
            throw new Error(
                "Knowledge resource must be a PDF file."
            );
        }


        /*
         * ---------------------------------------------
         * 2. VALIDATE METADATA
         * ---------------------------------------------
         */

        validateMetadata(
            metadata
        );


        /*
         * ---------------------------------------------
         * 3. NORMALIZE METADATA
         * ---------------------------------------------
         */

        const normalizedMetadata =
            normalizeMetadata(
                metadata,
                resolvedPath
            );


        console.log(
            "\n=========================================="
        );

        console.log(
            `Ingesting: ${normalizedMetadata.title}`
        );

        console.log(
            `Resource Type: ${normalizedMetadata.resourceType}`
        );

        console.log(
            `Topic: ${normalizedMetadata.topic}`
        );

        console.log(
            `Approval Status: ${normalizedMetadata.approvalStatus}`
        );

        console.log(
            `Resource ID: ${
                normalizedMetadata.resourceId ||
                "None"
            }`
        );

        console.log(
            `Original Filename: ${normalizedMetadata.originalFilename}`
        );

        console.log(
            `Relative File Path: ${normalizedMetadata.relativeFilePath}`
        );

        console.log(
            "=========================================="
        );


        /*
         * ---------------------------------------------
         * 4. READ + CLEAN PDF
         * ---------------------------------------------
         */

        console.log(
            "\nReading PDF..."
        );


        const pageDocuments =
            await readPdfByPage(
                resolvedPath,
                normalizedMetadata
            );


        console.log(
            `Readable pages: ${pageDocuments.length}`
        );


        if (
            pageDocuments.length ===
            0
        ) {
            throw new Error(
                "No readable content was extracted from the PDF."
            );
        }


        /*
         * ---------------------------------------------
         * 5. CREATE CHUNKS
         * ---------------------------------------------
         */

        console.log(
            "\nCreating chunks..."
        );


        const chunks =
            chunkDocuments(
                pageDocuments
            );


        console.log(
            `Chunks created: ${chunks.length}`
        );


        if (
            chunks.length ===
            0
        ) {
            throw new Error(
                "No chunks were created from the PDF."
            );
        }


        /*
         * ---------------------------------------------
         * 6. FILTER CHUNKS
         * ---------------------------------------------
         */

        console.log(
            "\nFiltering chunks..."
        );


        const filteredChunks =
            filterKnowledgeChunks(
                chunks
            );


        console.log(
            `Chunks after filtering: ${filteredChunks.length}`
        );

        console.log(
            `Chunks removed: ${
                chunks.length -
                filteredChunks.length
            }`
        );


        if (
            filteredChunks.length ===
            0
        ) {
            throw new Error(
                "All chunks were removed during knowledge filtering."
            );
        }


        /*
         * ---------------------------------------------
         * 7. EMBED CHUNKS
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
            `Embedded chunks: ${embeddedChunks.length}`
        );


        if (
            embeddedChunks.length ===
            0
        ) {
            throw new Error(
                "No embeddings were generated."
            );
        }


        /*
         * ---------------------------------------------
         * 8. STORE CHUNKS
         * ---------------------------------------------
         */

        if (
            store
        ) {
            console.log(
                "\nStoring embedded chunks in MongoDB..."
            );


            await storeEmbeddedChunks(
                embeddedChunks
            );


            console.log(
                `Stored ${embeddedChunks.length} chunks in MongoDB.`
            );
        } else {
            console.log(
                "\nStore disabled."
            );

            console.log(
                "Nothing was written to MongoDB."
            );
        }


        /*
         * ---------------------------------------------
         * 9. RETURN SUMMARY
         * ---------------------------------------------
         */

        return {
            filePath:
                resolvedPath,

            metadata:
                normalizedMetadata,

            pagesRead:
                pageDocuments.length,

            chunksCreated:
                chunks.length,

            chunksKept:
                filteredChunks.length,

            chunksRemoved:
                chunks.length -
                filteredChunks.length,

            chunksEmbedded:
                embeddedChunks.length,

            stored:
                store,
        };
    };


module.exports = {
    ingestKnowledgeResource,
};