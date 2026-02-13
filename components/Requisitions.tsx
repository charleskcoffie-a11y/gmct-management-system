import React, { useEffect, useMemo, useState } from 'react';
import type { Requisition, RequisitionItem, RequisitionStatus, RequisitionApproverRole, Settings, User } from '../types';
import { loadRequisitions, saveRequisition, saveRequisitionAttachment, submitRequisition, uploadRequisitionAttachment } from '../services/supabase';
import { formatCurrency } from '../utils';
import { downloadRequisitionPdf } from '../utils/requisitionPdf';

type Props = {
  settings: Settings;
  currentUser: User;
};

const getTodayISO = () => new Date().toISOString().split('T')[0]; // YYYY-MM-DD

const emptyReq = (username: string): Requisition => ({
  id: crypto.randomUUID(),
  requesterUsername: username,
  requesterName: username,
  dateCreated: getTodayISO(),
  title: '',
  purpose: '',
  intendedFor: '',
  purchaseType: 'routine',
  fund: '',
  neededBy: undefined,
  totalAmount: 0,
  status: 'draft',
  items: []
});

export default function Requisitions({ settings, currentUser }: Props) {
  const [list, setList] = useState<Requisition[]>([]);
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | 'all'>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const signatureCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const refresh = async () => {
    if (!settings.supabaseUrl || !settings.supabaseKey) return;
    setLoading(true);
    try {
      const data = await loadRequisitions(settings.supabaseUrl, settings.supabaseKey);
      setList(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [settings.supabaseUrl, settings.supabaseKey]);

  const generateRequisitionNumber = (): string => {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `REQ-${year}-${timestamp}`;
  };

  const approverLabel = (role?: RequisitionApproverRole): string => {
    if (role === 'pastor') return 'Pastor';
    if (role === 'finance-team') return 'Steward (Finance Team)';
    if (role === 'admin') return 'Admin';
    return 'Unassigned';
  };

  const resolveApproverTarget = (amount: number, requesterUsername: string): { role: RequisitionApproverRole; username?: string } => {
    const limits = settings.requisitionApprovalLimits;
    if (limits) {
      const match = (min: number, max: number) => amount >= min && amount <= max;
      if (match(limits.financeTeam.min, limits.financeTeam.max)) {
        const financeUsers = settings.requisitionFinanceApprovers || [];
        const assigned = financeUsers.find(u => u !== requesterUsername);
        return { role: 'finance-team', username: assigned };
      }
    }

    const pastorLimits = (settings.requisitionPastorLimits || [])
      .filter(limit => amount >= limit.min && amount <= limit.max)
      .filter(limit => limit.username !== requesterUsername)
      .sort((a, b) => a.max - b.max);

    if (pastorLimits.length > 0) {
      return { role: 'pastor', username: pastorLimits[0].username };
    }

    return { role: 'pastor' };
  };

  const getApproverOptionsForAmount = (amount: number): { name: string; role: string }[] => {
    const limits = settings.requisitionApprovalLimits;
    const options: { name: string; role: string }[] = [];

    // Check if amount is in finance team range
    if (limits && amount >= limits.financeTeam.min && amount <= limits.financeTeam.max) {
      const financeUsers = settings.requisitionFinanceApprovers || [];
      financeUsers.forEach(u => options.push({ name: u, role: 'finance-team' }));
    } else {
      // Check pastor overrides first
      const pastorLimits = (settings.requisitionPastorLimits || [])
        .filter(limit => amount >= limit.min && amount <= limit.max)
        .sort((a, b) => a.max - b.max);
      
      pastorLimits.forEach(p => options.push({ name: p.username, role: 'pastor' }));
    }

    return options;
  };

  const getAllApproverOptions = (): { name: string; role: string }[] => {
    const options: { name: string; role: string }[] = [];
    // Add all finance team approvers
    (settings.requisitionFinanceApprovers || []).forEach(u => options.push({ name: u, role: 'finance-team' }));
    // Add all pastor overrides
    (settings.requisitionPastorLimits || []).forEach(p => options.push({ name: p.username, role: 'pastor' }));
    // Remove duplicates
    const seen = new Set<string>();
    return options.filter(opt => {
      const key = `${opt.name}-${opt.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const filtered = useMemo(() => list.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (q && !(r.title.toLowerCase().includes(q.toLowerCase()) || (r.purpose||'').toLowerCase().includes(q.toLowerCase()))) return false;
    // Requesters see all for MVP; can restrict later
    return true;
  }), [list, statusFilter, q]);

  // Group requisitions by year and month
  const groupedRequisitions = useMemo(() => {
    const groups: { [year: string]: { [month: string]: typeof filtered } } = {};
    
    filtered.forEach(req => {
      const date = req.dateCreated ? new Date(req.dateCreated) : new Date();
      const year = date.getFullYear().toString();
      const month = date.toLocaleString('default', { month: 'long' });
      
      if (!groups[year]) groups[year] = {};
      if (!groups[year][month]) groups[year][month] = [];
      groups[year][month].push(req);
    });
    
    return groups;
  }, [filtered]);

  // Auto-expand the most recent year and month on mount or when filtered changes
  useEffect(() => {
    const years = Object.keys(groupedRequisitions).sort((a, b) => parseInt(b) - parseInt(a));
    if (years.length > 0 && expandedYears.size === 0) {
      const mostRecentYear = years[0];
      setExpandedYears(new Set([mostRecentYear]));
      
      // Also expand the most recent month in that year
      const months = Object.keys(groupedRequisitions[mostRecentYear]);
      if (months.length > 0) {
        const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const sortedMonths = months.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a));
        setExpandedMonths(new Set([`${mostRecentYear}-${sortedMonths[0]}`]));
      }
    }
  }, [groupedRequisitions]);

  const toggleYear = (year: string) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setExpandedYears(newExpanded);
  };

  const toggleMonth = (yearMonth: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(yearMonth)) {
      newExpanded.delete(yearMonth);
    } else {
      newExpanded.add(yearMonth);
    }
    setExpandedMonths(newExpanded);
  };

  const addItem = () => {
    if (!editing) return;
    const item: RequisitionItem = { id: crypto.randomUUID(), requisitionId: editing.id, description: '', qty: 1, unitPrice: 0 };
    const items = [...(editing.items||[]), item];
    const total = items.reduce((s,i)=> s + (i.qty||0)*(i.unitPrice||0), 0);
    setEditing({ ...editing, items, totalAmount: total });
    setEditingItemId(item.id); // Auto-open new item for editing
  };

  const updateItem = (id: string, patch: Partial<RequisitionItem>) => {
    if (!editing) return;
    // Prevent zero amount entries
    const updatedItem = { ...(editing.items||[]).find(i => i.id === id), ...patch };
    const itemTotal = (Number(updatedItem.qty)||0) * (Number(updatedItem.unitPrice)||0);
    if (itemTotal === 0 && (patch.qty !== undefined || patch.unitPrice !== undefined)) {
      alert('Item amount cannot be zero. Please enter both quantity and unit price.');
      return;
    }
    const items = (editing.items||[]).map(i => i.id === id ? { ...i, ...patch } : i);
    const total = items.reduce((s,i)=> s + (Number(i.qty)||0)*(Number(i.unitPrice)||0), 0);
    setEditing({ ...editing, items, totalAmount: total });
  };

  const removeItem = (id: string) => {
    if (!editing) return;
    const items = (editing.items||[]).filter(i => i.id !== id);
    const total = items.reduce((s,i)=> s + (i.qty||0)*(i.unitPrice||0), 0);
    setEditing({ ...editing, items, totalAmount: total });
    // Clear editing state if we're removing the item being edited
    if (editingItemId === id) {
      setEditingItemId(null);
    }
  };

  const validateApproverForAmount = (approver: string, amount: number): { valid: boolean; message?: string } => {
    if (!approver) return { valid: false, message: 'No approver selected' };
    
    const limits = settings.requisitionApprovalLimits;
    
    // Check if it's a finance team approver
    const isFinanceTeam = (settings.requisitionFinanceApprovers || []).includes(approver);
    if (isFinanceTeam) {
      if (limits && amount >= limits.financeTeam.min && amount <= limits.financeTeam.max) {
        return { valid: true };
      } else if (limits) {
        return { valid: false, message: `Finance Team approver can only handle $${limits.financeTeam.min} - $${limits.financeTeam.max}. Current total: $${amount.toFixed(2)}` };
      }
    }
    
    // Check if it's a pastor with override limits
    const pastorLimit = (settings.requisitionPastorLimits || []).find(p => p.username === approver);
    if (pastorLimit) {
      if (amount >= pastorLimit.min && amount <= pastorLimit.max) {
        return { valid: true };
      }
      return { valid: false, message: `${approver} can only approve $${pastorLimit.min} - $${pastorLimit.max}. Current total: $${amount.toFixed(2)}` };
    }
    
    // If no specific limit found, it's valid (will use default pastor role)
    return { valid: true };
  };

  const onSave = async () => {
    if (!editing) return;
    if (!editing.requesterName || !editing.requesterName.trim()) {
      alert('Requester name is required.');
      return;
    }
    if ((editing.totalAmount || 0) === 0) {
      alert('Cannot save requisition with zero total amount. Please add items with valid quantities and prices.');
      return;
    }
    if (!settings.supabaseUrl || !settings.supabaseKey) {
      alert('Cloud connection required. Configure Supabase in Settings.');
      return;
    }
    await saveRequisition(settings.supabaseUrl, settings.supabaseKey, editing);
    setEditing(null);
    await refresh();
  };

  const onSubmit = async (req: Requisition) => {
    if (!settings.supabaseUrl || !settings.supabaseKey) return;
    if (!req.requesterName || !req.requesterName.trim()) {
      alert('Requester name is required before submission.');
      return;
    }
    if ((req.totalAmount || 0) === 0) {
      alert('Cannot submit requisition with zero total amount. Please add items with valid quantities and prices.');
      return;
    }
    if (!req.intendedFor) {
      alert('Please select an approver before submitting.');
      return;
    }
    // Validate that the selected approver can handle this amount
    const validation = validateApproverForAmount(req.intendedFor, req.totalAmount || 0);
    if (!validation.valid) {
      alert(`Cannot submit: ${validation.message}\n\nPlease select a different approver or adjust the total amount.`);
      return;
    }
    // Use the selected approver (intendedFor) instead of auto-resolving
    const isFinanceTeam = (settings.requisitionFinanceApprovers || []).includes(req.intendedFor);
    const approverRole: RequisitionApproverRole = isFinanceTeam ? 'finance-team' : 'pastor';
    const requisitionNumber = generateRequisitionNumber();
    await submitRequisition(settings.supabaseUrl, settings.supabaseKey, req.id, approverRole, req.intendedFor, requisitionNumber);
    setEditing(null);
    await refresh();
  };

  const statusStyle = (s: RequisitionStatus) => {
    const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border';
    switch (s) {
      case 'draft': return base + ' bg-slate-50 text-slate-700 border-slate-200';
      case 'submitted': return base + ' bg-amber-50 text-amber-700 border-amber-200';
      case 'approved': return base + ' bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'rejected': return base + ' bg-rose-50 text-rose-700 border-rose-200';
      case 'funded': return base + ' bg-sky-50 text-sky-700 border-sky-200';
      case 'paid': return base + ' bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'closed': return base + ' bg-violet-50 text-violet-700 border-violet-200';
      default: return base;
    }
  };

  const initials = (name: string) => name.trim().split(' ').filter(Boolean).map(p=>p[0]).join('').slice(0,2).toUpperCase();

  const canAttachCompletion = (status: RequisitionStatus) => ['approved', 'funded', 'paid', 'closed'].includes(status);

  const handleAttachmentChange = async (file?: File) => {
    if (!file || !editing) return;
    if (!settings.supabaseUrl || !settings.supabaseKey) {
      alert('Cloud connection required. Configure Supabase in Settings.');
      return;
    }
    setAttachmentUploading(true);
    try {
      const url = await uploadRequisitionAttachment(settings.supabaseUrl, settings.supabaseKey, editing.id, file);
      await saveRequisitionAttachment(settings.supabaseUrl, settings.supabaseKey, editing.id, url);
      setEditing({ ...editing, completionAttachmentUrl: url, completionAttachmentAt: new Date().toISOString() });
      await refresh();
    } finally {
      setAttachmentUploading(false);
    }
  };

  const markComplete = async () => {
    if (!editing) return;
    if (!settings.supabaseUrl || !settings.supabaseKey) {
      alert('Cloud connection required. Configure Supabase in Settings.');
      return;
    }
    if (!editing.completionAttachmentUrl) {
      alert('Attach a completion photo before closing the requisition.');
      return;
    }
    const updated = { ...editing, status: 'closed' as RequisitionStatus };
    await saveRequisition(settings.supabaseUrl, settings.supabaseKey, updated);
    setEditing(updated);
    await refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-extrabold tracking-tight">📋 Requisitions</h2>
            <p className="text-white/80 mt-2 text-lg">Create, submit, and track purchase requests with ease</p>
          </div>
          <button onClick={()=>setEditing(emptyReq(currentUser.username))}
                  className="bg-white text-indigo-700 hover:bg-slate-100 text-lg font-bold px-6 py-3 rounded-xl shadow-lg transition-all hover:shadow-xl">
            ➕ New Requisition
          </button>
        </div>
      </div>

      {/* Controls Section */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-3.5 text-xl">🔎</span>
          <input 
            className="w-full border-2 border-slate-300 rounded-xl pl-12 pr-5 py-3 bg-white text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-400"
            placeholder="Search by title or purpose..." 
            value={q} 
            onChange={e=>setQ(e.target.value)} 
          />
        </div>
        <select 
          className="border-2 border-slate-300 rounded-xl px-5 py-3 bg-white text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-semibold" 
          value={statusFilter} 
          onChange={e=>setStatusFilter(e.target.value as any)}
        >
          <option value="all">All Statuses</option>
          {['draft','submitted','approved','rejected','funded','paid','closed'].map(s=> <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Organized by Year/Month */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({length:6}).map((_,i)=> (
            <div key={i} className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-md animate-pulse">
              <div className="h-5 w-2/3 bg-slate-300 rounded mb-4" />
              <div className="h-4 w-1/2 bg-slate-200 rounded mb-8" />
              <div className="h-32 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && Object.keys(groupedRequisitions).sort((a, b) => parseInt(b) - parseInt(a)).map(year => (
        <div key={year} className="mb-6">
          {/* Year Folder */}
          <button
            onClick={() => toggleYear(year)}
            className="w-full flex items-center gap-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl px-6 py-4 shadow-lg hover:shadow-xl transition-all mb-4"
          >
            <span className="text-3xl">{expandedYears.has(year) ? '📂' : '📁'}</span>
            <span className="text-2xl font-bold">{year}</span>
            <span className="ml-auto text-lg font-semibold bg-white/20 px-4 py-1 rounded-full">
              {Object.values(groupedRequisitions[year]).flat().length} requisitions
            </span>
            <span className="text-2xl">{expandedYears.has(year) ? '▼' : '▶'}</span>
          </button>

          {/* Months within Year */}
          {expandedYears.has(year) && Object.keys(groupedRequisitions[year]).map(month => {
            const monthKey = `${year}-${month}`;
            const requisitions = groupedRequisitions[year][month];
            
            return (
              <div key={monthKey} className="ml-8 mb-4">
                {/* Month Folder */}
                <button
                  onClick={() => toggleMonth(monthKey)}
                  className="w-full flex items-center gap-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl px-6 py-3 shadow-md hover:shadow-lg transition-all mb-3"
                >
                  <span className="text-2xl">{expandedMonths.has(monthKey) ? '📂' : '📁'}</span>
                  <span className="text-xl font-bold">{month}</span>
                  <span className="ml-auto text-base font-semibold bg-white/20 px-3 py-1 rounded-full">
                    {requisitions.length} requisitions
                  </span>
                  <span className="text-xl">{expandedMonths.has(monthKey) ? '▼' : '▶'}</span>
                </button>

                {/* Requisitions in Month */}
                {expandedMonths.has(monthKey) && (
                  <div className="ml-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
                    {requisitions.map(r => (
          <div key={r.id} className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-md hover:shadow-xl transition-all hover:border-indigo-300">
            {/* Header with Avatar and Status */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-lg border-2 border-indigo-200">
                  {initials(r.requesterUsername || 'U')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{r.title || '(Untitled)'}</div>
                  <div className="text-xs text-slate-600 truncate">by {r.requesterName || r.requesterUsername}</div>
                </div>
              </div>
              <span className={statusStyle(r.status)}>{r.status}</span>
            </div>

            {/* Details Grid */}
            <div className="space-y-3 mb-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-600 uppercase">Fund</div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">{r.fund || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-600 uppercase">Needed By</div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">{r.neededBy || '—'}</div>
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-600 uppercase">Approver</div>
                <div className="text-sm font-semibold text-indigo-700 mt-1">
                  {approverLabel(r.requiredApproverRole)}
                  {r.requiredApproverUsername ? ` - ${r.requiredApproverUsername}` : ''}
                </div>
              </div>
            </div>

            {/* Amount and Items Count */}
            <div className="flex items-end justify-between mb-5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
              <div>
                <div className="text-xs font-bold text-slate-600 uppercase">Items</div>
                <div className="text-2xl font-bold text-slate-900">{r.items?.length || 0}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-slate-600 uppercase">Total</div>
                <div className="text-3xl font-extrabold text-indigo-700">{formatCurrency(r.totalAmount || 0, settings.currency || 'USD')}</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button 
                className="flex-1 px-4 py-2.5 rounded-lg border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition text-base" 
                onClick={()=>setEditing(r)}
              >
                Open
              </button>
              {r.status === 'draft' && (
                <button 
                  className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition text-base" 
                  onClick={()=>onSubmit(r)}
                >
                  Submit
                </button>
              )}
            </div>
          </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {!loading && Object.keys(groupedRequisitions).length === 0 && (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-xl font-bold text-slate-700 mb-2">No requisitions found</p>
          <p className="text-slate-500">Try adjusting your filters or create a new requisition</p>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            {/* Header - Fixed */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-6 text-white flex items-center justify-between flex-shrink-0 shadow-lg">
              <div>
                <div className="text-sm font-semibold tracking-widest uppercase text-white/80">Requisition Form</div>
                <h3 className="text-3xl font-extrabold tracking-tight mt-1">{editing.title || 'New Requisition'}</h3>
                <div className="text-sm mt-2 text-white/70">ID: <span className="font-mono bg-white/20 px-2 py-1 rounded">{editing.id.slice(0,8).toUpperCase()}</span></div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <span className={statusStyle(editing.status)}>{editing.status}</span>
                <button onClick={()=>setEditing(null)} className="text-white/80 hover:text-white text-2xl font-light">✕</button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1 p-8">
              {/* Document Info Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8 bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Requester</label>
                  <div className="text-lg font-bold text-slate-900 mt-1">{currentUser.username}</div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Date</label>
                  <input type="date" className="w-full text-lg font-semibold border-2 border-slate-300 rounded-xl px-4 py-3 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white" value={editing.dateCreated||''} onChange={e=>setEditing({...editing, dateCreated: e.target.value})} disabled={editing.status !== 'draft'} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Approver</label>
                  <div className="text-lg font-semibold text-indigo-700 mt-1">{approverLabel(editing.requiredApproverRole)}{editing.requiredApproverUsername ? ` - ${editing.requiredApproverUsername}` : ''}</div>
                </div>
              </div>

              {/* Main Form Fields */}
              <div className="space-y-5 mb-8">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Full Name *</label>
                  <input
                    className="w-full text-lg border-2 border-slate-300 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white placeholder-slate-400"
                    placeholder="Requester's full name"
                    value={editing.requesterName || ''}
                    onChange={e=>setEditing({...editing, requesterName: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Fund/Category</label>
                    <input className="w-full text-lg border-2 border-slate-300 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white placeholder-slate-400" placeholder="e.g., General Fund" value={editing.fund||''} onChange={e=>setEditing({...editing, fund: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Needed By</label>
                    <input type="date" className="w-full text-lg border-2 border-slate-300 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white" value={editing.neededBy||''} onChange={e=>setEditing({...editing, neededBy: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Purchase Type</label>
                    <select
                      className="w-full text-lg border-2 border-slate-300 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                      value={editing.purchaseType || 'routine'}
                      onChange={e=>setEditing({...editing, purchaseType: e.target.value as any})}
                    >
                      <option value="routine">Routine Purchase</option>
                      <option value="adhoc">Adhoc Purchase</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Intended For (Approver) *</label>
                    <select 
                      className="w-full text-lg border-2 border-slate-300 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                      value={editing.intendedFor||''} 
                      onChange={e=>setEditing({...editing, intendedFor: e.target.value})}
                    >
                      <option value="">-- Select Approver --</option>
                      {getAllApproverOptions().map(opt => (
                        <option key={opt.name} value={opt.name}>{opt.name} ({opt.role})</option>
                      ))}
                    </select>
                    {editing.intendedFor && !validateApproverForAmount(editing.intendedFor, editing.totalAmount || 0).valid && (
                      <div className="mt-4 bg-gradient-to-br from-rose-50 via-red-50 to-orange-50 rounded-xl border-2 border-rose-300 p-4 shadow-md">
                        <div className="flex items-start gap-3">
                          <span className="text-3xl mt-1">⚠️</span>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-rose-900 uppercase tracking-wide">Approver Limit Exceeded</p>
                            <p className="text-sm text-rose-800 mt-2 font-semibold">{validateApproverForAmount(editing.intendedFor, editing.totalAmount || 0).message}</p>
                            <p className="text-xs text-rose-700 mt-3 bg-white/40 rounded-lg px-3 py-2 backdrop-blur-sm">💡 Please select a different approver or reduce the total amount to proceed.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Title</label>
                  <input className="w-full text-lg border-2 border-slate-300 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white placeholder-slate-400" placeholder="Brief title of purchase" value={editing.title} onChange={e=>setEditing({...editing, title: e.target.value})} />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Purpose</label>
                  <textarea className="w-full text-lg border-2 border-slate-300 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white placeholder-slate-400 resize-none" rows={4} placeholder="Detailed explanation of the purchase..." value={editing.purpose||''} onChange={e=>setEditing({...editing, purpose: e.target.value})} />
                </div>
              </div>

              {/* Items Section */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-slate-300 p-6 mb-8">
                <div className="flex items-center justify-between mb-5">
                  <h4 className="text-2xl font-bold text-slate-900">Items ({(editing.items||[]).length})</h4>
                  <button onClick={addItem} className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:shadow-lg transition text-lg">+ Add Item</button>
                </div>

                {/* Added Items - Collapsible List */}
                {(editing.items||[]).length > 0 && (
                  <div className="mb-6">
                    <button
                      onClick={() => setItemsExpanded(!itemsExpanded)}
                      className="w-full flex items-center justify-between bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl px-5 py-3 border-2 border-indigo-300 hover:shadow-md transition mb-4"
                    >
                      <span className="text-lg font-bold text-indigo-900">Added Items ({(editing.items||[]).length})</span>
                      <span className="text-2xl text-indigo-700">{itemsExpanded ? '▼' : '▶'}</span>
                    </button>

                    {itemsExpanded && (
                      <div className="space-y-4 max-h-96 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                        {(editing.items||[]).map((it, idx) => (
                          <div key={it.id} className="bg-white rounded-xl border-2 border-slate-200 p-5 hover:border-indigo-300 transition">
                            {editingItemId === it.id ? (
                              // Edit Mode
                              <div>
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                                  <div className="sm:col-span-5">
                                    <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Description</label>
                                    <input className="w-full text-lg border-2 border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white" placeholder="Item name" value={it.description} onChange={e=>updateItem(it.id,{description:e.target.value})} />
                                  </div>
                                  <div className="sm:col-span-2">
                                    <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Qty</label>
                                    <input type="number" min={0} step="0.01" className="w-full text-lg border-2 border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white" value={it.qty} onChange={e=>updateItem(it.id,{qty: parseFloat(e.target.value) || 0})} />
                                  </div>
                                  <div className="sm:col-span-3">
                                    <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Unit Price</label>
                                    <input type="number" min={0} step="0.01" className="w-full text-lg border-2 border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white" value={it.unitPrice} onChange={e=>updateItem(it.id,{unitPrice: parseFloat(e.target.value) || 0})} />
                                  </div>
                                  <div className="sm:col-span-2">
                                    <button onClick={()=>setEditingItemId(null)} className="w-full bg-green-100 text-green-700 hover:bg-green-200 font-bold rounded-lg py-3 transition">✓ Done</button>
                                  </div>
                                </div>
                                <div className="mt-4 text-right bg-indigo-50 rounded-lg px-4 py-3 border border-indigo-200">
                                  <span className="text-sm text-slate-600">Item Total: {it.qty} × {it.unitPrice} =</span>
                                  <span className="text-xl font-extrabold text-indigo-700 ml-2">{formatCurrency((it.qty||0)*(it.unitPrice||0), settings.currency || 'USD')}</span>
                                </div>
                              </div>
                            ) : (
                              // View Mode
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <p className="text-lg font-bold text-slate-900">{it.description || '(No description)'}</p>
                                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                                    <span>Qty: <strong className="text-slate-900">{it.qty}</strong></span>
                                    <span>×</span>
                                    <span>Unit Price: <strong className="text-slate-900">{formatCurrency(it.unitPrice || 0, settings.currency || 'USD')}</strong></span>
                                    <span>=</span>
                                    <span className="text-lg font-extrabold text-indigo-700">{formatCurrency((it.qty||0)*(it.unitPrice||0), settings.currency || 'USD')}</span>
                                  </div>
                                </div>
                                <div className="ml-4 flex gap-2">
                                  <button onClick={()=>setEditingItemId(it.id)} className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-bold rounded-lg transition">✎ Edit</button>
                                  <button onClick={()=>removeItem(it.id)} className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 font-bold rounded-lg transition">✕ Remove</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(editing.items||[]).length === 0 && (
                  <div className="py-8 text-center text-slate-500 text-lg">
                    No items yet. Click "Add Item" to get started.
                  </div>
                )}

                {/* Grand Total */}
                <div className="mt-6 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl px-6 py-4 border-2 border-indigo-300">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-900">GRAND TOTAL</span>
                    <span className="text-4xl font-extrabold text-indigo-700">{formatCurrency(editing.totalAmount||0, settings.currency || 'USD')}</span>
                  </div>
                </div>
              </div>

              {/* Signature Section */}
              {editing.status === 'submitted' && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-300 p-6 mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">✍️</span>
                    <h4 className="text-2xl font-bold text-slate-900">Approval Signature Required</h4>
                  </div>
                  <p className="text-slate-600 mb-4">Please sign below to approve this requisition. You can also enter your name as an alternative.</p>
                  
                  {/* Signature Pad */}
                  <div className="mb-4">
                    <label className="text-sm font-bold text-slate-700 mb-2 block">Draw Your Signature:</label>
                    <div className="border-2 border-amber-400 rounded-xl overflow-hidden bg-white" style={{ touchAction: 'none' }}>
                      <canvas
                        ref={signatureCanvasRef}
                        width={800}
                        height={200}
                        className="w-full cursor-crosshair"
                        style={{ maxHeight: '200px' }}
                        onMouseDown={(e) => {
                          const canvas = signatureCanvasRef.current;
                          if (!canvas) return;
                          const rect = canvas.getBoundingClientRect();
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;
                          setIsDrawing(true);
                          const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                          const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                          ctx.beginPath();
                          ctx.moveTo(x, y);
                        }}
                        onMouseMove={(e) => {
                          if (!isDrawing) return;
                          const canvas = signatureCanvasRef.current;
                          if (!canvas) return;
                          const rect = canvas.getBoundingClientRect();
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;
                          const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                          const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                          ctx.lineTo(x, y);
                          ctx.strokeStyle = '#1e40af';
                          ctx.lineWidth = 2;
                          ctx.lineCap = 'round';
                          ctx.lineJoin = 'round';
                          ctx.stroke();
                          setHasSignature(true);
                        }}
                        onMouseUp={() => setIsDrawing(false)}
                        onMouseLeave={() => setIsDrawing(false)}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          const canvas = signatureCanvasRef.current;
                          if (!canvas) return;
                          const rect = canvas.getBoundingClientRect();
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;
                          const touch = e.touches[0];
                          setIsDrawing(true);
                          const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
                          const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
                          ctx.beginPath();
                          ctx.moveTo(x, y);
                        }}
                        onTouchMove={(e) => {
                          e.preventDefault();
                          if (!isDrawing) return;
                          const canvas = signatureCanvasRef.current;
                          if (!canvas) return;
                          const rect = canvas.getBoundingClientRect();
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;
                          const touch = e.touches[0];
                          const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
                          const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
                          ctx.lineTo(x, y);
                          ctx.strokeStyle = '#1e40af';
                          ctx.lineWidth = 2;
                          ctx.lineCap = 'round';
                          ctx.lineJoin = 'round';
                          ctx.stroke();
                          setHasSignature(true);
                        }}
                        onTouchEnd={() => setIsDrawing(false)}
                      />
                    </div>
                    <button
                      onClick={() => {
                        const canvas = signatureCanvasRef.current;
                        if (!canvas) return;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        setHasSignature(false);
                      }}
                      className="mt-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-semibold"
                    >
                      Clear Signature
                    </button>
                  </div>

                  {/* Name Input (Alternative) */}
                  <div>
                    <label className="text-sm font-bold text-slate-700 mb-2 block">Or Enter Your Name:</label>
                    <input 
                      type="text" 
                      placeholder="Enter your full name" 
                      className="w-full text-lg border-2 border-amber-300 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white placeholder-slate-400"
                      value={editing.signatureName || ''}
                      onChange={(e) => setEditing({...editing, signatureName: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {/* Completion Attachment */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-slate-300 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-2xl font-bold text-slate-900">Completion Attachment</h4>
                  <span className="text-sm text-slate-600 bg-white px-3 py-1 rounded-lg font-semibold">Available after approval</span>
                </div>
                {canAttachCompletion(editing.status) ? (
                  <div className="space-y-4">
                    {editing.completionAttachmentUrl ? (
                      <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 text-lg text-emerald-700 font-semibold">
                        ✓ Attachment saved. <a className="text-emerald-600 underline hover:text-emerald-700" href={editing.completionAttachmentUrl} target="_blank" rel="noreferrer">View</a>
                      </div>
                    ) : (
                      <div className="text-lg text-slate-600">No attachment yet.</div>
                    )}
                    <label className="inline-flex items-center gap-3 text-lg font-bold text-indigo-700 cursor-pointer hover:text-indigo-800">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleAttachmentChange(e.target.files?.[0])}
                        disabled={attachmentUploading}
                        className="hidden"
                      />
                      <span className="bg-indigo-100 hover:bg-indigo-200 px-4 py-2 rounded-lg transition">📸 {attachmentUploading ? 'Uploading...' : 'Upload completion photo'}</span>
                    </label>
                  </div>
                ) : (
                  <div className="text-lg text-slate-600">Complete the approval before attaching a photo.</div>
                )}
              </div>
            </div>

            {/* Action Buttons - Fixed */}
            <div className="flex justify-end gap-3 p-6 bg-slate-50 border-t border-slate-200 flex-shrink-0 flex-wrap">
              <button onClick={()=>setEditing(null)} className="px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition text-lg">Cancel</button>
              {editing.status === 'draft' && (
                <button onClick={()=>downloadRequisitionPdf({ requisition: editing, settings })} className="px-6 py-3 rounded-xl border-2 border-slate-400 text-slate-700 font-bold hover:bg-slate-100 transition text-lg">📋 PDF</button>
              )}
              <button onClick={onSave} className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition text-lg">💾 Save</button>
              {editing.status==='draft' && <button onClick={()=>onSubmit(editing)} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition text-lg">✓ Submit</button>}
              {canAttachCompletion(editing.status) && editing.completionAttachmentUrl && editing.status !== 'closed' && (
                <button onClick={markComplete} className="px-6 py-3 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-900 transition text-lg">🏁 Mark Complete</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
