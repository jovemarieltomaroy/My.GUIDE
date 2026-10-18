const { isStudentMaterial } = require('../services/resourceEligibility');
const { readMetadata, review, activateReplacement, fail, mongoose } = require('../services/resourceLifecycle');
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
        let replacedResource = null;

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


            const metadata = readMetadata(req.body);
            if (req.params.id) {
                if (!mongoose.isValidObjectId(req.params.id)) throw fail('Resource not found.', 404);
                replacedResource = await KnowledgeResource.findById(req.params.id);
                if (!replacedResource) throw fail('Resource not found.', 404);
                if (replacedResource.isActive === false) throw fail('Disabled resources cannot be replaced. Review the existing access restriction first.', 409);
                if (replacedResource.processingStatus === 'Processing' || replacedResource.replacementPending || replacedResource.replacedBy) throw fail('This resource is already being processed or replaced.', 409);
                if (metadata.resourceType !== replacedResource.resourceType) throw fail('A replacement must keep the original resource type.');
                if (metadata.status !== 'Active') throw fail('Select Active to approve the replacement after processing.');
            }

            /*
             * -----------------------------------------
             * 3. CREATE RESOURCE RECORD
             * -----------------------------------------
             */

            knowledgeResource =
                await KnowledgeResource.create({
                    ...metadata,
                    status: replacedResource ? 'Under Review' : (metadata.status || 'Active'),
                    replaces: replacedResource?._id || null,
                    statusHistory: [review(null, replacedResource ? 'Under Review' : (metadata.status || 'Active'), req.user._id, 'Uploaded')],
                    lastReviewedBy: req.user._id,
                    lastReviewedAt: new Date(),
                    statusChangedAt: new Date(),
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

            if (replacedResource) {
                const lock = await KnowledgeResource.updateOne({ _id: replacedResource._id, replacementPending: null, replacedBy: null, processingStatus: { $ne: 'Processing' } }, { $set: { replacementPending: knowledgeResource._id } });
                if (lock.modifiedCount !== 1) throw fail('This resource is already being replaced.', 409);
            }

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

            if (!ingestionSummary.chunksEmbedded) throw fail('No usable content was found in this PDF.');

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
            if (replacedResource) await activateReplacement(knowledgeResource, req.user._id);

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
                        replacedResource ? 'Resource replaced successfully. The previous PDF remains available under Obsolete.' : 'Knowledge resource uploaded and processed successfully.',

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


            if (replacedResource && knowledgeResource) {
                await KnowledgeResource.updateOne({ _id: replacedResource._id, replacementPending: knowledgeResource._id }, { $set: { replacementPending: null } });
            }
            if (!knowledgeResource && req.file) await fs.unlink(req.file.path).catch(() => {});
            return res
                .status(error.status || 500)
                .json({
                    success: false,

                    message:
                        error.status ? error.message : "Knowledge resource could not be processed. The original resource has not been changed.",

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

const permittedResourceIds = async user => {
    if (user.role === 'Counselor-Admin') return null;
    if (user.role !== 'Counselor-User') return [];
    const cases = await Case.find({ isArchived: false, $or: [
        { assignedCounselor: user._id },
        { temporaryCounselor: { $elemMatch: { counselor: user._id, isActive: true, revokedAt: null, accessUntil: { $gt: new Date() } } } },
    ] }).select('llmRecommendations.resources.url llmRecommendations.suggestedMaterials.url interventionPlans.resources.url').lean();
    return [...new Set(cases.flatMap(record => [...(record.llmRecommendations || []), ...(record.interventionPlans || [])]
        .flatMap(item => [...(item.resources || []), ...(item.suggestedMaterials || [])]).map(item => item.url?.match(/^\/api\/knowledge-base\/([a-f0-9]{24})\/pdf$/i)?.[1]).filter(Boolean)))];
};

const getKnowledgeResources =
    async (req, res) => {
        try {
            const permitted = await permittedResourceIds(req.user);
            const resources =
                await KnowledgeResource.find(permitted === null ? {} : { _id: { $in: permitted } })
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
            const permitted = await permittedResourceIds(req.user);
            if (permitted !== null && !permitted.includes(req.params.id)) return res.status(403).json({ message: 'Not authorized to view this resource.' });

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
                            { "llmRecommendations.suggestedMaterials.url": resourceUrl },
                            { "interventionPlans.resources.url": resourceUrl },
                        ] },
                    ],
                });
                if (!accessibleCase && !(req.user.role === 'Counselor-User' && isStudentMaterial(resource))) {
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


            if (resource.processingStatus === 'Processing' || resource.replacementPending || resource.replaces || resource.replacedBy) {
                return res.status(409).json({ message: 'This resource is processing or part of a replacement history. Mark it obsolete to preserve its records.' });
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


const updateKnowledgeResource = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) throw fail('Resource not found.', 404);
        const resource = await KnowledgeResource.findById(req.params.id);
        if (!resource) throw fail('Resource not found.', 404);
        if (resource.processingStatus === 'Processing' || resource.replacementPending) throw fail('This resource is currently being processed or replaced.', 409);
        const metadata = readMetadata(req.body, resource);
        const previousStatus = resource.status || 'Active';
        if (metadata.status === 'Active' && previousStatus !== 'Active' &&
            (resource.isActive === false || resource.processingStatus !== 'Ready' || resource.replacedBy)) throw fail('This resource cannot be activated. It may be disabled, replaced, or not ready.', 409);
        const now = new Date();
        const change = { $set: { ...metadata, lastReviewedAt: now, lastReviewedBy: req.user._id } };
        if (metadata.status && metadata.status !== previousStatus) {
            change.$set.statusChangedAt = now;
            change.$push = { statusHistory: review(previousStatus, metadata.status, req.user._id, req.body.reason || '') };
        }
        if (metadata.resourceType && metadata.resourceType !== resource.resourceType) {
            change.$push = { ...(change.$push || {}), typeHistory: { previousType: resource.resourceType, newType: metadata.resourceType,
                reviewedBy: req.user._id, reviewedAt: now, reason: req.body.reason || 'Resource classification reviewed.' } };
        }
        // Optimistic concurrency prevents a stale editor overwriting a concurrent review.
        const updated = await KnowledgeResource.findOneAndUpdate({ _id: resource._id, updatedAt: resource.updatedAt, replacementPending: null }, change, { new: true, runValidators: true });
        if (!updated) throw fail('This resource changed while you were editing. Refresh and try again.', 409);
        return res.json({ success: true, message: 'Resource information and status updated successfully.', resource: updated });
    } catch (error) {
        return res.status(error.status || (error.name === 'ValidationError' ? 400 : 500)).json({ success: false, message: error.status ? error.message : 'Resource could not be updated.' });
    }
};

const getStudentMaterials = async (req, res) => {
    if (!['Counselor-Admin', 'Counselor-User'].includes(req.user.role)) return res.status(403).json({ message: 'Not authorized to select student materials.' });
    try {
        const resources = await KnowledgeResource.find({ resourceType: { $in: ['worksheet', 'handout'] }, isActive: { $ne: false }, processingStatus: 'Ready', replacedBy: null,
            $or: [{ status: 'Active' }, { status: { $exists: false } }] }).select('title resourceType status processingStatus isActive replacedBy description topic originalFileName').sort({ title: 1 }).lean();
        return res.json({ resources: resources.filter(isStudentMaterial) });
    } catch { return res.status(500).json({ message: 'Unable to load student materials.' }); }
};

module.exports = {
    getStudentMaterials,
    updateKnowledgeResource,
    uploadKnowledgeResource,
    getKnowledgeResources,
    getKnowledgeResourceById,
    viewKnowledgeResourcePdf,
    deleteKnowledgeResource,
};