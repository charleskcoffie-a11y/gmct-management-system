import React, { useState, useMemo } from 'react';
import type { Entry, Member, Settings, User } from '../types';
import { formatCurrency } from '../utils';
import { saveHarvestPledgeToSupabase, type HarvestPledge } from '../services/supabase';

interface HarvestPledgesProps {
  members: Member[];
  pledges: HarvestPledge[];
  setPledges: React.Dispatch<React.SetStateAction<HarvestPledge[]>>;
  settings: Settings;
  onPayPledge: (pledge: HarvestPledge, amount: number, paymentDate: string) => void;
  currentUser?: User | null;
}

type PledgeCategory = 'harvest-appeal' | 'harvest-sales';
type PledgeGroup = 'Men' | 'Women' | 'Youth' | 'Day Born' | 'Main';

const pledgeCategories: { value: PledgeCategory; label: string }[] = [
  { value: 'harvest-appeal', label: 'Harvest Appeal' },
  { value: 'harvest-sales', label: 'Harvest Sales' },
];

const pledgeGroups: PledgeGroup[] = ['Men', 'Women', 'Youth', 'Day Born', 'Main'];

const HarvestPledges: React.FC<HarvestPledgesProps> = ({ members, pledges, setPledges, settings, onPayPledge, currentUser }) => {
  const [filterName, setFilterName] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkGroup, setBulkGroup] = useState<PledgeGroup>('Men');
  const [bulkCategory, setBulkCategory] = useState<PledgeCategory>('harvest-appeal');
  const [bulkEntries, setBulkEntries] = useState<Array<{memberID: string; amount: string}>>([]);
  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDateForModal, setSelectedDateForModal] = useState<string | null>(null);

  const filteredPledges = useMemo(() => pledges.filter(p => {
    if (filterName && !p.memberName.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterClass !== 'all' && p.classNumber !== filterClass) return false;
    if (filterGroup !== 'all' && p.groupName !== filterGroup) return false;
    if (p.deleted && !showDeleted) return false;
    return true;
  }), [pledges, filterName, filterClass, filterGroup, showDeleted]);

  // Group by date
  const pledgesByDate = useMemo(() => {
    const groups: Record<string, HarvestPledge[]> = {};
    filteredPledges.forEach(pledge => {
      if (!groups[pledge.date]) groups[pledge.date] = [];
      groups[pledge.date].push(pledge);
    });
    return groups;
  }, [filteredPledges]);

  const sortedDates = useMemo(() => {
    return Object.keys(pledgesByDate).sort((a, b) => b.localeCompare(a));
  }, [pledgesByDate]);

  // Summary stats
  const summary = useMemo(() => {
    const total = filteredPledges.reduce((sum, p) => sum + p.amount, 0);
    const paid = filteredPledges.reduce((sum, p) => sum + (p.amount - (p.remaining || 0)), 0);
    const remaining = filteredPledges.reduce((sum, p) => sum + (p.remaining || 0), 0);
    return { total, paid, remaining, count: filteredPledges.length };
  }, [filteredPledges]);

  const handleBulkSave = async () => {
    if (!settings.supabaseUrl || !settings.supabaseKey) {
      alert('Supabase not configured');
      return;
    }

    const newPledges: HarvestPledge[] = bulkEntries
      .filter(e => e.memberID && e.amount && parseFloat(e.amount) > 0)
      .map(e => {
        const member = members.find(m => m.id === e.memberID);
        return {
          id: crypto.randomUUID(),
          memberID: e.memberID,
          memberName: member?.name || '',
          classNumber: member?.classNumber || '',
          groupName: bulkGroup,
          date: bulkDate,
          amount: parseFloat(e.amount),
          remaining: parseFloat(e.amount),
          category: bulkCategory as PledgeCategory,
          note: bulkCategory === 'harvest-appeal' ? 'Harvest Appeal' : 'Harvest Sales',
          createdAt: new Date().toISOString(),
          createdBy: 'bulk-entry',
        };
      });

    try {
      // Save all pledges to Supabase
      await Promise.all(
        newPledges.map(pledge =>
          saveHarvestPledgeToSupabase(settings.supabaseUrl!, settings.supabaseKey!, pledge)
        )
      );

      setPledges(prev => [...prev, ...newPledges]);
      setShowBulkModal(false);
      setBulkEntries([]);
    } catch (err) {
      console.error('Error saving pledges:', err);
      alert('Failed to save pledges. Please try again.');
    }
  };

  const addBulkRow = () => {
    setBulkEntries(prev => [...prev, { memberID: '', amount: '' }]);
  };

  const removeBulkRow = (index: number) => {
    setBulkEntries(prev => prev.filter((_, i) => i !== index));
  };

  const handlePay = (pledge: HarvestPledge) => {
    if (!paymentAmount) return;
    const payAmt = Math.min(Number(paymentAmount), pledge.remaining);
    onPayPledge(pledge, payAmt, paymentDate);
    setShowPayment(null);
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
  };

  const handleDelete = (pledgeId: string) => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'finance-chair')) {
      alert('Only admins or finance chairs can delete pledges.');
      return;
    }
    setDeleteError('');
    setDeleteId(pledgeId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const pledge = pledges.find(p => p.id === deleteId);
    if (!pledge) {
      setDeleteError('Pledge not found');
      return;
    }
    if (!settings.supabaseUrl || !settings.supabaseKey) {
      setDeleteError('Supabase not configured');
      return;
    }

    try {
      const updatedPledge: HarvestPledge = {
        ...pledge,
        deleted: true,
        updatedBy: pledge.updatedBy || pledge.createdBy || 'Unknown',
        lastUpdated: new Date().toISOString()
      };

      await saveHarvestPledgeToSupabase(settings.supabaseUrl, settings.supabaseKey, updatedPledge);
      setPledges(prev => prev.map(p => p.id === deleteId ? updatedPledge : p));
      setShowDeleteModal(false);
      setDeleteId(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete pledge');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteId(null);
    setDeleteError('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-2xl shadow-lg border-2 border-purple-200">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-xl shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                </svg>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-800">Harvest Pledges</h2>
                <p className="text-base text-slate-500 mt-1 font-medium">Track and manage harvest commitments</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => (window as any).GMCTNavigateTab && (window as any).GMCTNavigateTab('harvest')} className="bg-gradient-to-br from-slate-500 to-slate-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg text-base flex items-center gap-3 group transition-all hover:from-slate-600 hover:to-slate-700 hover:scale-105">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:-translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Harvest
            </button>
            <button onClick={() => { setShowBulkModal(true); setBulkEntries([{memberID: '', amount: ''}]); }} className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg text-base flex items-center gap-3 group transition-all hover:from-purple-600 hover:to-pink-600 hover:scale-105">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:rotate-90 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Bulk Entry
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary.count > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-400 to-cyan-500 p-6 rounded-xl shadow-lg transform hover:scale-105 transition">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">Total Pledged</h3>
            <p className="text-3xl font-bold text-white mt-2">{formatCurrency(summary.total, settings.currency)}</p>
          </div>
          <div className="bg-gradient-to-br from-green-400 to-emerald-500 p-6 rounded-xl shadow-lg transform hover:scale-105 transition">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">Paid</h3>
            <p className="text-3xl font-bold text-white mt-2">{formatCurrency(summary.paid, settings.currency)}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-400 to-red-500 p-6 rounded-xl shadow-lg transform hover:scale-105 transition">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">Remaining</h3>
            <p className="text-3xl font-bold text-white mt-2">{formatCurrency(summary.remaining, settings.currency)}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-400 to-pink-500 p-6 rounded-xl shadow-lg transform hover:scale-105 transition">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">Total Count</h3>
            <p className="text-3xl font-bold text-white mt-2">{summary.count}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 p-6 rounded-xl shadow-lg border-2 border-purple-200 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <label className="block text-sm font-bold uppercase text-purple-600 mb-1">🔍 Search Name</label>
          <input type="text" placeholder="Type to filter..." value={filterName} onChange={e => setFilterName(e.target.value)} className="block w-full border-2 border-purple-200 rounded-lg shadow-sm py-3 focus:ring-purple-400 focus:border-purple-400 font-medium"/>
        </div>
        <div>
          <label className="block text-sm font-bold uppercase text-purple-600 mb-1">📚 Class</label>
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="block w-full border-2 border-purple-200 rounded-lg shadow-sm py-3 focus:ring-purple-400 focus:border-purple-400 font-medium">
            <option value="all">All Classes</option>
            {Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1)).map(num => (<option key={num} value={num}>Class {num}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold uppercase text-purple-600 mb-1">👥 Group</label>
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className="block w-full border-2 border-purple-200 rounded-lg shadow-sm py-3 focus:ring-purple-400 focus:border-purple-400 font-medium">
            <option value="all">All Groups</option>
            {pledgeGroups.map(group => (<option key={group} value={group}>{group}</option>))}
          </select>
        </div>
      </div>

      {/* Pledges by Date */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-slate-200 overflow-hidden">
        {(currentUser?.role === 'admin' || currentUser?.role === 'finance-chair' || currentUser?.role === 'finance-team' || currentUser?.role === 'pastor') && (
          <div className="bg-gradient-to-r from-red-100 to-pink-100 px-4 py-2 border-b-2 border-red-300 flex justify-end">
            <label className="flex items-center gap-2 text-xs font-bold uppercase text-red-700 cursor-pointer">
              <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} className="rounded border-red-300 text-red-600 focus:ring-red-500"/>
              🗑️ Show Deleted Records
            </label>
          </div>
        )}
        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
          {sortedDates.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-xl font-bold">No pledges found</p>
              <p className="text-sm mt-2">Try adjusting your filters or add pledges</p>
            </div>
          ) : (
            sortedDates.map(date => {
              const datePledges = pledgesByDate[date];
              const dateTotal = datePledges.reduce((sum, p) => sum + p.amount, 0);
              const dateRemaining = datePledges.reduce((sum, p) => sum + (p.remaining || 0), 0);
              
              return (
                <div key={date} className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200 shadow-md hover:shadow-lg transition-all overflow-hidden">
                  <button 
                    onClick={() => setSelectedDateForModal(date)}
                    className="w-full p-5 flex items-center justify-between hover:bg-purple-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-xl p-4 shadow-md">
                        <div className="text-xs font-bold uppercase">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</div>
                        <div className="text-2xl font-bold">{new Date(date + 'T00:00:00').getDate()}</div>
                        <div className="text-xs">{new Date(date + 'T00:00:00').getFullYear()}</div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                        <p className="text-sm text-slate-600 mt-1 font-medium">{datePledges.length} pledge{datePledges.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600">{formatCurrency(dateTotal, settings.currency)}</div>
                      <div className="text-sm text-orange-500 font-semibold">Remaining: {formatCurrency(dateRemaining, settings.currency)}</div>
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Date Details Modal */}
      {selectedDateForModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setSelectedDateForModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col border-2 border-slate-200" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-2xl text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{new Date(selectedDateForModal + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
                  <p className="text-purple-100 mt-1">{pledgesByDate[selectedDateForModal].length} pledge{pledgesByDate[selectedDateForModal].length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setSelectedDateForModal(null)} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg text-2xl font-bold transition-all">×</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {pledgesByDate[selectedDateForModal].map(pledge => {
                  const canDelete = !pledge.deleted && currentUser && (currentUser.role === 'admin' || currentUser.role === 'finance-chair');
                  return (
                  <div key={pledge.id} className={`rounded-xl border-2 p-5 transition-all ${pledge.deleted ? 'bg-red-50 border-red-200' : 'bg-gradient-to-r from-slate-50 to-purple-50 border-purple-200 hover:shadow-md'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-slate-800">{pledge.memberName}</h3>
                          {pledge.deleted && <span className="text-xs bg-red-200 text-red-800 px-3 py-1 rounded-full font-bold">DELETED</span>}
                          {pledge.groupName && <span className="text-xs bg-purple-200 text-purple-800 px-3 py-1 rounded-full font-bold">{pledge.groupName}</span>}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-slate-500 font-medium">Class:</span>
                            <span className="ml-1 font-bold text-slate-700">{pledge.classNumber}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Category:</span>
                            <span className="ml-1 font-bold text-slate-700 capitalize">{pledge.note || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Amount:</span>
                            <span className="ml-1 font-bold text-green-600">{formatCurrency(pledge.amount, settings.currency)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Remaining:</span>
                            <span className="ml-1 font-bold text-orange-600">{formatCurrency(pledge.remaining || 0, settings.currency)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col items-end gap-2">
                        {(pledge.remaining || 0) > 0 && !pledge.deleted ? (
                          showPayment === pledge.id ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="border-2 border-purple-300 rounded-lg px-3 py-2 font-medium text-sm" />
                                <input type="number" min={1} max={pledge.remaining} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-24 border-2 border-purple-300 rounded-lg px-3 py-2 font-bold" placeholder="Amount" />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handlePay(pledge)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition flex-1">Pay</button>
                                <button onClick={() => setShowPayment(null)} className="text-slate-500 hover:text-slate-700 font-bold px-3">✕</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setShowPayment(pledge.id); setPaymentDate(new Date().toISOString().split('T')[0]); }} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold transition">Pay</button>
                          )
                        ) : (
                          <span className="text-green-700 font-bold text-lg">✓ Paid</span>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(pledge.id)} className="text-sm font-bold text-red-600 hover:text-red-800">Delete</button>
                        )}
                      </div>
                    </div>
                  </div>
                );})}
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 rounded-b-2xl border-t-2 border-slate-200">
              <button onClick={() => setSelectedDateForModal(null)} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Entry Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={() => setShowBulkModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border-2 border-slate-200" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-2xl text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 backdrop-blur p-3 rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold">Bulk Pledge Entry</h2>
                </div>
                <button type="button" onClick={() => setShowBulkModal(false)} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg text-2xl font-bold transition-all">×</button>
              </div>
            </div>
            
            <div className="p-6 space-y-4 bg-gradient-to-br from-slate-50 to-purple-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-purple-600 uppercase mb-2">Date</label>
                  <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} className="w-full border-2 border-purple-300 rounded-lg p-3 font-semibold focus:ring-2 focus:ring-purple-400" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-purple-600 uppercase mb-2">Group</label>
                  <select value={bulkGroup} onChange={e => setBulkGroup(e.target.value as PledgeGroup)} className="w-full border-2 border-purple-300 rounded-lg p-3 font-semibold focus:ring-2 focus:ring-purple-400">
                    {pledgeGroups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-purple-600 uppercase mb-2">Category</label>
                  <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value as PledgeCategory)} className="w-full border-2 border-purple-300 rounded-lg p-3 font-semibold focus:ring-2 focus:ring-purple-400">
                    {pledgeCategories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-white">
              <div className="space-y-2">
                {bulkEntries.map((entry, index) => (
                  <div key={index} className="flex gap-3 items-center">
                    <div className="flex-1">
                      <select value={entry.memberID} onChange={e => {
                        const newEntries = [...bulkEntries];
                        newEntries[index].memberID = e.target.value;
                        setBulkEntries(newEntries);
                      }} className="w-full border-2 border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-400">
                        <option value="">Select Member...</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name} - Class {m.classNumber}</option>)}
                      </select>
                    </div>
                    <div className="w-32">
                      <input type="number" min={0} step={0.01} value={entry.amount} onChange={e => {
                        const newEntries = [...bulkEntries];
                        newEntries[index].amount = e.target.value;
                        setBulkEntries(newEntries);
                      }} placeholder="Amount" className="w-full border-2 border-slate-300 rounded-lg p-3 font-bold focus:ring-2 focus:ring-purple-400" />
                    </div>
                    <button type="button" onClick={() => removeBulkRow(index)} className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition font-bold text-xl">✕</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addBulkRow} className="mt-4 w-full border-2 border-dashed border-purple-300 hover:border-purple-500 text-purple-600 hover:bg-purple-50 font-bold py-3 rounded-lg transition flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add Row
              </button>
            </div>

            <div className="p-6 bg-slate-50 rounded-b-2xl flex justify-between items-center border-t-2 border-slate-200">
              <div className="text-sm text-slate-600">
                <span className="font-bold">{bulkEntries.filter(e => e.memberID && e.amount).length}</span> valid entries
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowBulkModal(false)} className="bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-lg transition-all">Cancel</button>
                <button type="button" onClick={handleBulkSave} disabled={bulkEntries.filter(e => e.memberID && e.amount).length === 0} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-8 rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed">Save All</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-red-700 mb-4">Delete Pledge</h2>
            <p className="text-slate-600 mb-4">Are you sure you want to delete this harvest pledge? This action is permanent.</p>
            {deleteError && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-700 text-sm font-semibold">{deleteError}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={cancelDelete} className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HarvestPledges;
