import React, { useMemo, useState } from 'react';
import type { Member, Settings } from '../types';
import type { HarvestPledge, HarvestPledgeCategory } from '../types/harvestPledge';

interface BulkPledgesModalProps {
  members: Member[];
  settings: Settings;
  defaultCategory?: HarvestPledgeCategory;
  onCreate: (pledges: HarvestPledge[]) => void;
  onClose: () => void;
}

const categoryOptions: { value: HarvestPledgeCategory; label: string }[] = [
  { value: 'harvest-appeal', label: 'Harvest Appeal' },
  { value: 'harvest-sales', label: 'Harvest Sales' },
];

const BulkPledgesModal: React.FC<BulkPledgesModalProps> = ({ members, settings, defaultCategory = 'harvest-appeal', onCreate, onClose }) => {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<HarvestPledgeCategory>(defaultCategory);
  const [note, setNote] = useState('');

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (classFilter !== 'all' && m.classNumber !== classFilter) return false;
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [members, classFilter, search]);

  const toggleMember = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(filteredMembers.map(m => m.id)));
    else setSelectedIds(new Set());
  };

  const handleCreate = () => {
    const amt = parseFloat(amount);
    if (!date || isNaN(amt) || amt <= 0 || selectedIds.size === 0) return;
    const pledges: HarvestPledge[] = Array.from(selectedIds).map(id => {
      const member = members.find(m => m.id === id);
      return {
        id: crypto.randomUUID(),
        memberID: id,
        memberName: member?.name || '',
        classNumber: member?.classNumber || '',
        date,
        amount: amt,
        remaining: amt,
        category,
        note,
        createdAt: new Date().toISOString(),
      } as HarvestPledge;
    });
    onCreate(pledges);
    onClose();
  };

  const classOptions = useMemo(() => ['all', ...Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1))], [settings.maxClasses]);
  const allSelected = filteredMembers.length > 0 && filteredMembers.every(m => selectedIds.has(m.id));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border-2 border-slate-200" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Bulk Create Harvest Pledges</h2>
            <p className="text-slate-500">Select members, set details once, and create pledges for all.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
        </div>

        {/* Details */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-slate-200 bg-slate-50">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border-2 border-slate-300 rounded-lg p-3" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Amount (each)</label>
            <input inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border-2 border-slate-300 rounded-lg p-3" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value as HarvestPledgeCategory)} className="w-full border-2 border-slate-300 rounded-lg p-3">
              {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g., Men group" className="w-full border-2 border-slate-300 rounded-lg p-3" />
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="border-2 border-slate-300 rounded-lg p-3" placeholder="Search name..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="border-2 border-slate-300 rounded-lg p-3" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            {classOptions.map(opt => <option key={opt} value={opt}>{opt === 'all' ? 'All Classes' : `Class ${opt}`}</option>)}
          </select>
          <label className="flex items-center gap-2 p-3 border-2 border-slate-200 rounded-lg">
            <input type="checkbox" checked={allSelected} onChange={e => toggleAll(e.target.checked)} />
            <span className="font-semibold">Select all filtered ({filteredMembers.length})</span>
          </label>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredMembers.map(m => (
            <button key={m.id} onClick={() => toggleMember(m.id)} className={`text-left p-3 rounded-lg border transition-all ${selectedIds.has(m.id) ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200 hover:border-indigo-200'}`}>
              <div className="font-bold text-slate-800">{m.name}</div>
              <div className="text-sm text-slate-500">Class {m.classNumber || '-'} • ID: {m.memberNumber || 'N/A'}</div>
            </button>
          ))}
          {filteredMembers.length === 0 && (
            <div className="col-span-full text-center py-8 text-slate-400 italic">No members found.</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">Selected: <span className="font-bold">{selectedIds.size}</span></div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-3 rounded-lg border-2 border-slate-300 bg-white font-bold text-slate-700">Cancel</button>
            <button onClick={handleCreate} disabled={selectedIds.size === 0 || !amount || !date} className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed">Create Pledges</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkPledgesModal;
