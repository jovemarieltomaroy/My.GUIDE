import { useEffect, useState } from 'react';
import { apiRequest } from '../config/api';

export default function KnowledgeMaterialSelector({ resources = [], onChange, disabled }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  useEffect(() => {
    let cancelled = false;
    apiRequest('/knowledge-base/student-materials').then(data => {
      if (!cancelled) setMaterials(data.resources || []);
    }).catch(failure => { if (!cancelled) setError(failure.message || 'Unable to load materials.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const available = materials.filter(material => !resources.some(resource => resource.url === `/api/knowledge-base/${material._id}/pdf`));
  const add = () => {
    const material = available.find(item => item._id === selected);
    if (!material) return;
    onChange([...resources, { title: material.title, type: 'PDF', url: `/api/knowledge-base/${material._id}/pdf`, description: material.description || material.topic || '', isProvidedToStudent: false }]);
    setSelected('');
  };
  return <div className="mt-4 rounded-xl border border-[#E7E2DF] bg-white p-4">
    <label htmlFor="knowledge-material" className="text-sm font-semibold">Choose a Knowledge Base attachment</label>
    <p className="mt-1 text-xs leading-5 text-[#827A76]">Only Active, ready Worksheets and Handouts are listed. Reference PDFs cannot be sent. Your selection still requires intervention-plan approval.</p>
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : <div className="mt-3 flex flex-wrap gap-2">
      <select id="knowledge-material" disabled={loading || disabled} value={selected} onChange={event => setSelected(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#DDD8D4] px-3 py-2 text-sm">
        <option value="">{loading ? 'Loading materials…' : available.length ? 'Select a Worksheet or Handout' : 'No eligible materials available'}</option>
        {available.map(material => <option key={material._id} value={material._id}>{material.title} ({material.resourceType === 'worksheet' ? 'Worksheet' : 'Handout'})</option>)}
      </select>
      <button type="button" disabled={!selected || disabled} onClick={add} className="rounded-lg bg-[#8C1518] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Add attachment</button>
    </div>}
  </div>;
}
