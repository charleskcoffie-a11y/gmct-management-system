import React, { useEffect, useRef, useState } from 'react';
import type { ApprovalDecision, Requisition, RequisitionApproval, Settings, User } from '../types';
import { decideRequisition, loadRequisitions } from '../services/supabase';
import { formatCurrency } from '../utils';
import { useToast } from './ToastProvider';

type Props = {
  settings: Settings;
  currentUser: User;
  onDecisionSaved?: () => Promise<void> | void;
};

export default function MyApprovals({ settings, currentUser, onDecisionSaved }: Props) {
  const { showToast } = useToast();
  const [pending, setPending] = useState<Requisition[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const [signatureName, setSignatureName] = useState<Record<string, string>>({});
  const [signatureConfirmed, setSignatureConfirmed] = useState<Record<string, boolean>>({});
  const [isDrawing, setIsDrawing] = useState<Record<string, boolean>>({});
  const [hasDrawnSignature, setHasDrawnSignature] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [decisionSaving, setDecisionSaving] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const signatureCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  const canApprove = (req: Requisition) => {
    if (req.requesterUsername === currentUser.username) return false;
    if (req.requiredApproverUsername && req.requiredApproverUsername !== currentUser.username) return false;
    if (currentUser.role === 'admin') return true;
    if (!req.requiredApproverRole) return true;
    return req.requiredApproverRole === currentUser.role;
  };

  const refresh = async () => {
    if (!settings.supabaseUrl || !settings.supabaseKey) return;
    setLoading(true);
    try {
      const all = await loadRequisitions(settings.supabaseUrl, settings.supabaseKey);
      setPending(all.filter(r => r.status === 'submitted' && canApprove(r)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [settings.supabaseUrl, settings.supabaseKey]);

  const getCanvasPoint = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };

  const startDrawing = (id: string, clientX: number, clientY: number) => {
    const canvas = signatureCanvasRefs.current[id];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(canvas, clientX, clientY);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(prev => ({ ...prev, [id]: true }));
  };

  const draw = (id: string, clientX: number, clientY: number) => {
    if (!isDrawing[id]) return;
    const canvas = signatureCanvasRefs.current[id];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(canvas, clientX, clientY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasDrawnSignature(prev => ({ ...prev, [id]: true }));
  };

  const stopDrawing = (id: string) => {
    if (!isDrawing[id]) return;
    setIsDrawing(prev => ({ ...prev, [id]: false }));
  };

  const clearSignaturePad = (id: string) => {
    const canvas = signatureCanvasRefs.current[id];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(prev => ({ ...prev, [id]: false }));
  };

  const act = async (req: Requisition, decision: ApprovalDecision) => {
    if (decisionSaving[req.id]) return;
    if (!settings.supabaseUrl || !settings.supabaseKey) return;
    if (req.requesterUsername === currentUser.username) {
      alert('Requester cannot approve their own requisition.');
      return;
    }
    if (req.requiredApproverUsername && req.requiredApproverUsername !== currentUser.username) {
      alert('This requisition is assigned to a different approver.');
      return;
    }
    const signature = (signatureName[req.id] || '').trim();
    const hasDrawn = !!hasDrawnSignature[req.id];
    if (!signature && !hasDrawn) {
      alert('Please draw your signature or enter your name before approving.');
      return;
    }
    if (!signatureConfirmed[req.id]) {
      alert('Please confirm the approval signature before saving.');
      return;
    }
    const approval: RequisitionApproval = {
      id: crypto.randomUUID(),
      requisitionId: req.id,
      approverUsername: currentUser.username,
      approverRole: currentUser.role as any,
      decision,
      note: note[req.id] || '',
      signatureName: signature || `${currentUser.username} (drawn signature)`,
      signatureAt: new Date().toISOString(),
    };
    setDecisionSaving(prev => ({ ...prev, [req.id]: true }));
    try {
      await decideRequisition(settings.supabaseUrl, settings.supabaseKey, approval, decision);
      await refresh();
      if (onDecisionSaved) {
        await onDecisionSaved();
      }
      showToast(`Requisition ${decision === 'approved' ? 'saved and approved' : 'saved and rejected'} successfully.`, 'success', 4000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save the requisition decision.';
      console.error('Failed to save requisition decision:', error);
      alert(`Could not ${decision === 'approved' ? 'approve' : 'reject'} this requisition. ${message}`);
    } finally {
      setDecisionSaving(prev => ({ ...prev, [req.id]: false }));
    }
  };

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const initials = (name: string) => name.trim().split(' ').filter(Boolean).map(p=>p[0]).join('').slice(0,2).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Approvals</h2>
          <p className="text-slate-500">Review and approve submitted requisitions assigned to you</p>
        </div>
        <button 
          onClick={refresh} 
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          <span>🔄</span>
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {pending.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">⚠️</div>
            <div>
              <div className="font-bold text-amber-900">
                {pending.length} Requisition{pending.length > 1 ? 's' : ''} Awaiting Your Approval
              </div>
              <div className="text-sm text-amber-700">
                Please review and take action on the pending requisitions below
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading && Array.from({length:6}).map((_,i)=> (
          <div key={i} className="rounded-2xl border bg-white p-5 shadow-sm animate-pulse">
            <div className="h-4 w-2/3 bg-slate-200 rounded mb-3" />
            <div className="h-3 w-1/2 bg-slate-200 rounded mb-6" />
            <div className="h-24 bg-slate-100 rounded" />
          </div>
        ))}

        {!loading && pending.map(r => (
          <div key={r.id} className="rounded-2xl border-2 border-amber-200 bg-white p-5 shadow-lg hover:shadow-xl transition-all">
            {/* Assignment Badge */}
            <div className="mb-3 flex items-center gap-2 flex-wrap">
              {r.requisitionNumber && (
                <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold tracking-wide">
                  {r.requisitionNumber}
                </div>
              )}
              {r.requiredApproverUsername === currentUser.username && (
                <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold">
                  🎯 ASSIGNED TO YOU
                </div>
              )}
            </div>
            
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg border-2 border-amber-300">
                  {initials(r.requesterUsername || 'U')}
                </div>
                <div className="flex-1">
                  <div className="text-base font-bold text-slate-900 leading-tight">{r.title || '(Untitled)'}</div>
                  <div className="text-xs text-slate-500 mt-0.5">by {r.requesterName || r.requesterUsername}</div>
                  {r.dateCreated && (
                    <div className="text-xs text-slate-400 mt-0.5">📅 {new Date(r.dateCreated).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => toggle(r.id)} 
                className="ml-2 px-3 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
              >
                {expanded[r.id] ? '▲ Hide' : '▼ Details'}
              </button>
            </div>
            
            {r.purpose && (
              <div className="mb-3 text-sm text-slate-600 italic bg-slate-50 p-2 rounded-lg">
                "{r.purpose}"
              </div>
            )}
            
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm bg-gradient-to-r from-slate-50 to-blue-50 p-3 rounded-lg">
              <div className="space-y-1">
                <div className="text-slate-500 text-xs">Fund/Category</div>
                <div className="font-semibold text-slate-900">{r.fund || '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Total Amount</div>
                <div className="text-xl font-extrabold text-emerald-600 tracking-tight">{formatCurrency(r.totalAmount || 0, settings.currency || 'USD')}</div>
              </div>
            </div>
            
            {r.neededBy && (
              <div className="mt-2 text-xs text-orange-600 font-semibold bg-orange-50 px-3 py-2 rounded-lg flex items-center gap-2">
                <span>⏰</span>
                <span>Needed by: {new Date(r.neededBy).toLocaleDateString()}</span>
              </div>
            )}
            {expanded[r.id] && (
              <div className="mt-4 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 overflow-hidden">
                <div className="bg-indigo-600 text-white px-4 py-2 font-bold text-sm">
                  Requisition Items ({(r.items||[]).length})
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-700 bg-indigo-100">
                      <th className="px-3 py-2 font-semibold">Description</th>
                      <th className="px-3 py-2 font-semibold text-center">Qty</th>
                      <th className="px-3 py-2 font-semibold text-right">Unit Price</th>
                      <th className="px-3 py-2 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {(r.items||[]).map((it, idx) => (
                      <tr key={it.id} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="px-3 py-2 text-slate-900">{it.description}</td>
                        <td className="px-3 py-2 text-center font-semibold">{it.qty}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(it.unitPrice||0, settings.currency || 'USD')}</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-600">{formatCurrency((it.qty||0)*(it.unitPrice||0), settings.currency || 'USD')}</td>
                      </tr>
                    ))}
                    {(r.items||[]).length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-500 italic">No items added</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-emerald-100 to-green-100 border-t-2 border-emerald-300">
                      <td colSpan={3} className="px-3 py-2 text-right font-bold text-slate-900">Grand Total:</td>
                      <td className="px-3 py-2 text-right font-extrabold text-lg text-emerald-700">{formatCurrency(r.totalAmount || 0, settings.currency || 'USD')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div className="mt-4 space-y-3 bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-xl border-2 border-slate-200">
              <div className="font-bold text-slate-700 text-sm mb-2">📝 Approval Action</div>
              <textarea 
                className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition" 
                placeholder="Add a note or comment (optional)..." 
                rows={2}
                value={note[r.id]||''} 
                onChange={e=>setNote(prev=>({...prev,[r.id]: e.target.value}))} 
              />

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Draw signature:</label>
                <div className="border-2 border-indigo-300 rounded-lg overflow-hidden bg-white" style={{ touchAction: 'none' }}>
                  <canvas
                    ref={(el) => { signatureCanvasRefs.current[r.id] = el; }}
                    width={700}
                    height={160}
                    className="w-full h-32 cursor-crosshair"
                    onMouseDown={(e) => startDrawing(r.id, e.clientX, e.clientY)}
                    onMouseMove={(e) => draw(r.id, e.clientX, e.clientY)}
                    onMouseUp={() => stopDrawing(r.id)}
                    onMouseLeave={() => stopDrawing(r.id)}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      const t = e.touches[0];
                      startDrawing(r.id, t.clientX, t.clientY);
                    }}
                    onTouchMove={(e) => {
                      e.preventDefault();
                      const t = e.touches[0];
                      draw(r.id, t.clientX, t.clientY);
                    }}
                    onTouchEnd={() => stopDrawing(r.id)}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {hasDrawnSignature[r.id] ? '✓ Signature captured' : 'Draw above or enter your name below'}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearSignaturePad(r.id)}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
                  >
                    Clear
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <input
                  className="border-2 border-indigo-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition"
                  placeholder="Enter your full name for approval signature"
                  value={signatureName[r.id] || ''}
                  onChange={e=>setSignatureName(prev=>({...prev,[r.id]: e.target.value}))}
                />
                <label className="flex items-center gap-3 text-sm text-slate-700 bg-white px-3 py-2 rounded-lg border-2 border-slate-300 cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={!!signatureConfirmed[r.id]}
                    onChange={e=>setSignatureConfirmed(prev=>({...prev,[r.id]: e.target.checked}))}
                  />
                  <span className="font-semibold">I confirm this approval signature and take responsibility for this decision</span>
                </label>
              </div>
              
              <div className="mt-4 flex items-center gap-3 pt-3 border-t-2 border-slate-300">
                <button 
                  className={`flex-1 px-4 py-3 rounded-xl text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${decisionSaving[r.id] ? 'bg-emerald-300 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 hover:shadow-xl'}`}
                  onClick={()=>act(r, 'approved')}
                  disabled={!!decisionSaving[r.id]}
                >
                  <span>✓</span>
                  <span>{decisionSaving[r.id] ? 'Saving...' : 'Approve'}</span>
                </button>
                <button 
                  className={`flex-1 px-4 py-3 rounded-xl text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${decisionSaving[r.id] ? 'bg-rose-300 cursor-not-allowed' : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 hover:shadow-xl'}`}
                  onClick={()=>act(r, 'rejected')}
                  disabled={!!decisionSaving[r.id]}
                >
                  <span>✕</span>
                  <span>{decisionSaving[r.id] ? 'Saving...' : 'Reject'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && pending.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50 p-12 text-center">
          <div className="text-7xl mb-4">✅</div>
          <div className="text-2xl font-bold text-slate-900 mb-2">All Clear!</div>
          <div className="text-slate-600">You have no pending requisition approvals at this time.</div>
          <div className="text-sm text-slate-500 mt-2">Check back later or click refresh to see new submissions.</div>
        </div>
      )}
    </div>
  );
}
