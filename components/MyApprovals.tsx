import React, { useEffect, useState } from 'react';
import type { ApprovalDecision, Requisition, RequisitionApproval, Settings, User } from '../types';
import { decideRequisition, loadRequisitions } from '../services/supabase';
import { formatCurrency } from '../utils';

type Props = {
  settings: Settings;
  currentUser: User;
};

export default function MyApprovals({ settings, currentUser }: Props) {
  const [pending, setPending] = useState<Requisition[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    if (!settings.supabaseUrl || !settings.supabaseKey) return;
    setLoading(true);
    try {
      const all = await loadRequisitions(settings.supabaseUrl, settings.supabaseKey);
      setPending(all.filter(r => r.status === 'submitted'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [settings.supabaseUrl, settings.supabaseKey]);

  const act = async (req: Requisition, decision: ApprovalDecision) => {
    if (!settings.supabaseUrl || !settings.supabaseKey) return;
    const approval: RequisitionApproval = {
      id: crypto.randomUUID(),
      requisitionId: req.id,
      approverUsername: currentUser.username,
      decision,
      note: note[req.id] || ''
    };
    await decideRequisition(settings.supabaseUrl, settings.supabaseKey, approval, decision);
    await refresh();
  };

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const initials = (name: string) => name.trim().split(' ').filter(Boolean).map(p=>p[0]).join('').slice(0,2).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Approvals</h2>
          <p className="text-slate-500">Review and approve submitted requisitions</p>
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

        {!loading && pending.map(r => (
          <div key={r.id} className="rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold border border-amber-200">
                  {initials(r.requesterUsername || 'U')}
                </div>
                <div>
                  <div className="text-base font-bold text-slate-900">{r.title || '(Untitled)'}</div>
                  <div className="text-xs text-slate-500">by {r.requesterUsername}</div>
                </div>
              </div>
              <button onClick={() => toggle(r.id)} className="text-xs text-slate-500 hover:text-slate-700">{expanded[r.id] ? 'Hide' : 'Details'}</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <div className="text-slate-500">Fund/Category</div>
                <div className="font-semibold">{r.fund || '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-lg font-extrabold tracking-tight">{formatCurrency(r.totalAmount || 0, settings.currency || 'USD')}</div>
              </div>
            </div>
            {expanded[r.id] && (
              <div className="mt-4 rounded-xl border bg-slate-50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-600">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Unit</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(r.items||[]).map(it => (
                      <tr key={it.id} className="border-t">
                        <td className="px-3 py-2">{it.description}</td>
                        <td className="px-3 py-2">{it.qty}</td>
                        <td className="px-3 py-2">{formatCurrency(it.unitPrice||0, settings.currency || 'USD')}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency((it.qty||0)*(it.unitPrice||0), settings.currency || 'USD')}</td>
                      </tr>
                    ))}
                    {(r.items||[]).length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-3 text-center text-slate-500">No items</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex items-center gap-2">
              <input className="flex-1 border rounded-lg px-3 py-2" placeholder="Note (optional)" value={note[r.id]||''} onChange={e=>setNote(prev=>({...prev,[r.id]: e.target.value}))} />
              <button className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" onClick={()=>act(r, 'approved')}>Approve</button>
              <button className="px-3 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700" onClick={()=>act(r, 'rejected')}>Reject</button>
            </div>
          </div>
        ))}
      </div>

      {!loading && pending.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">
          No pending approvals.
        </div>
      )}
    </div>
  );
}
