const mongoose = require('mongoose');
const KnowledgeResource = require('../models/knowledgeResource');
const { RESOURCE_STATUSES, RESOURCE_TYPES } = require('./resourceEligibility');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function readMetadata(body, existing = null) {
    const values = {};
    for (const field of ['title', 'topic', 'author', 'description']) {
        if (body[field] !== undefined) {
            if (typeof body[field] !== 'string') throw fail(`${field} must be text.`);
            values[field] = body[field].trim();
        }
    }
    for (const field of ['title', 'topic']) {
        if (!(values[field] ?? existing?.[field])) throw fail('Title and topic are required.');
    }
    if (body.resourceType !== undefined) {
        if (typeof body.resourceType !== 'string') throw fail('Select a valid resource type.');
        values.resourceType = body.resourceType.trim().toLowerCase();
        if (!RESOURCE_TYPES.includes(values.resourceType)) {
            if (values.resourceType !== existing?.resourceType) throw fail('Select Reference (RAG), Worksheet, or Handout.');
            delete values.resourceType; // Keep unreviewed legacy data unchanged; never present it as a final type.
        }
    } else if (!existing) throw fail('Resource type is required.');
    if (body.status !== undefined) {
        if (!RESOURCE_STATUSES.includes(body.status)) throw fail('Select a valid resource status.');
        values.status = body.status;
    }
    if (body.publicationYear !== undefined) {
        values.publicationYear = body.publicationYear === '' || body.publicationYear === null ? null : Number(body.publicationYear);
        if (values.publicationYear !== null && (!Number.isInteger(values.publicationYear) || values.publicationYear < 1000 || values.publicationYear > 9999)) throw fail('Enter a four-digit publication year.');
    }
    if (body.reason !== undefined && typeof body.reason !== 'string') throw fail('Review reason must be text.');
    return values;
}
const review = (previousStatus, newStatus, userId, reason = '') => ({ previousStatus, newStatus, changedBy: userId, changedAt: new Date(), reason });

// MongoDB Atlas transactions activate both versions together. If unavailable, fail safely.
async function activateReplacement(resource, userId) {
    await KnowledgeResource.db.transaction(async session => {
        const old = await KnowledgeResource.findOne({ _id: resource.replaces, replacementPending: resource._id }).session(session);
        if (!old || old.replacedBy || old.isActive === false) throw fail('This resource is already being replaced or has been replaced.', 409);
        if (old.resourceType !== resource.resourceType) throw fail('A replacement must keep the original resource type.');
        if (resource.processingStatus !== 'Ready' || resource.totalChunks < 1) throw fail('The replacement is not ready.');
        old.statusHistory.push(review(old.status || 'Active', 'Obsolete', userId, 'Replaced by an updated resource.'));
        old.status = 'Obsolete';
        old.replacedBy = resource._id;
        old.replacementPending = null;
        old.statusChangedAt = new Date();
        old.lastReviewedAt = new Date(); old.lastReviewedBy = userId;
        resource.statusHistory.push(review(resource.status, 'Active', userId, 'Replacement approved after successful processing.'));
        resource.status = 'Active';
        resource.statusChangedAt = new Date();
        resource.lastReviewedAt = new Date(); resource.lastReviewedBy = userId;
        await resource.save({ session });
        await old.save({ session });
    });
}
module.exports = { readMetadata, review, activateReplacement, fail, mongoose };
