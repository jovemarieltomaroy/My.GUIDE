require("dotenv").config();

const mongoose = require("mongoose");

const KnowledgeChunk = require(
    "../models/knowledgeChunk"
);

const clearKnowledgeChunks = async () => {
    try {
        console.log("Connecting to MongoDB...");

        await mongoose.connect(
            process.env.MONGO_URI
        );

        console.log("MongoDB connected.");

        const result =
            await KnowledgeChunk.deleteMany({});

        console.log(
            `Deleted ${result.deletedCount} knowledge chunks.`
        );
    } catch (error) {
        console.error(
            "Failed to clear knowledge chunks:"
        );

        console.error(
            error.message
        );
    } finally {
        await mongoose.disconnect();

        console.log(
            "MongoDB disconnected."
        );
    }
};

clearKnowledgeChunks();