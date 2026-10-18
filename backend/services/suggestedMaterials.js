const { PRACTICAL_RESOURCE_TYPES } = require('./resourceEligibility');
function collectSuggestedMaterials(recommendations) {
    const materials = new Map();
    for (const recommendation of recommendations || []) {
        const resource = recommendation.supportingResource;
        const id = String(resource?.resourceId || '');
        if (!/^[a-f\d]{24}$/i.test(id) || !PRACTICAL_RESOURCE_TYPES.includes(resource?.resourceType)) continue;
        if (!materials.has(id)) materials.set(id, { resourceId: id, title: resource.title || resource.source || 'Suggested material',
            resourceType: resource.resourceType, url: `/api/knowledge-base/${id}/pdf`, pageNumber: resource.pageNumber || null,
            interventions: [] });
        const material = materials.get(id);
        if (recommendation.intervention && !material.interventions.includes(recommendation.intervention)) material.interventions.push(recommendation.intervention);
    }
    return [...materials.values()];
}
function selectSuggestedMaterials(recommendation, selectedIds = []) {
    if (!Array.isArray(selectedIds) || selectedIds.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) throw new Error('Select valid suggested materials.');
    const suggestions = new Map((recommendation.suggestedMaterials || []).map(material => [String(material.resourceId), material]));
    return [...new Set(selectedIds)].map(id => {
        const material = suggestions.get(id);
        if (!material) throw new Error('This material was not suggested for this recommendation.');
        return { title: material.title, type: 'PDF', url: `/api/knowledge-base/${id}/pdf`,
            description: `Counselor-selected ${material.resourceType}`, isProvidedToStudent: false };
    });
}
module.exports = { collectSuggestedMaterials, selectSuggestedMaterials };
