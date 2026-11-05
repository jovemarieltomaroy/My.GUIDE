require("dotenv").config();
const { RECOMMENDATION_OUTPUT_VERSION } = require("./services/rag/recommendationOutputValidation");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const connectDB = require("./config/db.js");

const authRoutes = require("./routes/authRoutes.js");

const userRoutes = require("./routes/userRoutes.js");

const caseRoutes = require("./routes/caseRoutes.js");

const studentRoutes = require("./routes/studentRoutes.js");

const preCounselingRoutes = require("./routes/preCounselingRoutes");

const knowledgeBaseRoutes = require("./routes/knowledgeBaseRoutes.js");

const errorHandler = require("./middleware/errorHandler.js");

const app = express();

app.use(
  cors({
    origin: new URL(process.env.FRONTEND_URL || "http://localhost:5174").origin,

    credentials: true,
  })
);

app.use(express.json());

app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the backend API!",

    status: "Server is running smoothly",
    recommendationOutputVersion: RECOMMENDATION_OUTPUT_VERSION,

    timestamp: new Date(),
  });
});
app.get("/api/recommendation-runtime", (req, res) => {
  res.json({
    status: "Server is running smoothly",
    recommendationOutputVersion: RECOMMENDATION_OUTPUT_VERSION,
    timestamp: new Date(),
  });
});

/*
 * ---------------------------------------------
 * API ROUTES
 * ---------------------------------------------
 */

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

const { protect, counselorOnly } = require("./middleware/authValidator");
app.use("/api/system", require("./routes/systemRoutes"));
app.use("/api/cases", protect, counselorOnly, caseRoutes);

app.use("/api/students", protect, counselorOnly, studentRoutes);

app.use("/api/pre-counseling", preCounselingRoutes);
app.use("/api/bookings", require("./routes/bookingRoutes"));

app.use("/api/knowledge-base", protect, counselorOnly, knowledgeBaseRoutes);

app.use(
  "/uploads",

  protect,
  counselorOnly,
  require("./middleware/clinicalUploadAccess"),
  express.static(process.env.UPLOAD_ROOT || path.join(process.cwd(), "uploads"))
);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);

    process.exit(1);
  }
};

startServer();
