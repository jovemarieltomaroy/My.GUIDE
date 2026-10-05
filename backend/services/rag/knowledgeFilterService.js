/**
 * Checks whether a chunk looks like a table of contents.
 *
 * Uses content patterns rather than fixed page numbers.
 */
const isTableOfContentsChunk = (
    content
) => {
    if (
        !content ||
        typeof content !== "string"
    ) {
        return false;
    }

    const text =
        content.trim();

    const lower =
        text.toLowerCase();

    const tocKeywords = [
        "contents",
        "table of contents",
        "chapter",
        "introduction",
        "summary and evaluation",
        "where to go from here",
        "recommended supplementary readings",
        "references and suggested readings",
    ];

    const keywordMatches =
        tocKeywords.filter(
            (keyword) =>
                lower.includes(
                    keyword
                )
        ).length;

    const pageNumberReferences =
        (
            text.match(
                /\b\d{1,3}\b/g
            ) || []
        ).length;

    return (
        keywordMatches >= 4 &&
        pageNumberReferences >= 8
    );
};


/**
 * Checks whether a chunk looks like an index.
 */
const isIndexChunk = (
    content
) => {
    if (
        !content ||
        typeof content !== "string"
    ) {
        return false;
    }

    const text =
        content.trim();

    const lower =
        text.toLowerCase();

    /*
     * Strong explicit index headings.
     */
    if (
        lower.startsWith(
            "name index"
        ) ||
        lower.startsWith(
            "subject index"
        ) ||
        lower.startsWith(
            "author index"
        )
    ) {
        return true;
    }

    /*
     * Indexes usually have many page references
     * and very little normal sentence prose.
     */
    const pageReferences =
        (
            text.match(
                /\b\d{1,3}(?:[–-]\d{1,3})?\b/g
            ) || []
        ).length;

    const sentences =
        (
            text.match(
                /[.!?](?:\s|$)/g
            ) || []
        ).length;

    return (
        pageReferences >= 15 &&
        sentences <= 2
    );
};


/**
 * Checks whether a chunk contains publisher
 * or production-related noise.
 */
const isPublisherNoiseChunk = (
    content
) => {
    if (
        !content ||
        typeof content !== "string"
    ) {
        return false;
    }

    const lower =
        content.toLowerCase();

    const noisePatterns = [
        "all rights reserved",
        "electronic rights",
        "third party content may be suppressed",
        "may not be copied, scanned, or duplicated",
        "publisher reserves the right",
        "cengage learning reserves the right",
    ];

    const matches =
        noisePatterns.filter(
            (pattern) =>
                lower.includes(
                    pattern
                )
        ).length;

    /*
     * Production marker such as:
     *
     * .indd
     * . indd
     */
    const hasInddMarker =
        /\.\s*indd\b/i.test(
            content
        );

    /*
     * The production marker by itself is not enough
     * to classify a substantive chunk as publisher noise.
     */
    return (
        matches >= 2 ||
        (
            matches >= 1 &&
            hasInddMarker
        )
    );
};


/**
 * Checks whether a chunk looks like document front matter.
 *
 * Examples:
 * - title / edition pages
 * - author biography
 * - recent publication lists
 * - dedication pages
 * - preface
 * - acknowledgments
 * - "what's new in this edition"
 *
 * The rules are based on text content rather than
 * fixed PDF page numbers.
 */
const isFrontMatterChunk = (
    content
) => {
    if (
        !content ||
        typeof content !== "string"
    ) {
        return false;
    }

    const text =
        content.trim();

    const lower =
        text.toLowerCase();


    /*
     * ---------------------------------------------
     * PRODUCTION MARKERS
     * ---------------------------------------------
     *
     * Handles variations such as:
     *
     * 28549_FM_rev01.indd
     * 28549_FM_rev01. indd
     * FM_rev01
     */

    const hasProductionMarker =
        /\.\s*indd\b/i.test(
            text
        ) ||
        /\bFM_[A-Za-z0-9_-]+/i.test(
            text
        );


    /*
     * ---------------------------------------------
     * EXPLICIT AUTHOR HEADINGS
     * ---------------------------------------------
     */

    if (
        lower.startsWith(
            "about the author"
        ) ||
        lower.startsWith(
            "about the authors"
        )
    ) {
        return true;
    }


    /*
     * ---------------------------------------------
     * PREFACE
     * ---------------------------------------------
     *
     * Handles:
     *
     * PREFACE
     * P R E F A C E
     */

    const hasPrefaceHeading =
        /\bP\s*R\s*E\s*F\s*A\s*C\s*E\b/i.test(
            text
        );

    /*
     * An explicit preface heading is sufficiently
     * strong evidence on its own.
     */
    if (
        hasPrefaceHeading
    ) {
        return true;
    }


    /*
     * ---------------------------------------------
     * RECENT PUBLICATIONS
     * ---------------------------------------------
     *
     * Handles both:
     *
     * recent publications by
     *
     * and PDF extraction artifacts such as:
     *
     * r ecent publications by
     */

    const hasRecentPublicationsHeading =
        /\br\s*e\s*c\s*e\s*n\s*t\s+publications\s+by\b/i.test(
            text
        );

    if (
        hasRecentPublicationsHeading
    ) {
        return true;
    }


    /*
     * ---------------------------------------------
     * WHAT'S NEW IN THIS EDITION
     * ---------------------------------------------
     *
     * Handles:
     *
     * what's new in this edition
     * what’s new in this edition
     *
     * and spaced extraction:
     *
     * w h a t ' s n e w i n ...
     */

    const compactLetters =
        lower.replace(
            /\s+/g,
            ""
        );

    const hasWhatsNewHeading =
        compactLetters.includes(
            "what'snewinthisedition"
        ) ||
        compactLetters.includes(
            "what’snewinthisedition"
        );

    if (
        hasWhatsNewHeading
    ) {
        return true;
    }


    /*
     * ---------------------------------------------
     * ACKNOWLEDGMENTS
     * ---------------------------------------------
     */

    const hasAcknowledgmentsHeading =
        /\bA\s*C\s*K\s*N\s*O\s*W\s*L\s*E\s*D\s*G\s*M\s*E\s*N\s*T\s*S\b/i.test(
            text
        ) ||
        /\bA\s*C\s*K\s*N\s*O\s*W\s*L\s*E\s*D\s*G\s*E\s*M\s*E\s*N\s*T\s*S\b/i.test(
            text
        );

    if (
        hasAcknowledgmentsHeading &&
        hasProductionMarker
    ) {
        return true;
    }


    /*
     * ---------------------------------------------
     * DEDICATION
     * ---------------------------------------------
     */

    const dedicationPatterns = [
        "in memory of",
        "dedicated to",
        "this book is dedicated to",
        "to my wife",
        "to my husband",
        "to our families",
        "to our children",
    ];

    const dedicationMatches =
        dedicationPatterns.filter(
            (pattern) =>
                lower.includes(
                    pattern
                )
        ).length;

    /*
     * Require a production marker because
     * "in memory of" could theoretically occur
     * inside substantive counseling content.
     */
    if (
        dedicationMatches >= 1 &&
        hasProductionMarker
    ) {
        return true;
    }


    /*
     * ---------------------------------------------
     * AUTHOR-BIOGRAPHY SIGNALS
     * ---------------------------------------------
     */

    const biographyPatterns = [
        "professor",
        "received his doctorate",
        "received her doctorate",
        "licensed psychologist",
        "licensed counselor",
        "national certified counselor",
        "fellow of the",
        "is the author",
        "is the coauthor",
        "author or coauthor",
        "recipient of the",
        "teaches undergraduate",
        "teaches graduate",
        "conducted group counseling training workshops",
        "professional conferences",
        "workshops for mental health professionals",
        "memberships in the",
        "published by the",
        "educational dvd",
        "video programs",
    ];

    const biographyMatches =
        biographyPatterns.filter(
            (pattern) =>
                lower.includes(
                    pattern
                )
        ).length;


    /*
     * Multiple biography signals strongly suggest
     * document-level author information.
     */
    if (
        biographyMatches >= 2
    ) {
        return true;
    }


    /*
     * One biography signal plus a front-matter
     * production marker also suggests front matter.
     *
     * This still allows short theorist biographies
     * inside normal chapters when they have no
     * front-matter production marker.
     */
    if (
        biographyMatches >= 1 &&
        hasProductionMarker
    ) {
        return true;
    }


    /*
     * ---------------------------------------------
     * TITLE / EDITION PAGE SIGNALS
     * ---------------------------------------------
     */

    const titlePagePatterns = [
        "theory and practice of",
        "ninth edition",
        "eighth edition",
        "tenth edition",
        "diplomate",
        "american board of professional psychology",
    ];

    const titlePageMatches =
        titlePagePatterns.filter(
            (pattern) =>
                lower.includes(
                    pattern
                )
        ).length;

    if (
        titlePageMatches >= 2
    ) {
        return true;
    }

    if (
        titlePageMatches >= 1 &&
        hasProductionMarker
    ) {
        return true;
    }


    /*
     * ---------------------------------------------
     * PUBLICATION METADATA
     * ---------------------------------------------
     */

    const publicationPatterns = [
        "isbn",
        "copyright",
        "printed in",
        "all rights reserved",
        "library of congress",
    ];

    const publicationMatches =
        publicationPatterns.filter(
            (pattern) =>
                lower.includes(
                    pattern
                )
        ).length;

    if (
        publicationMatches >= 2
    ) {
        return true;
    }

    if (
        publicationMatches >= 1 &&
        hasProductionMarker
    ) {
        return true;
    }


    return false;
};


/**
 * Checks whether a chunk contains too little
 * information for useful semantic retrieval.
 */
const isLowInformationChunk = (
    content
) => {
    if (
        !content ||
        typeof content !== "string"
    ) {
        return true;
    }

    const text =
        content.trim();

    if (
        text.length < 120
    ) {
        return true;
    }

    const words =
        text
            .split(/\s+/)
            .filter(Boolean);

    return (
        words.length < 20
    );
};


/**
 * Main filtering decision.
 *
 * true  -> retain for embedding
 * false -> exclude before embedding
 */
const isUsefulKnowledgeChunk = (
    chunk
) => {
    if (
        !chunk ||
        !chunk.content
    ) {
        return false;
    }

    const content =
        chunk.content.trim();

    if (
        isLowInformationChunk(
            content
        )
    ) {
        return false;
    }

    if (
        isPublisherNoiseChunk(
            content
        )
    ) {
        return false;
    }

    if (
        isFrontMatterChunk(
            content
        )
    ) {
        return false;
    }

    if (
        isTableOfContentsChunk(
            content
        )
    ) {
        return false;
    }

    if (
        isIndexChunk(
            content
        )
    ) {
        return false;
    }

    return true;
};


/**
 * Filters an array of chunks.
 *
 * The original PDF and original chunks
 * are not modified.
 */
const filterKnowledgeChunks = (
    chunks
) => {
    if (
        !Array.isArray(
            chunks
        )
    ) {
        return [];
    }

    return chunks.filter(
        isUsefulKnowledgeChunk
    );
};


module.exports = {
    isTableOfContentsChunk,
    isIndexChunk,
    isPublisherNoiseChunk,
    isFrontMatterChunk,
    isLowInformationChunk,
    isUsefulKnowledgeChunk,
    filterKnowledgeChunks,
};