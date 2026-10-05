const path = require('node:path');
const fs = require('node:fs/promises');
const KnowledgeResource = require('../models/knowledgeResource');

// Resolve protected resource URLs to files; never fetch arbitrary remote URLs.
const resolveInterventionAttachments = async (resources) => {
    const attachments = [];
    for (const resource of resources) {
        const url = resource.url || '';
        const match = url.match(/^\/api\/knowledge-base\/([a-f\d]{24})\/pdf$/i);
        let filePath;
        let filename;
        if (match) {
            const stored = await KnowledgeResource.findById(match[1]);
            if (stored?.isActive && stored.filePath) {
                filePath = path.resolve(stored.filePath);
                filename = path.basename(stored.originalFileName || stored.storedFileName || 'resource.pdf');
                if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';
            }
        } else if (url.startsWith('/uploads/')) {
            const root = path.resolve('uploads');
            const resolved = path.resolve(process.cwd(), url.slice(1));
            if (resolved.startsWith(root + path.sep)) {
                filePath = resolved;
                const extension = path.extname(resolved);
                filename = path.basename(resource.title || resolved);
                if (!filename.toLowerCase().endsWith(extension.toLowerCase())) filename += extension;
            }
        } else if (resource.type === 'Link') {
            continue;
        }

        const unavailable = () => new Error(
            `Cannot send intervention plan: the file for "${resource.title || 'Attached resource'}" is unavailable. Please replace or remove this resource and try again.`
        );
        if (!filePath) throw unavailable();
        try {
            if (!(await fs.stat(filePath)).isFile()) throw unavailable();
            await fs.access(filePath, fs.constants.R_OK);
        } catch {
            throw unavailable();
        }
        attachments.push({ filename, path: filePath, resource });
    }
    return attachments;
};

module.exports = { resolveInterventionAttachments };
