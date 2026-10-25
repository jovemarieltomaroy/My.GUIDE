const express = require("express");
const router = express.Router();
const { login, refreshToken } = require("../controllers/authController");
const { validateLoginInput } = require("../middleware/authValidator");

router.post("/", validateLoginInput, login);
router.post("/refresh-token", refreshToken);

module.exports = router;
