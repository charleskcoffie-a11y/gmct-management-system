import React, { useEffect, useMemo, useState } from 'react';
import type { Requisition, RequisitionItem, RequisitionStatus, Settings, User } from '../types';
import { getSupabaseClient, loadRequisitions, saveRequisition, submitRequisition } from '../services/supabase';
import { formatCurrency } from '../utils';

type Props = {
  settings: Settings;
  currentUser: User;
};

const emptyReq = (username: string): Requisition => ({
  id: crypto.randomUUID(),
  requesterUsername: username,
  title: '',
  purpose: '',
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
  const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseKey);

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

  const filtered = useMemo(() => list.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (q && !(r.title.toLowerCase().includes(q.toLowerCase()) || (r.purpose||'').toLowerCase().includes(q.toLowerCase()))) return false;
    // Requesters see all for MVP; can restrict later
    return true;
  }), [list, statusFilter, q]);

  const addItem = () => {
    if (!editing) return;
    const item: RequisitionItem = { id: crypto.randomUUID(), requisitionId: editing.id, description: '', qty: 1, unitPrice: 0 };
    const items = [...(editing.items||[]), item];
    const total = items.reduce((s,i)=> s + (i.qty||0)*(i.unitPrice||0), 0);
    setEditing({ ...editing, items, totalAmount: total });
  };

  const updateItem = (id: string, patch: Partial<RequisitionItem>) => {
    if (!editing) return;
    const items = (editing.items||[]).map(i => i.id === id ? { ...i, ...patch } : i);
    const total = items.reduce((s,i)=> s + (Number(i.qty)||0)*(Number(i.unitPrice)||0), 0);
    setEditing({ ...editing, items, totalAmount: total });
  };

  const removeItem = (id: string) => {
    if (!editing) return;
    const items = (editing.items||[]).filter(i => i.id !== id);
    const total = items.reduce((s,i)=> s + (i.qty||0)*(i.unitPrice||0), 0);
    setEditing({ ...editing, items, totalAmount: total });
  };

  const onSave = async () => {
    if (!editing) return;
    if (!settings.supabaseUrl || !settings.supabaseKey) {
      alert('Cloud connection required. Configure Supabase in Settings.');
      return;
    }
    await saveRequisition(settings.supabaseUrl, settings.supabaseKey, editing);
    setEditing(null);
    await refresh();
  };

  const onSubmit = async (id: string) => {
    if (!settings.supabaseUrl || !settings.supabaseKey) return;
    await submitRequisition(settings.supabaseUrl, settings.supabaseKey, id);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Requisitions</h2>
          <p className="text-slate-500">Create, submit, and track purchase requests</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">🔎</span>
            <input className="border rounded-xl pl-8 pr-3 py-2 bg-white/90 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                   placeholder="Search title or purpose" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <select className="border rounded-xl px-3 py-2 bg-white/90 shadow-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)}>
            <option value="all">All statuses</option>
            {['draft','submitted','approved','rejected','funded','paid','closed'].map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={()=>setEditing(emptyReq(currentUser.username))}
                  className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 text-white font-bold px-4 py-2 rounded-xl shadow">
            New Requisition
          </button>
        </div>
      </div>

      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading && Array.from({length:6}).map((_,i)=> (
          <div key={i} className="rounded-2xl border bg-white p-5 shadow-sm animate-pulse">
            <div className="h-4 w-2/3 bg-slate-200 rounded mb-3" />
            <div className="h-3 w-1/2 bg-slate-200 rounded mb-6" />
            <div className="h-24 bg-slate-100 rounded" />
          </div>
        ))}

        {!loading && filtered.map(r => (
          <div key={r.id} className="rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold border border-indigo-200">
                  {initials(r.requesterUsername || 'U')}
                </div>
                <div>
                  <div className="text-base font-bold text-slate-900">{r.title || '(Untitled)'}</div>
                  <div className="text-xs text-slate-500">by {r.requesterUsername}</div>
                </div>
              </div>
              <span className={statusStyle(r.status)}>{r.status}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <div className="text-slate-500">Fund/Category</div>
                <div className="font-semibold">{r.fund || '—'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-500">Needed By</div>
                <div className="font-semibold">{r.neededBy || '—'}</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-slate-500 text-sm">Items: <span className="font-semibold text-slate-700">{r.items?.length || 0}</span></div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-lg font-extrabold tracking-tight">{formatCurrency(r.totalAmount || 0, settings.currency || 'USD')}</div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1.5 rounded-lg border hover:bg-slate-50" onClick={()=>setEditing(r)}>Open</button>
              {r.status === 'draft' && (
                <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" onClick={()=>onSubmit(r.id)}>Submit</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">
          No requisitions match your filters. Create a new one to get started.
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-0 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white/60 font-semibold">Requisition</div>
                  <h3 className="text-xl font-extrabold">{editing.title ? 'Edit Requisition' : 'New Requisition'}</h3>
                </div>
                <button onClick={()=>setEditing(null)} className="text-white/80 hover:text-white text-lg">✕</button>
              </div>
            </div>
            <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-slate-500">Requester: <span className="font-semibold text-slate-700">{currentUser.username}</span></div>
              <div className="text-sm">
                <span className={statusStyle(editing.status)}> {editing.status} </span>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <label className="text-sm text-slate-600">Title</label>
                <input className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" value={editing.title} onChange={e=>setEditing({...editing, title: e.target.value})} />
              </div>
              <div>
                <label className="text-sm text-slate-600">Fund/Category</label>
                <input className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" value={editing.fund||''} onChange={e=>setEditing({...editing, fund: e.target.value})} />
              </div>
              <div className="lg:col-span-3">
                <label className="text-sm text-slate-600">Purpose</label>
                <textarea className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" rows={2} value={editing.purpose||''} onChange={e=>setEditing({...editing, purpose: e.target.value})} />
              </div>
              <div>
                <label className="text-sm text-slate-600">Needed By</label>
                <input type="date" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" value={editing.neededBy||''} onChange={e=>setEditing({...editing, neededBy: e.target.value})} />
              </div>
              <div className="text-right font-semibold self-end lg:col-span-2">
                <div className="text-sm text-slate-500">Estimated Total</div>
                <div className="text-2xl font-extrabold">{formatCurrency(editing.totalAmount||0, settings.currency || 'USD')}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800">Items</h4>
                <button onClick={addItem} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-black">Add Item</button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600">
                    <th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {(editing.items||[]).map(it => (
                    <tr key={it.id} className="border-t">
                      <td><input className="w-full border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" value={it.description} onChange={e=>updateItem(it.id,{description:e.target.value})} /></td>
                      <td><input type="number" min={0} step="0.01" className="w-24 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" value={it.qty} onChange={e=>updateItem(it.id,{qty: parseFloat(e.target.value) || 0})} /></td>
                      <td><input type="number" min={0} step="0.01" className="w-28 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" value={it.unitPrice} onChange={e=>updateItem(it.id,{unitPrice: parseFloat(e.target.value) || 0})} /></td>
                      <td className="text-right w-28 pr-2 font-semibold">{formatCurrency((it.qty||0)*(it.unitPrice||0), settings.currency || 'USD')}</td>
                      <td className="text-right"><button onClick={()=>removeItem(it.id)} className="text-rose-600 hover:text-rose-700">Remove</button></td>
                    </tr>
                  ))}
                  {(editing.items||[]).length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center text-slate-500">No items yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={()=>setEditing(null)} className="px-4 py-2 rounded-xl border hover:bg-slate-50">Cancel</button>
              <button onClick={onSave} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">Save</button>
              {editing.status==='draft' && <button onClick={()=>onSubmit(editing.id)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">Submit</button>}
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
