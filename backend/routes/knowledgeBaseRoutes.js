const express = require(
    "express"
);

const router =
    express.Router();


const {
    getStudentMaterials,
    updateKnowledgeResource,
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


const uploadPdf = (req, res, next) => {
    uploadKnowledgeResourceMiddleware.single('file')(req, res, error => {
        if (!error) return next();
        return res.status(400).json({ success: false, message: error.code === 'LIMIT_FILE_SIZE'
            ? 'The PDF must not exceed 100 MB.' : error.message || 'Unable to upload the PDF.' });
    });
};

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
router.get('/student-materials', protect, getStudentMaterials);

router.get(
    "/",
    protect,
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

    uploadPdf,

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


router.patch('/:id', protect, adminOnly, updateKnowledgeResource);
router.post('/:id/replace', protect, adminOnly, uploadPdf, uploadKnowledgeResource);

module.exports =
    router;