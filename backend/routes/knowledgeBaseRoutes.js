const express = require(
    "express"
);

const router =
    express.Router();


const {
    uploadKnowledgeResource,
    getKnowledgeResources,
    getKnowledgeResourceById,
    viewKnowledgeResourcePdf,
    deleteKnowledgeResource,
} = require(
    "../controllers/knowledgeBaseController"
);


const {
    protect,
    adminOnly,
} = require(
    "../middleware/authValidator"
);


const uploadKnowledgeResourceMiddleware =
    require(
        "../middleware/uploadKnowledgeResource"
    );


/*
 * ---------------------------------------------
 * KNOWLEDGE BASE ROUTES
 * ---------------------------------------------
 *
 * All management endpoints are currently
 * restricted to Counselor-Admin users.
 */


/*
 * GET /api/knowledge-base
 *
 * Retrieve all uploaded knowledge resources.
 */
router.get(
    "/",
    protect,
    adminOnly,
    getKnowledgeResources
);


/*
 * POST /api/knowledge-base
 *
 * Upload and process one PDF.
 *
 * multipart/form-data:
 *
 * file
 * title
 * resourceType
 * topic
 */
router.post(
    "/",
    protect,
    adminOnly,

    uploadKnowledgeResourceMiddleware.single(
        "file"
    ),

    uploadKnowledgeResource
);

/*
 * GET /api/knowledge-base/:id/pdf
 *
 * Preview the original uploaded PDF.
 */
router.get(
    "/:id/pdf",
    protect,
    viewKnowledgeResourcePdf
);

/*
 * GET /api/knowledge-base/:id
 *
 * Retrieve one knowledge resource.
 */
router.get(
    "/:id",
    protect,
    adminOnly,
    getKnowledgeResourceById
);


/*
 * DELETE /api/knowledge-base/:id
 *
 * Delete:
 *
 * - KnowledgeResource
 * - associated KnowledgeChunks
 * - uploaded PDF
 */
router.delete(
    "/:id",
    protect,
    adminOnly,
    deleteKnowledgeResource
);


module.exports =
    router;