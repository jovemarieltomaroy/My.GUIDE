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
                validate: {
                    validator: function(value) {
                        return ['reference', 'worksheet', 'handout'].includes(value) || (typeof this.isModified === 'function' && !this.isNew && !this.isModified('resourceType'));
                    },
                    message: 'Select Reference (RAG), Worksheet, or Handout. Legacy types require review.',
                },
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

            status: { type: String, enum: ['Active', 'Under Review', 'Obsolete'], default: 'Active' },
            publicationYear: { type: Number, min: 1000, max: 9999, default: null },
            author: { type: String, trim: true, default: '' },
            description: { type: String, trim: true, default: '' },
            statusChangedAt: { type: Date, default: null },
            lastReviewedAt: { type: Date, default: null },
            lastReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            typeHistory: [{ previousType: String, newType: String, reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, reviewedAt: { type: Date, default: Date.now }, reason: String }],
            statusHistory: [{
                previousStatus: String,
                newStatus: String,
                changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                changedAt: { type: Date, default: Date.now },
                reason: { type: String, default: '' },
            }],
            replaces: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeResource', default: null },
            replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeResource', default: null },
            replacementPending: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeResource', default: null },

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