const RESOURCE_STATUSES = ['Active', 'Under Review', 'Obsolete'];
const RESOURCE_TYPES = ['reference', 'worksheet', 'handout'];
const PRACTICAL_RESOURCE_TYPES = RESOURCE_TYPES.filter(type => type !== 'reference');
// Missing lifecycle status is the compatibility default, never an override of isActive.
const isResourceEligible = resource => Boolean(resource &&
    (resource.status == null || resource.status === 'Active') &&
    RESOURCE_TYPES.includes(resource.resourceType) &&
    resource.isActive !== false && resource.processingStatus === 'Ready' &&
    !resource.replacedBy);
const isStudentMaterial = resource => isResourceEligible(resource) &&
    PRACTICAL_RESOURCE_TYPES.includes(resource.resourceType);
module.exports = { RESOURCE_STATUSES, RESOURCE_TYPES, PRACTICAL_RESOURCE_TYPES, isResourceEligible, isStudentMaterial };
