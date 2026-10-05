const KnowledgeChunk = require(
    "../../models/knowledgeChunk"
);


/**
 * Stores embedded knowledge chunks
 * in MongoDB.
 *
 * @param {Array<object>} embeddedChunks
 *
 * @returns {Promise<Array<object>>}
 */
const storeEmbeddedChunks =
    async (
        embeddedChunks
    ) => {
        if (
            !Array.isArray(
                embeddedChunks
            )
        ) {
            throw new Error(
                "Embedded chunks must be provided as an array."
            );
        }


        if (
            embeddedChunks.length ===
            0
        ) {
            throw new Error(
                "No embedded chunks were provided for storage."
            );
        }


        /*
         * Preserve the complete metadata object.
         *
         * This is important because metadata may
         * contain information such as:
         *
         * source
         * title
         * resourceType
         * topic
         * approvalStatus
         * resourceId
         * originalFilename
         * relativeFilePath
         * pageNumber
         * chunkIndex
         * character positions
         */
        const documents =
            embeddedChunks.map(
                (
                    chunk
                ) => {
                    return {
                        content:
                            chunk.content,

                        embedding:
                            chunk.embedding,

                        metadata: {
                            ...chunk.metadata,
                        },
                    };
                }
            );


        const storedChunks =
            await KnowledgeChunk.insertMany(
                documents
            );


        return storedChunks;
    };


module.exports = {
    storeEmbeddedChunks,
};