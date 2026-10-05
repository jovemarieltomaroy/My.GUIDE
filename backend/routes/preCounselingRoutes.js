const express = require('express');

const router = express.Router();

const {
    sendPreCounselingForm,
    getPublicPreCounselingForm,
    submitPreCounselingForm,
    getLatestSubmittedPreCounselingForm,
} = require(
    '../controllers/preCounselingController'
);

const {
    protect,
} = require('../middleware/authValidator');

/*
 * =========================================================
 * PUBLIC ROUTES
 * =========================================================
 *
 * These routes are accessed through the secure token
 * sent to the student's email.
 *
 * The student does NOT need a My.GUIDE account.
 */

router.get(
    '/public/:token',
    getPublicPreCounselingForm
);

router.post(
    '/public/:token/submit',
    submitPreCounselingForm
);

/*
 * =========================================================
 * COUNSELOR ROUTES
 * =========================================================
 *
 * These require a logged-in My.GUIDE counselor.
 */

router.post(
    '/send',
    protect,
    sendPreCounselingForm
);

router.get(
    '/student/:studentId/latest',
    protect,
    getLatestSubmittedPreCounselingForm
);

module.exports = router;