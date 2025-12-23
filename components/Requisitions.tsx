import React, { useEffect, useMemo, useState } from 'react';
import type { Requisition, RequisitionItem, RequisitionStatus, Settings, User } from '../types';
import { getSupabaseClient, loadRequisitions, saveRequisition, submitRequisition } from '../services/supabase';

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
  const supabase = getSupabaseClient(settings.supabaseUrl, settings.supabaseKey);

  const refresh = async () => {
    if (!settings.supabaseUrl || !settings.supabaseKey) return;
    const data = await loadRequisitions(settings.supabaseUrl, settings.supabaseKey);
    setList(data);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Requisitions</h2>
          <p className="text-slate-500">Create and track purchase requests</p>
        </div>
        <div className="flex gap-3">
          <input className="border rounded-lg px-3 py-2" placeholder="Search..." value={q} onChange={e=>setQ(e.target.value)} />
          <select className="border rounded-lg px-3 py-2" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)}>
            <option value="all">All</option>
            {['draft','submitted','approved','rejected','funded','paid','closed'].map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={()=>setEditing(emptyReq(currentUser.username))} className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-lg">New Requisition</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="py-2">Title</th>
              <th className="py-2">Requester</th>
              <th className="py-2">Fund</th>
              <th className="py-2">Needed By</th>
              <th className="py-2 text-right">Total</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t">
                <td className="py-2 font-semibold">{r.title}</td>
                <td className="py-2">{r.requesterUsername}</td>
                <td className="py-2">{r.fund || '-'}</td>
                <td className="py-2">{r.neededBy || '-'}</td>
                <td className="py-2 text-right">{r.totalAmount.toFixed(2)}</td>
                <td className="py-2"><span className="px-2 py-1 rounded bg-slate-100 border text-slate-700 capitalize">{r.status}</span></td>
                <td className="py-2 text-right space-x-2">
                  <button className="px-3 py-1 rounded border" onClick={()=>setEditing(r)}>Open</button>
                  {r.status === 'draft' && <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={()=>onSubmit(r.id)}>Submit</button>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-slate-500">No requisitions</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">{editing.title ? 'Edit Requisition' : 'New Requisition'}</h3>
              <button onClick={()=>setEditing(null)} className="text-slate-600 hover:text-black">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-600">Title</label>
                <input className="w-full border rounded-lg px-3 py-2" value={editing.title} onChange={e=>setEditing({...editing, title: e.target.value})} />
              </div>
              <div>
                <label className="text-sm text-slate-600">Fund/Category</label>
                <input className="w-full border rounded-lg px-3 py-2" value={editing.fund||''} onChange={e=>setEditing({...editing, fund: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-slate-600">Purpose</label>
                <textarea className="w-full border rounded-lg px-3 py-2" rows={2} value={editing.purpose||''} onChange={e=>setEditing({...editing, purpose: e.target.value})} />
              </div>
              <div>
                <label className="text-sm text-slate-600">Needed By</label>
                <input type="date" className="w-full border rounded-lg px-3 py-2" value={editing.neededBy||''} onChange={e=>setEditing({...editing, neededBy: e.target.value})} />
              </div>
              <div className="text-right font-semibold self-end">Total: {editing.totalAmount.toFixed(2)}</div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold">Items</h4>
                <button onClick={addItem} className="px-3 py-1 rounded bg-slate-800 text-white">Add Item</button>
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
                      <td><input className="w-full border rounded px-2 py-1" value={it.description} onChange={e=>updateItem(it.id,{description:e.target.value})} /></td>
                      <td><input type="number" min={0} step="0.01" className="w-24 border rounded px-2 py-1" value={it.qty} onChange={e=>updateItem(it.id,{qty: parseFloat(e.target.value) || 0})} /></td>
                      <td><input type="number" min={0} step="0.01" className="w-28 border rounded px-2 py-1" value={it.unitPrice} onChange={e=>updateItem(it.id,{unitPrice: parseFloat(e.target.value) || 0})} /></td>
                      <td className="text-right w-28 pr-2">{(it.qty*it.unitPrice).toFixed(2)}</td>
                      <td className="text-right"><button onClick={()=>removeItem(it.id)} className="text-rose-600">Remove</button></td>
                    </tr>
                  ))}
                  {(editing.items||[]).length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center text-slate-500">No items yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={()=>setEditing(null)} className="px-4 py-2 rounded border">Cancel</button>
              <button onClick={onSave} className="px-4 py-2 rounded bg-indigo-600 text-white">Save</button>
              {editing.status==='draft' && <button onClick={()=>onSubmit(editing.id)} className="px-4 py-2 rounded bg-green-600 text-white">Submit</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
