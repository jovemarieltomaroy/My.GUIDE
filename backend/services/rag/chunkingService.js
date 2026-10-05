const {
    isReadablePdfText,
} = require("./textCleanerService");

/**
 * Splits cleaned page documents into overlapping,
 * sentence-aware text chunks.
 *
 * Multiple complete sentences are grouped together
 * until the approximate chunk size is reached.
 *
 * The last few sentences of each chunk are repeated
 * in the next chunk to preserve context.
 *
 * Corrupted-looking chunks are skipped before
 * embedding and storage.
 *
 * @param {Array<object>} pageDocuments - Cleaned page documents.
 * @param {object} options - Chunking configuration.
 * @param {number} options.chunkSize - Approximate maximum characters per chunk.
 * @param {number} options.sentenceOverlap - Number of sentences repeated between chunks.
 * @returns {Array<object>}
 */
const chunkDocuments = (
    pageDocuments,
    {
        chunkSize = 1000,
        sentenceOverlap = 2,
    } = {}
) => {
    if (!Array.isArray(pageDocuments)) {
        throw new Error(
            "Page documents must be an array."
        );
    }

    if (
        !Number.isInteger(chunkSize) ||
        chunkSize <= 0
    ) {
        throw new Error(
            "Chunk size must be a positive integer."
        );
    }

    if (
        !Number.isInteger(sentenceOverlap) ||
        sentenceOverlap < 0
    ) {
        throw new Error(
            "Sentence overlap must be a non-negative integer."
        );
    }

    const chunks = [];

    let skippedCorruptedChunks = 0;

    /**
     * Adds a chunk only if it appears readable.
     */
    const addChunk = (
        content,
        document,
        chunkIndex,
        sentenceCount
    ) => {
        const trimmedContent =
            content.trim();

        if (!trimmedContent) {
            return false;
        }

        /*
         * Second-level corruption check.
         *
         * The PDF reader already checks whole pages.
         * This check catches corrupted sections
         * inside otherwise readable pages.
         */
        if (
            !isReadablePdfText(
                trimmedContent
            )
        ) {
            skippedCorruptedChunks += 1;

            console.warn(
                `Skipping corrupted chunk - Page ${
                    document.metadata?.pageNumber ??
                    "Unknown"
                }, Chunk ${chunkIndex}`
            );

            return false;
        }

        chunks.push({
            content:
                trimmedContent,

            metadata: {
                ...document.metadata,

                chunkIndex,

                sentenceCount,

                characterCount:
                    trimmedContent.length,
            },
        });

        return true;
    };

    for (const document of pageDocuments) {
        const text =
            document.pageContent?.trim() ||
            "";

        if (!text) {
            continue;
        }

        /*
         * Split the page into complete sentences.
         */
        const sentences =
            text
                .match(
                    /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g
                )
                ?.map((sentence) =>
                    sentence.trim()
                )
                .filter(Boolean) ||
            [];

        if (sentences.length === 0) {
            continue;
        }

        let currentSentences = [];
        let chunkIndex = 0;

        for (const sentence of sentences) {
            const proposedSentences = [
                ...currentSentences,
                sentence,
            ];

            const proposedContent =
                proposedSentences.join(" ");

            /*
             * When adding the next sentence would
             * exceed the target size, save the
             * current chunk first.
             */
            if (
                currentSentences.length >
                    0 &&
                proposedContent.length >
                    chunkSize
            ) {
                const content =
                    currentSentences
                        .join(" ")
                        .trim();

                addChunk(
                    content,
                    document,
                    chunkIndex,
                    currentSentences.length
                );

                chunkIndex += 1;

                /*
                 * Preserve sentence overlap for
                 * context between neighboring chunks.
                 */
                currentSentences =
                    sentenceOverlap > 0
                        ? currentSentences.slice(
                              -sentenceOverlap
                          )
                        : [];
            }

            currentSentences.push(
                sentence
            );
        }

        /*
         * Save the final chunk for the page.
         */
        if (
            currentSentences.length > 0
        ) {
            const content =
                currentSentences
                    .join(" ")
                    .trim();

            addChunk(
                content,
                document,
                chunkIndex,
                currentSentences.length
            );
        }
    }

    console.log(
        `Readable chunks created: ${chunks.length}`
    );

    if (
        skippedCorruptedChunks > 0
    ) {
        console.warn(
            `Corrupted chunks skipped: ${skippedCorruptedChunks}`
        );
    }

    return chunks;
};

module.exports = {
    chunkDocuments,
};