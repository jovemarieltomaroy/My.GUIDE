const Case = require("../models/case");
const fs = require("fs/promises");

const path = require("path");

const KnowledgeResource = require(
    "../models/knowledgeResource"
);

const KnowledgeChunk = require(
    "../models/knowledgeChunk"
);

const {
    ingestKnowledgeResource,
} = require(
    "../services/rag/knowledgeIngestionService"
);


/*
 * ---------------------------------------------
 * UPLOAD + PROCESS KNOWLEDGE RESOURCE
 * ---------------------------------------------
 *
 * Workflow:
 *
 * Upload PDF
 * ↓
 * Create KnowledgeResource
 * ↓
 * Use its MongoDB _id as resourceId
 * ↓
 * Run RAG ingestion
 * ↓
 * Store chunks
 * ↓
 * Update processing status
 */

const uploadKnowledgeResource =
    async (req, res) => {
        let knowledgeResource = null;

        try {
            /*
             * -----------------------------------------
             * 1. VALIDATE FILE
             * -----------------------------------------
             */

            if (!req.file) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "A PDF knowledge resource is required.",
                    });
            }


            /*
             * -----------------------------------------
             * 2. READ FORM DATA
             * -----------------------------------------
             */

            const {
                title,
                resourceType,
                topic,
            } = req.body;


            if (
                !title ||
                !resourceType ||
                !topic
            ) {
                /*
                 * Multer already saved the file.
                 * Remove it when validation fails.
                 */

                try {
                    await fs.unlink(
                        req.file.path
                    );
                } catch (
                    cleanupError
                ) {
                    console.warn(
                        "Unable to remove invalid upload:",
                        cleanupError.message
                    );
                }


                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Title, resource type, and topic are required.",
                    });
            }


            /*
             * -----------------------------------------
             * 3. CREATE RESOURCE RECORD
             * -----------------------------------------
             */

            knowledgeResource =
                await KnowledgeResource.create({
                    title:
                        title.trim(),

                    originalFileName:
                        req.file.originalname,

                    storedFileName:
                        req.file.filename,

                    filePath:
                        req.file.path,

                    mimeType:
                        req.file.mimetype,

                    resourceType:
                        resourceType
                            .trim()
                            .toLowerCase(),

                    topic:
                        topic.trim(),

                    embeddingProvider:
                        process.env
                            .EMBEDDING_PROVIDER ||
                        "ollama",

                    embeddingModel:
                        process.env
                            .OLLAMA_EMBEDDING_MODEL ||
                        "embeddinggemma",

                    processingStatus:
                        "Processing",

                    /*
                     * Assumes your authentication
                     * middleware attaches the current
                     * user to req.user.
                     */
                    uploadedBy:
                        req.user?._id ||
                        req.user?.id ||
                        null,
                });


            /*
             * -----------------------------------------
             * 4. INGEST RESOURCE
             * -----------------------------------------
             */

            const ingestionSummary =
                await ingestKnowledgeResource({
                    filePath:
                        req.file.path,

                    metadata: {
                        source:
                            title.trim(),

                        title:
                            title.trim(),

                        resourceType:
                            resourceType
                                .trim()
                                .toLowerCase(),

                        topic:
                            topic.trim(),

                        approvalStatus:
                            "approved",

                        /*
                         * Critical:
                         *
                         * Every generated chunk gets
                         * the KnowledgeResource ID.
                         */
                        resourceId:
                            knowledgeResource
                                ._id
                                .toString(),

                        originalFilename:
                            req.file
                                .originalname,
                    },

                    store: true,
                });


            /*
             * -----------------------------------------
             * 5. UPDATE RESOURCE STATISTICS
             * -----------------------------------------
             */

            knowledgeResource.totalPages =
                ingestionSummary.pagesRead;

            knowledgeResource.totalChunks =
                ingestionSummary
                    .chunksEmbedded;

            knowledgeResource.processingStatus =
                "Ready";

            knowledgeResource.processingError =
                null;


            await knowledgeResource.save();


            /*
             * -----------------------------------------
             * 6. RESPONSE
             * -----------------------------------------
             */

            return res
                .status(201)
                .json({
                    success: true,

                    message:
                        "Knowledge resource uploaded and processed successfully.",

                    resource:
                        knowledgeResource,

                    ingestion: {
                        pagesRead:
                            ingestionSummary
                                .pagesRead,

                        chunksCreated:
                            ingestionSummary
                                .chunksCreated,

                        chunksKept:
                            ingestionSummary
                                .chunksKept,

                        chunksRemoved:
                            ingestionSummary
                                .chunksRemoved,

                        chunksEmbedded:
                            ingestionSummary
                                .chunksEmbedded,
                    },
                });
        } catch (error) {
            console.error(
                "Knowledge resource processing failed:",
                error
            );


            /*
             * -----------------------------------------
             * MARK RESOURCE AS FAILED
             * -----------------------------------------
             */

            if (knowledgeResource) {
                try {
                    /*
                     * Remove any chunks that may have
                     * been inserted before failure.
                     */

                    await KnowledgeChunk.deleteMany({
                        "metadata.resourceId":
                            knowledgeResource
                                ._id
                                .toString(),
                    });


                    knowledgeResource
                        .processingStatus =
                        "Failed";

                    knowledgeResource
                        .processingError =
                        error.message;


                    await knowledgeResource.save();
                } catch (
                    updateError
                ) {
                    console.error(
                        "Unable to update failed resource:",
                        updateError
                    );
                }
            }


            return res
                .status(500)
                .json({
                    success: false,

                    message:
                        "Knowledge resource could not be processed.",

                    error:
                        error.message,
                });
        }
    };


/*
 * ---------------------------------------------
 * GET ALL KNOWLEDGE RESOURCES
 * ---------------------------------------------
 */

const getKnowledgeResources =
    async (req, res) => {
        try {
            const resources =
                await KnowledgeResource.find({})
                    .populate(
                        "uploadedBy",
                        "firstName lastName email"
                    )
                    .sort({
                        createdAt: -1,
                    });


            return res
                .status(200)
                .json({
                    success: true,

                    count:
                        resources.length,

                    resources,
                });
        } catch (error) {
            console.error(
                "Unable to retrieve knowledge resources:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,

                    message:
                        "Knowledge resources could not be retrieved.",

                    error:
                        error.message,
                });
        }
    };


/*
 * ---------------------------------------------
 * GET ONE KNOWLEDGE RESOURCE
 * ---------------------------------------------
 */

const getKnowledgeResourceById =
    async (req, res) => {
        try {
            const resource =
                await KnowledgeResource.findById(
                    req.params.id
                ).populate(
                    "uploadedBy",
                    "firstName lastName email"
                );


            if (!resource) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Knowledge resource not found.",
                    });
            }


            const chunkCount =
                await KnowledgeChunk.countDocuments({
                    "metadata.resourceId":
                        resource._id.toString(),
                });


            return res
                .status(200)
                .json({
                    success: true,

                    resource,

                    chunkCount,
                });
        } catch (error) {
            console.error(
                "Unable to retrieve knowledge resource:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,

                    message:
                        "Knowledge resource could not be retrieved.",

                    error:
                        error.message,
                });
        }
    };
/*
 * ---------------------------------------------
 * VIEW KNOWLEDGE RESOURCE PDF
 * ---------------------------------------------
 *
 * Streams the original uploaded PDF so that
 * authorized Counselor-Admin users can preview
 * it inside the Knowledge Base interface.
 */

const viewKnowledgeResourcePdf =
    async (req, res) => {
        try {
            const resource =
                await KnowledgeResource.findById(
                    req.params.id
                );

            if (!resource) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Knowledge resource not found.",
                    });
            }

            if (req.user.role !== "Counselor-Admin") {
                const resourceUrl = `/api/knowledge-base/${resource._id}/pdf`;
                const accessibleCase = req.user.role === "Counselor-User" && await Case.exists({
                    isArchived: false,
                    $and: [
                        { $or: [
                            { assignedCounselor: req.user._id },
                            { temporaryCounselor: { $elemMatch: {
                                counselor: req.user._id,
                                isActive: true,
                                revokedAt: null,
                                accessUntil: { $gt: new Date() },
                            } } },
                        ] },
                        { $or: [
                            { "llmRecommendations.resources.url": resourceUrl },
                            { "interventionPlans.resources.url": resourceUrl },
                        ] },
                    ],
                });
                if (!accessibleCase) {
                    return res.status(403).json({ message: "Not authorized to view this resource." });
                }
            }

            if (!resource.filePath) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "No PDF file is associated with this resource.",
                    });
            }

            const absoluteFilePath =
                path.resolve(
                    resource.filePath
                );

            try {
                await fs.access(
                    absoluteFilePath
                );
            } catch {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "The PDF file could not be found on the server.",
                    });
            }

            res.setHeader(
                "Content-Type",
                resource.mimeType ||
                    "application/pdf"
            );

            res.setHeader(
                "Content-Disposition",
                `inline; filename="${encodeURIComponent(
                    resource.originalFileName ||
                        "knowledge-resource.pdf"
                )}"`
            );

            return res.sendFile(
                absoluteFilePath
            );
        } catch (error) {
            console.error(
                "Unable to view knowledge resource PDF:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Knowledge resource PDF could not be retrieved.",
                    error:
                        error.message,
                });
        }
    };

/*
 * ---------------------------------------------
 * DELETE KNOWLEDGE RESOURCE
 * ---------------------------------------------
 *
 * Deletes:
 *
 * KnowledgeResource
 * KnowledgeChunk[]
 * Uploaded PDF
 */

const deleteKnowledgeResource =
    async (req, res) => {
        try {
            const resource =
                await KnowledgeResource.findById(
                    req.params.id
                );


            if (!resource) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Knowledge resource not found.",
                    });
            }


            /*
             * -----------------------------------------
             * DELETE ASSOCIATED CHUNKS
             * -----------------------------------------
             */

            const chunkResult =
                await KnowledgeChunk.deleteMany({
                    "metadata.resourceId":
                        resource._id.toString(),
                });


            /*
             * -----------------------------------------
             * DELETE PDF FILE
             * -----------------------------------------
             */

            if (resource.filePath) {
                try {
                    await fs.unlink(
                        resource.filePath
                    );
                } catch (
                    fileError
                ) {
                    /*
                     * ENOENT simply means the file
                     * no longer exists locally.
                     */

                    if (
                        fileError.code !==
                        "ENOENT"
                    ) {
                        console.warn(
                            "Unable to delete knowledge PDF:",
                            fileError.message
                        );
                    }
                }
            }


            /*
             * -----------------------------------------
             * DELETE RESOURCE RECORD
             * -----------------------------------------
             */

            await resource.deleteOne();


            return res
                .status(200)
                .json({
                    success: true,

                    message:
                        "Knowledge resource deleted successfully.",

                    chunksDeleted:
                        chunkResult.deletedCount,
                });
        } catch (error) {
            console.error(
                "Unable to delete knowledge resource:",
                error
            );


            return res
                .status(500)
                .json({
                    success: false,

                    message:
                        "Knowledge resource could not be deleted.",

                    error:
                        error.message,
                });
        }
    };


module.exports = {
    uploadKnowledgeResource,
    getKnowledgeResources,
    getKnowledgeResourceById,
    viewKnowledgeResourcePdf,
    deleteKnowledgeResource,
};