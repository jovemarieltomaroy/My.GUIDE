const KnowledgeResource = require("../models/knowledgeResource");
const { isStudentMaterial } = require("./resourceEligibility");
const resourceIdFromUrl = (url) =>
  typeof url === "string" ? url.match(/^\/api\/knowledge-base\/([a-f\d]{24})\/pdf$/i)?.[1] : null;
const attachmentError = (message) => Object.assign(new Error(message), { statusCode: 400 });
async function validateKnowledgeAttachments(resources, user) {
  if (!Array.isArray(resources)) throw attachmentError("Resources must be an array.");
  const storedResources = new Map();
  for (const resource of resources) {
    if (!resource || typeof resource !== "object") throw attachmentError("Invalid attachment.");
    const id = resourceIdFromUrl(resource.url);

    if (resource.resourceId && !id)
      throw attachmentError("Use the protected Knowledge Base resource URL.");
    if (!id) {
      if (
        typeof resource.url === "string" &&
        (resource.url.includes("knowledge-base") || resource.url.includes("knowledge-resources"))
      )
        throw attachmentError("Invalid Knowledge Base attachment URL.");
      continue;
    }
    if (!user?._id || !["Counselor-Admin", "Counselor-User"].includes(user.role))
      throw attachmentError("Not authorized to attach Knowledge Base materials.");
    const stored = await KnowledgeResource.findById(id);
    if (!isStudentMaterial(stored))
      throw attachmentError(
        `"${stored?.title || resource.title || "Resource"}" cannot be attached. Select an Active, ready Worksheet or Handout. Reference PDFs cannot be sent to students.`
      );
    storedResources.set(id, stored);
  }
  return storedResources;
}
module.exports = { validateKnowledgeAttachments, resourceIdFromUrl };
