// components/BulkChildrenMinistryModal.tsx
import React, { useState } from 'react';
import type { Entry, Settings, Method } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getTodayEST, getNowEST, formatMethod } from '../utils';

interface BulkChildrenMinistryModalProps {
  settings: Settings;
  onSave: (entry: Entry) => void;
  onClose: () => void;
}

const BulkChildrenMinistryModal: React.FC<BulkChildrenMinistryModalProps> = ({
  settings,
  onSave,
  onClose,
}) => {
  const [date, setDate] = useState<string>(getTodayEST());
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<Method>('cash');
  const [note, setNote] = useState('');
  const [collectionSource, setCollectionSource] = useState('');

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!date || isNaN(amt) || amt <= 0) {
      return;
    }

    const entry: Entry = {
      id: uuidv4(),
      date,
      memberID: '',
      memberName: `Children's Ministry Collection${collectionSource ? ` - ${collectionSource}` : ''}`,
      type: 'childrens-ministry',
      fund: 'General',
      method,
      amount: amt,
      note: note || undefined,
      createdBy: undefined,
      createdAt: getNowEST(),
    };

    onSave(entry);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border-2 border-yellow-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-yellow-200 flex items-start justify-between bg-gradient-to-r from-yellow-50 to-amber-50">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">👶</span>
              <h2 className="text-2xl font-bold text-slate-800">
                Children's Ministry Collection
              </h2>
            </div>
            <p className="text-slate-500 mt-2">
              Record bulk collection amount for Children's Ministry
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
        <div className="p-6 space-y-4 bg-slate-50">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
              📅 Collection Date
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
              💰 Total Amount Collected
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
              className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
              💳 Payment Method
            </label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value as Method)}
              className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
            >
              <option value="cash">{formatMethod('cash')}</option>
              <option value="check">{formatMethod('check')}</option>
              <option value="card">{formatMethod('card')}</option>
              <option value="e-transfer">{formatMethod('e-transfer')}</option>
              <option value="mobile">{formatMethod('mobile')}</option>
              <option value="other">{formatMethod('other')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
              📍 Collection Source (optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Sunday Service, VBS Event, Special Offering"
              value={collectionSource}
              onChange={e => setCollectionSource(e.target.value)}
              className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
              📝 Additional Notes (optional)
            </label>
            <textarea
              placeholder="e.g., Notes about the collection..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 resize-none h-20"
            />
          </div>

          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <span className="font-bold">ℹ️ Note:</span> This records the total collection amount. When individual member contributions are tracked in the future, they can be added separately.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-yellow-200 bg-slate-50 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!date || !amount || parseFloat(amount) <= 0}
            className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all"
          >
            ✓ Save Collection Entry
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkChildrenMinistryModal;
