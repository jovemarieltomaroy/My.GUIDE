const multer = require("multer");

const errorHandler = (err, req, res, next) => {
  console.error(err);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Server error";

  // Multer-specific errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      statusCode = 400;
      message =
        "Profile picture must not exceed 3 MB.";
    } else {
      statusCode = 400;
      message =
        err.message ||
        "Unable to upload the image.";
    }
  }

  // Invalid file type from upload middleware
  else if (
    err.message ===
    "Only JPG, JPEG, PNG, and WEBP images are allowed."
  ) {
    statusCode = 400;
    message = err.message;
  }

  // Invalid MongoDB ObjectId
  else if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
  }

  // Duplicate MongoDB field
  else if (err.code === 11000) {
    statusCode = 400;
    message = "Duplicate field value entered";
  }

  // Invalid JWT
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  // Expired JWT
  else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  // Use an existing response status if one was already set
  else if (
    res.statusCode &&
    res.statusCode !== 200
  ) {
    statusCode = res.statusCode;
  }

  return res.status(statusCode).json({
    message,
  });
};

module.exports = errorHandler;