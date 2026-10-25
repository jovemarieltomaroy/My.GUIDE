const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return callback(new Error("Only JPG, JPEG, PNG, and WEBP images are allowed."), false);
  }

  callback(null, true);
};

const uploadProfilePicture = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
  fileFilter,
});

module.exports = uploadProfilePicture;
