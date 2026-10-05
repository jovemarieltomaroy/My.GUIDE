const mongoose = require("mongoose");

const knowledgeResourceSchema =
    new mongoose.Schema(
        {
            title: {
                type: String,
                required: true,
                trim: true,
            },

            originalFileName: {
                type: String,
                required: true,
                trim: true,
            },

            storedFileName: {
                type: String,
                trim: true,
            },

            filePath: {
                type: String,
                required: true,
                trim: true,
            },

            mimeType: {
                type: String,
                default: "application/pdf",
            },

            resourceType: {
                type: String,
                required: true,
                trim: true,
            },

            topic: {
                type: String,
                required: true,
                trim: true,
            },

            totalPages: {
                type: Number,
                default: 0,
                min: 0,
            },

            totalChunks: {
                type: Number,
                default: 0,
                min: 0,
            },

            embeddingProvider: {
                type: String,
                default: "ollama",
                trim: true,
            },

            embeddingModel: {
                type: String,
                default: "embeddinggemma",
                trim: true,
            },
            processingStatus: {
                type: String,
                enum: [
                    "Pending",
                    "Processing",
                    "Ready",
                    "Failed",
                ],
                default: "Pending",
            },

            processingError: {
                type: String,
                default: null,
            },

            isActive: {
                type: Boolean,
                default: true,
            },

            uploadedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
        },
        {
            timestamps: true,
        }
    );

module.exports = mongoose.model(
    "KnowledgeResource",
    knowledgeResourceSchema
);