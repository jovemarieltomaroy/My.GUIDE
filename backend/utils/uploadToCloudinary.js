const cloudinary = require("../config/cloudinary");

const uploadToCloudinary = (
  fileBuffer,
  options = {},
) => {
  return new Promise((resolve, reject) => {
    const uploadStream =
      cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
          folder: "myguide/profile-pictures",

          transformation: [
            {
              width: 500,
              height: 500,
              crop: "fill",
              gravity: "face",
            },
            {
              quality: "auto",
              fetch_format: "auto",
            },
          ],

          ...options,
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result);
        },
      );

    uploadStream.end(fileBuffer);
  });
};

module.exports = uploadToCloudinary;