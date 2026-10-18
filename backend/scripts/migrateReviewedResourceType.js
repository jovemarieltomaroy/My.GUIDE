// Deliberately scoped migration: never converts resources without individual content review.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const KnowledgeResource = require('../models/knowledgeResource');
const KnowledgeChunk = require('../models/knowledgeChunk');
const REVIEWED = {
    '6ac3466de5d5ed9369f3c069': {
        title: 'Calm Down Stress Practice', from: 'exercise', to: 'worksheet',
        reason: 'Implementation content review: student stress ratings, skills practice, written answers and closing reflection confirm this PDF is a Worksheet. Original files and vectors retained.',
    },
};
(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
        for (const [id, review] of Object.entries(REVIEWED)) {
            const resource = await KnowledgeResource.findById(id).lean();
            if (!resource || resource.title !== review.title) throw Error('Reviewed resource identity no longer matches; no migration performed.');
            if (resource.resourceType === review.to) { console.log('Already migrated: ' + id); continue; }
            if (resource.resourceType !== review.from) throw Error('Resource classification changed; review again before migration.');
            const chunkCount = await KnowledgeChunk.countDocuments({ 'metadata.resourceId': id });
            console.log(JSON.stringify({ id, title: resource.title, previousType: resource.resourceType, newType: review.to, chunkCount, apply: process.argv.includes('--apply') }));
            if (!process.argv.includes('--apply')) continue;
            await mongoose.connection.transaction(async session => {
                const updated = await KnowledgeResource.updateOne({ _id: id, resourceType: review.from, replacementPending: null, processingStatus: { $ne: 'Processing' } }, {
                    $set: { resourceType: review.to },
                    $push: { typeHistory: { previousType: review.from, newType: review.to, reviewedAt: new Date(), reviewedBy: null, reason: review.reason } },
                }, { session });
                if (updated.modifiedCount !== 1) throw Error('Resource is busy or has changed. Migration cancelled.');
                await KnowledgeChunk.updateMany({ 'metadata.resourceId': id }, { $set: { 'metadata.resourceType': review.to } }, { session });
            });
            console.log('Migrated reviewed resource and passage labels; PDF, status, approval and embeddings unchanged.');
        }
    } catch (error) { console.error(error.name + ': ' + error.message); process.exitCode = 1; }
    finally { await mongoose.disconnect(); }
})();
