const multer = require("multer");
const path = require("path");
const fs = require("fs");


/*
 * ---------------------------------------------
 * UPLOAD DIRECTORY
 * ---------------------------------------------
 */

const uploadDirectory =
    path.join(
        process.cwd(),
        "uploads",
        "knowledge-resources"
    );


if (
    !fs.existsSync(
        uploadDirectory
    )
) {
    fs.mkdirSync(
        uploadDirectory,
        {
            recursive: true,
        }
    );
}


/*
 * ---------------------------------------------
 * STORAGE
 * ---------------------------------------------
 */

const storage =
    multer.diskStorage({
        destination: (
            req,
            file,
            callback
        ) => {
            callback(
                null,
                uploadDirectory
            );
        },


        filename: (
            req,
            file,
            callback
        ) => {
            const extension =
                path.extname(
                    file.originalname
                );


            const originalName =
                path
                    .basename(
                        file.originalname,
                        extension
                    )
                    .replace(
                        /[^a-zA-Z0-9-_]/g,
                        "-"
                    )
                    .replace(
                        /-+/g,
                        "-"
                    )
                    .replace(
                        /^-|-$/g,
                        ""
                    );


            const uniqueName =
                `${Date.now()}-${Math.round(
                    Math.random() *
                        1e9
                )}-${originalName}${extension}`;


            callback(
                null,
                uniqueName
            );
        },
    });


/*
 * ---------------------------------------------
 * FILE FILTER
 * ---------------------------------------------
 *
 * The current RAG ingestion pipeline processes
 * PDF resources only.
 */

const fileFilter = (
    req,
    file,
    callback
) => {
    const extension =
        path
            .extname(
                file.originalname
            )
            .toLowerCase();


    const isPdf =
        file.mimetype ===
            "application/pdf" &&
        extension === ".pdf";


    if (isPdf) {
        callback(
            null,
            true
        );

        return;
    }


    callback(
        new Error(
            "Knowledge Base resources must be PDF files."
        ),
        false
    );
};


/*
 * ---------------------------------------------
 * MULTER CONFIGURATION
 * ---------------------------------------------
 */

const uploadKnowledgeResource =
    multer({
        storage,

        fileFilter,

        limits: {
            /*
             * Allow larger reference books.
             *
             * 100 MB maximum for now.
             */
            fileSize:
                100 *
                1024 *
                1024,

            /*
             * Process one knowledge resource
             * per request.
             */
            files: 1,
        },
    });


module.exports =
    uploadKnowledgeResource;