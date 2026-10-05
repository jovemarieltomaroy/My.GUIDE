require("dotenv").config();

const fs = require(
    "fs"
);

const path = require(
    "path"
);

const mongoose = require(
    "mongoose"
);

const {
    ingestKnowledgeResource,
} = require(
    "../services/rag/knowledgeIngestionService"
);


const runTest = async () => {
    try {
        /*
         * ---------------------------------------------
         * 1. CONNECT TO MONGODB
         * ---------------------------------------------
         */

        console.log(
            "Connecting to MongoDB..."
        );


        await mongoose.connect(
            process.env.MONGO_URI
        );


        console.log(
            "MongoDB connected."
        );


        /*
         * ---------------------------------------------
         * 2. LOCATE RESOURCE FOLDER
         * ---------------------------------------------
         */

        const worksheetFolder =
            path.resolve(
                "./test-files/worksheets"
            );


        const metadataPath =
            path.join(
                worksheetFolder,
                "metadata.json"
            );


        /*
         * ---------------------------------------------
         * 3. CHECK METADATA FILE
         * ---------------------------------------------
         */

        if (
            !fs.existsSync(
                metadataPath
            )
        ) {
            throw new Error(
                `metadata.json not found at: ${metadataPath}`
            );
        }


        /*
         * ---------------------------------------------
         * 4. READ METADATA
         * ---------------------------------------------
         */

        console.log(
            "Reading worksheet metadata..."
        );


        const metadataFile =
            fs.readFileSync(
                metadataPath,
                "utf8"
            );


        const resources =
            JSON.parse(
                metadataFile
            );


        if (
            !Array.isArray(
                resources
            )
        ) {
            throw new Error(
                "metadata.json must contain an array of resources."
            );
        }


        if (
            resources.length ===
            0
        ) {
            throw new Error(
                "metadata.json does not contain any resources."
            );
        }


        console.log(
            `Found ${resources.length} resource(s).`
        );


        /*
         * ---------------------------------------------
         * 5. INGEST EACH RESOURCE
         * ---------------------------------------------
         */

        const summaries = [];


        for (
            const resource of resources
        ) {
            if (
                !resource.filename
            ) {
                throw new Error(
                    "A resource in metadata.json is missing a filename."
                );
            }


            const filePath =
                path.join(
                    worksheetFolder,
                    resource.filename
                );


            const {
                filename,
                ...resourceMetadata
            } = resource;


            const summary =
                await ingestKnowledgeResource(
                    {
                        filePath,

                        metadata:
                            resourceMetadata,

                        store: true,
                    }
                );


            summaries.push(
                summary
            );
        }


        /*
         * ---------------------------------------------
         * 6. SUMMARY
         * ---------------------------------------------
         */

        console.log(
            "\n\n=========================================="
        );

        console.log(
            "WORKSHEET INGESTION SUMMARY"
        );

        console.log(
            "=========================================="
        );


        summaries.forEach(
            (
                summary,
                index
            ) => {
                console.log(
                    `\nResource ${index + 1}: ${summary.metadata.title}`
                );

                console.log(
                    `Resource ID: ${summary.metadata.resourceId}`
                );

                console.log(
                    `Type: ${summary.metadata.resourceType}`
                );

                console.log(
                    `Topic: ${summary.metadata.topic}`
                );

                console.log(
                    `Approval: ${summary.metadata.approvalStatus}`
                );

                console.log(
                    `Original File: ${summary.metadata.originalFilename}`
                );

                console.log(
                    `Relative Path: ${summary.metadata.relativeFilePath}`
                );

                console.log(
                    `Pages Read: ${summary.pagesRead}`
                );

                console.log(
                    `Chunks Created: ${summary.chunksCreated}`
                );

                console.log(
                    `Chunks Kept: ${summary.chunksKept}`
                );

                console.log(
                    `Chunks Embedded: ${summary.chunksEmbedded}`
                );

                console.log(
                    `Stored: ${summary.stored}`
                );
            }
        );


        console.log(
            "\n=========================================="
        );

        console.log(
            "Worksheet ingestion completed."
        );
    } catch (
        error
    ) {
        console.error(
            "\nKnowledge ingestion failed:"
        );

        console.error(
            error
        );
    } finally {
        if (
            mongoose.connection
                .readyState !== 0
        ) {
            await mongoose.disconnect();

            console.log(
                "\nMongoDB disconnected."
            );
        }
    }
};


runTest();