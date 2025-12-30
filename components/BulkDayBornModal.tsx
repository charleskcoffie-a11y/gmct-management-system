// components/BulkDayBornModal.tsx
import React, { useMemo, useState } from 'react';
import type { Entry, Member, Settings } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface BulkDayBornModalProps {
  members: Member[];
  settings: Settings;
  selectedDay: string;
  onSave: (entries: Entry[]) => void;
  onClose: () => void;
}

const BulkDayBornModal: React.FC<BulkDayBornModalProps> = ({
  members,
  settings,
  selectedDay,
  onSave,
  onClose,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<'cash' | 'cheque' | 'transfer' | 'mobile-money'>('cash');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');

  // Filter members by selected day and active status
  const filteredMembers = useMemo(() => {
    return members
      .filter(m => m.dayBorn === selectedDay && m.active)
      .filter(m => {
        if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, selectedDay, search]);

  const toggleMember = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredMembers.map(m => m.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!date || isNaN(amt) || amt <= 0 || selectedIds.size === 0) {
      return;
    }

    const entries: Entry[] = Array.from(selectedIds).map(id => {
      const member = members.find(m => m.id === id);
      return {
        id: uuidv4(),
        date,
        memberID: id,
        memberName: member?.name || '',
        classNumber: member?.classNumber || '',
        type: 'day-born',
        fund: 'General',
        method,
        amount: amt,
        note,
        createdBy: undefined,
        createdAt: new Date().toISOString(),
      } as Entry;
    });

    onSave(entries);
    onClose();
  };

  const allSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every(m => selectedIds.has(m.id));

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border-2 border-purple-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-purple-200 flex items-start justify-between bg-gradient-to-r from-purple-50 to-indigo-50">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-lg">
                {selectedDay}
              </div>
              <h2 className="text-2xl font-bold text-slate-800">
                📊 Bulk Day Born Entries
              </h2>
            </div>
            <p className="text-slate-500 mt-2">
              Select members and enter offering amount once for {selectedDay}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Entry Details */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 border-b border-purple-200 bg-slate-50">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
              📅 Date
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
              💰 Amount (each)
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={e => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                  setAmount(val);
                }
              }}
              className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
              💳 Method
            </label>
            <select
              value={method}
              onChange={e =>
                setMethod(e.target.value as 'cash' | 'cheque' | 'transfer' | 'mobile-money')
              }
              className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
            >
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="transfer">Transfer</option>
              <option value="mobile-money">Mobile Money</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
              📝 Note (optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Birthday offering"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
            />
          </div>
        </div>

        {/* Member Selection */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search Bar */}
          <div className="p-4 border-b border-purple-200 bg-white">
            <input
              type="text"
              placeholder="🔍 Search member name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border-2 border-purple-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
            />
          </div>

          {/* Members List */}
          <div className="overflow-y-auto flex-1">
            <div className="p-4 space-y-2">
              {/* Select All */}
              <div className="sticky top-0 bg-white pb-2 border-b-2 border-purple-100">
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={e => toggleAll(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="font-bold text-slate-700">
                    {allSelected ? 'Deselect All' : 'Select All'} ({filteredMembers.length})
                  </span>
                </label>
              </div>

              {/* Member Items */}
              {filteredMembers.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No members found for {selectedDay}
                </div>
              ) : (
                filteredMembers.map(member => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 cursor-pointer border-2 border-transparent hover:border-purple-200 transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(member.id)}
                      onChange={() => toggleMember(member.id)}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900">{member.name}</div>
                      <div className="text-xs text-slate-600">
                        {member.memberNumber ? `#${member.memberNumber}` : ''}{' '}
                        {member.classNumber ? `• Class ${member.classNumber}` : ''}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-purple-200 bg-slate-50 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={
              !date ||
              !amount ||
              parseFloat(amount) <= 0 ||
              selectedIds.size === 0
            }
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all"
          >
            ✓ Create {selectedIds.size} Entries
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkDayBornModal;
