const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDirectory = path.join(
    process.cwd(),
    'uploads',
    'intervention-resources'
);

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, {
        recursive: true,
    });
}

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, uploadDirectory);
    },

    filename: (req, file, callback) => {
        const extension =
            path.extname(file.originalname);

        const originalName =
            path
                .basename(
                    file.originalname,
                    extension
                )
                .replace(
                    /[^a-zA-Z0-9-_]/g,
                    '-'
                )
                .replace(
                    /-+/g,
                    '-'
                )
                .replace(
                    /^-|-$/g,
                    ''
                );

        const uniqueName =
            `${Date.now()}-${Math.round(
                Math.random() * 1e9
            )}-${originalName}${extension}`;

        callback(
            null,
            uniqueName
        );
    },
});

const allowedMimeTypes = [
    'application/pdf',

    'application/msword',

    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

    'application/vnd.ms-excel',

    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

    'application/vnd.ms-powerpoint',

    'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    'text/plain',

    'image/jpeg',

    'image/png',
];

const fileFilter = (
    req,
    file,
    callback
) => {
    if (
        allowedMimeTypes.includes(
            file.mimetype
        )
    ) {
        callback(
            null,
            true
        );

        return;
    }

    callback(
        new Error(
            'Unsupported file type. Allowed files are PDF, Word, Excel, PowerPoint, TXT, JPG, and PNG.'
        ),
        false
    );
};

const uploadInterventionResources =
    multer({
        storage,

        fileFilter,

        limits: {
            fileSize:
                10 * 1024 * 1024,

            files:
                10,
        },
    });

module.exports =
    uploadInterventionResources;