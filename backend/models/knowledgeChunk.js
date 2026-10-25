const mongoose = require("mongoose");

/*
 * ---------------------------------------------
 * KNOWLEDGE CHUNK METADATA
 * ---------------------------------------------
 */

const knowledgeChunkMetadataSchema = new mongoose.Schema(
  {
    /*
     * Human-readable source name.
     *
     * Example:
     * Theory and Practice of Counseling
     * and Psychotherapy
     */
    source: {
      type: String,
      required: true,
      trim: true,
    },

    /*
     * Human-readable resource title.
     */
    title: {
      type: String,
      required: true,
      trim: true,
    },

    /*
     * Type of material stored in
     * the knowledge base.
     *
     * Examples:
     * reference
     * worksheet
     * handout
     * activity
     * exercise
     * template
     */
    resourceType: {
      type: String,
      default: "reference",
      trim: true,
      lowercase: true,
    },

    /*
     * General subject/category.
     */
    topic: {
      type: String,
      default: "Not specified",
      trim: true,
    },

    /*
     * Approval status of the resource.
     *
     * Current development worksheets
     * use "temporary-test".
     *
     * Later counselor-approved resources
     * can use "approved".
     */
    approvalStatus: {
      type: String,
      default: "unspecified",
      trim: true,
      lowercase: true,
    },

    /*
     * Stable identifier connecting all
     * chunks from the same resource.
     *
     * Example:
     * anxiety-trigger-worry-log
     */
    resourceId: {
      type: String,
      default: null,
      trim: true,
    },

    /*
     * Original PDF filename.
     *
     * This is useful when the application
     * later needs to display or serve the
     * actual supporting PDF.
     */
    originalFilename: {
      type: String,
      default: null,
      trim: true,
    },

    /*
     * Relative path used during local
     * development.
     *
     * Do not treat this as the permanent
     * production file-storage mechanism.
     */
    relativeFilePath: {
      type: String,
      default: null,
      trim: true,
    },

    /*
     * PDF page where this chunk came from.
     */
    pageNumber: {
      type: Number,
      default: null,
    },

    /*
     * Chunk position within the page.
     */
    chunkIndex: {
      type: Number,
      default: null,
    },

    /*
     * Character-position information
     * produced by the chunking service.
     */
    startCharacter: {
      type: Number,
      default: null,
    },

    endCharacter: {
      type: Number,
      default: null,
    },

    characterCount: {
      type: Number,
      default: null,
    },
  },
  {
    _id: false,
  }
);

/*
 * ---------------------------------------------
 * KNOWLEDGE CHUNK
 * ---------------------------------------------
 */

const knowledgeChunkSchema = new mongoose.Schema(
  {
    /*
     * Actual text used during retrieval.
     */
    content: {
      type: String,
      required: true,
    },

    /*
     * 768-dimensional vector produced by
     * embeddinggemma.
     */
    embedding: {
      type: [Number],
      required: true,
    },

    /*
     * Information about the source
     * resource and chunk.
     */
    metadata: {
      type: knowledgeChunkMetadataSchema,

      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("KnowledgeChunk", knowledgeChunkSchema);
