import React, { useEffect, useMemo, useState } from 'react';
import type { ApprovalDecision, Requisition, RequisitionApproval, Settings, User } from '../types';
import { decideRequisition, loadRequisitions } from '../services/supabase';

type Props = {
  settings: Settings;
  currentUser: User;
};

export default function MyApprovals({ settings, currentUser }: Props) {
  const [pending, setPending] = useState<Requisition[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});

  const refresh = async () => {
    if (!settings.supabaseUrl || !settings.supabaseKey) return;
    const all = await loadRequisitions(settings.supabaseUrl, settings.supabaseKey);
    setPending(all.filter(r => r.status === 'submitted'));
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">My Approvals</h2>
        <p className="text-slate-500">Review and approve submitted requisitions</p>
      </div>
      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="py-2">Title</th>
              <th className="py-2">Requester</th>
              <th className="py-2">Fund</th>
              <th className="py-2 text-right">Total</th>
              <th className="py-2">Decision</th>
            </tr>
          </thead>
          <tbody>
            {pending.map(r => (
              <tr key={r.id} className="border-t">
                <td className="py-2 font-semibold">{r.title}</td>
                <td className="py-2">{r.requesterUsername}</td>
                <td className="py-2">{r.fund || '-'}</td>
                <td className="py-2 text-right">{r.totalAmount.toFixed(2)}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <input className="border rounded px-2 py-1" placeholder="Note (optional)" value={note[r.id]||''} onChange={e=>setNote(prev=>({...prev,[r.id]: e.target.value}))} />
                    <button className="px-3 py-1 rounded bg-emerald-600 text-white" onClick={()=>act(r, 'approved')}>Approve</button>
                    <button className="px-3 py-1 rounded bg-rose-600 text-white" onClick={()=>act(r, 'rejected')}>Reject</button>
                  </div>
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-slate-500">No pending approvals</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
