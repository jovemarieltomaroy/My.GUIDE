require("dotenv").config();

const mongoose = require(
    "mongoose"
);

const KnowledgeChunk = require(
    "../models/knowledgeChunk"
);


const runCleanup = async () => {
    try {
        /*
         * ---------------------------------------------
         * 1. CONNECT
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
         * 2. COUNT WORKSHEET CHUNKS
         * ---------------------------------------------
         */

        const worksheetCount =
            await KnowledgeChunk.countDocuments(
                {
                    "metadata.resourceType":
                        "worksheet",
                }
            );


        console.log(
            `Worksheet chunks found: ${worksheetCount}`
        );


        /*
         * ---------------------------------------------
         * 3. DELETE ONLY WORKSHEETS
         * ---------------------------------------------
         */

        const result =
            await KnowledgeChunk.deleteMany(
                {
                    "metadata.resourceType":
                        "worksheet",
                }
            );


        console.log(
            `Worksheet chunks removed: ${result.deletedCount}`
        );


        console.log(
            "Textbook/reference chunks were not deleted."
        );
    } catch (
        error
    ) {
        console.error(
            "\nWorksheet cleanup failed:"
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


runCleanup();