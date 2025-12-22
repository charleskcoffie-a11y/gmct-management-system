import React, { useState, useMemo } from 'react';
import type { HarvestPledge, HarvestPledgeCategory } from '../types/harvestPledge';
import type { Member, Settings } from '../types';

interface HarvestPledgesProps {
  members: Member[];
  pledges: HarvestPledge[];
  setPledges: React.Dispatch<React.SetStateAction<HarvestPledge[]>>;
  settings: Settings;
  onPayPledge: (pledge: HarvestPledge, amount: number) => void;
}

const pledgeCategories: { value: HarvestPledgeCategory; label: string }[] = [
  { value: 'harvest-appeal', label: 'Harvest Appeal' },
  { value: 'harvest-sales', label: 'Harvest Sales' },
];

const HarvestPledges: React.FC<HarvestPledgesProps> = ({ members, pledges, setPledges, settings, onPayPledge }) => {
  // Defensive runtime prop and array item validation
  let errorMsg = '';
  if (!Array.isArray(members) || !Array.isArray(pledges) || typeof setPledges !== 'function' || !settings || typeof onPayPledge !== 'function') {
    errorMsg = 'Required data is missing or invalid.';
  } else if (members.some(m => !m || typeof m !== 'object' || !m.id || !m.name) || pledges.some(p => !p || typeof p !== 'object' || !p.id || !p.memberID)) {
    errorMsg = 'One or more members or pledges are invalid or corrupted.';
  }
  if (errorMsg) {
    return (
      <div className="p-4 bg-red-100 text-red-800 rounded">
        <h2 className="text-xl font-bold mb-2">Harvest Pledges - Error</h2>
        <p>{errorMsg} Please contact the administrator.</p>
        <ul className="mt-2 text-sm">
          <li>members: {String(Array.isArray(members))}</li>
          <li>pledges: {String(Array.isArray(pledges))}</li>
          <li>setPledges: {typeof setPledges}</li>
          <li>settings: {settings ? 'ok' : 'missing'}</li>
          <li>onPayPledge: {typeof onPayPledge}</li>
          <li>invalidMember: {members.findIndex(m => !m || typeof m !== 'object' || !m.id || !m.name)}</li>
          <li>invalidPledge: {pledges.findIndex(p => !p || typeof p !== 'object' || !p.id || !p.memberID)}</li>
        </ul>
      </div>
    );
  }
  const [filterName, setFilterName] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [form, setForm] = useState<Partial<HarvestPledge>>({ category: 'harvest-appeal', note: '' });
  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const filteredPledges = useMemo(() => pledges.filter(p => {
    const member = members.find(m => m.id === p.memberID);
    if (filterName && !p.memberName.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterClass !== 'all' && p.classNumber !== filterClass) return false;
    return !p.deleted;
  }), [pledges, filterName, filterClass, members]);

  const handleAddPledge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.memberID || !form.amount || !form.category || !form.classNumber) return;
    const member = members.find(m => m.id === form.memberID);
    setPledges(prev => [...prev, {
      id: crypto.randomUUID(),
      memberID: form.memberID!,
      memberName: member?.name || '',
      classNumber: form.classNumber!,
      date: form.date || new Date().toISOString().split('T')[0],
      amount: Number(form.amount),
      remaining: Number(form.amount),
      category: form.category as HarvestPledgeCategory,
      note: form.note || '',
      createdAt: new Date().toISOString(),
    }]);
    setForm({ category: 'harvest-appeal' });
  };

  const handlePay = (pledge: HarvestPledge) => {
    if (!paymentAmount) return;
    const payAmt = Math.min(Number(paymentAmount), pledge.remaining);
    onPayPledge(pledge, payAmt);
    setShowPayment(null);
    setPaymentAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Harvest Pledges</h2>
        <button
          onClick={() => (window as any).GMCTNavigateTab?.('harvest')}
          className="bg-white border-2 border-amber-300 text-amber-700 font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-amber-50 hover:border-amber-400 hover:text-amber-800 transition-all"
        >
          ← Back to Harvest
        </button>
      </div>
      <form onSubmit={handleAddPledge} className="space-y-4 bg-white p-4 rounded shadow">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label>Member</label>
            <select required value={form.memberID || ''} onChange={e => {
              const member = members.find(m => m.id === e.target.value);
              setForm(f => ({ ...f, memberID: e.target.value, memberName: member?.name || '', classNumber: member?.classNumber || '' }));
            }}>
              <option value="">Select...</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label>Class</label>
            <select required value={form.classNumber || ''} onChange={e => setForm(f => ({ ...f, classNumber: e.target.value }))}>
              <option value="">Select...</option>
              {Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1)).map(num => <option key={num} value={num}>Class {num}</option>)}
            </select>
          </div>
          <div>
            <label>Date</label>
            <input type="date" required value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label>Amount</label>
            <input type="number" required min={1} value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value === '' ? undefined : Number(e.target.value) }))} />
          </div>
          <div>
            <label>Category</label>
            <select required value={form.category || 'harvest-appeal'} onChange={e => setForm(f => ({ ...f, category: e.target.value as HarvestPledgeCategory }))}>
              {pledgeCategories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
            </select>
          </div>
          <div>
            <label>Group (Optional)</label>
            {(() => {
              const baseOptions = ['Men','Women','Youth','Dayborn Special'];
              const current = form.note || '';
              const includesCurrent = current && baseOptions.includes(current);
              const options = includesCurrent ? baseOptions : (current ? [current, ...baseOptions] : baseOptions);
              return (
                <select value={current} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}>
                  <option value="">None</option>
                  {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              );
            })()}
          </div>
        </div>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Add Pledge</button>
      </form>
      <div className="flex gap-4 my-4">
        <input placeholder="Filter by name..." value={filterName} onChange={e => setFilterName(e.target.value)} />
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="all">All Classes</option>
          {Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1)).map(num => <option key={num} value={num}>Class {num}</option>)}
        </select>
      </div>
      <table className="w-full bg-white rounded shadow">
        <thead>
          <tr>
            <th>Member</th><th>Class</th><th>Date</th><th>Category</th><th>Amount</th><th>Remaining</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredPledges.map(pledge => (
            <tr key={pledge.id}>
              <td>{pledge.memberName}</td>
              <td>{pledge.classNumber}</td>
              <td>{pledge.date}</td>
              <td>{pledge.category}</td>
              <td>{pledge.amount}</td>
              <td>{pledge.remaining}</td>
              <td>
                {pledge.remaining > 0 ? (
                  showPayment === pledge.id ? (
                    <span>
                      <input type="number" min={1} max={pledge.remaining} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                      <button onClick={() => handlePay(pledge)} className="bg-blue-600 text-white px-2 py-1 rounded ml-2">Pay</button>
                      <button onClick={() => setShowPayment(null)} className="ml-2">Cancel</button>
                    </span>
                  ) : (
                    <button onClick={() => setShowPayment(pledge.id)} className="bg-blue-600 text-white px-2 py-1 rounded">Pay</button>
                  )
                ) : (
                  <span className="text-green-700 font-bold">Paid</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HarvestPledges;
