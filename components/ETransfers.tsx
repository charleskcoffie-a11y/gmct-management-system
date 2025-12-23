import React, { useEffect, useMemo, useState } from 'react';
import type { ETransfer, Settings } from '../types';
import { toCsv } from '../utils';
import { loadETransfersFromSupabase, markETransferReconciled } from '../services/supabase';

interface ETransfersProps {
  settings: Settings;
}

const ETransfers: React.FC<ETransfersProps> = ({ settings }) => {
  const [items, setItems] = useState<ETransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [showOnlyUnreconciled, setShowOnlyUnreconciled] = useState(false);

  const canLoad = !!settings.supabaseUrl && !!settings.supabaseKey;

  const fetchItems = async () => {
    if (!canLoad) return;
    setLoading(true);
    try {
      const rows = await loadETransfersFromSupabase(settings.supabaseUrl, settings.supabaseKey);
      setItems(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [settings.supabaseUrl, settings.supabaseKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(r => {
      if (showOnlyUnreconciled && r.reconciled) return false;
      if (!q) return true;
      return (
        (r.senderName || '').toLowerCase().includes(q) ||
        (r.senderEmail || '').toLowerCase().includes(q) ||
        (r.memo || '').toLowerCase().includes(q) ||
        (r.rawSubject || '').toLowerCase().includes(q)
      );
    });
  }, [items, query, showOnlyUnreconciled]);

  const exportCsv = () => {
    const rows = filtered.map(r => ({
      ReceivedAt: r.receivedAt,
      Amount: r.amount.toFixed(2),
      Currency: r.currency || 'CAD',
      SenderName: r.senderName || '',
      SenderEmail: r.senderEmail || '',
      Memo: r.memo || '',
      Subject: r.rawSubject || '',
      Reconciled: r.reconciled ? 'Yes' : 'No',
    }));
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'e-transfers.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const toggleReconciled = async (id: string, value: boolean) => {
    if (!canLoad) return;
    await markETransferReconciled(settings.supabaseUrl, settings.supabaseKey, id, value);
    setItems(prev => prev.map(x => x.id === id ? { ...x, reconciled: value } : x));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">E-Transfer Notifications</h2>
          <p className="text-sm text-slate-600">Incoming Interac e-Transfer emails forwarded via webhook.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 border-2 border-indigo-400 shadow">Export CSV</button>
          <button onClick={fetchItems} disabled={!canLoad || loading} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border-2 border-slate-300">Refresh</button>
        </div>
      </div>

      {!canLoad && (
        <div className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-800">
          Connect Supabase in Settings to load e-transfer data.
        </div>
      )}

      <div className="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-md">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, memo, subject" className="w-full sm:w-80 border-2 border-slate-200 rounded-lg py-2 px-3 text-sm" />
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="h-4 w-4" checked={showOnlyUnreconciled} onChange={e => setShowOnlyUnreconciled(e.target.checked)} />
            Show only unreconciled
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-slate-700">
            <thead className="bg-slate-100 text-slate-700 text-sm uppercase font-bold">
              <tr>
                <th className="px-4 py-2">Received</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Sender</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Memo</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Reconciled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-sm">{new Date(r.receivedAt).toLocaleString()}</td>
                  <td className="px-4 py-2 font-semibold">{(r.currency || 'CAD') + ' ' + r.amount.toFixed(2)}</td>
                  <td className="px-4 py-2 text-sm">{r.senderName || '-'}</td>
                  <td className="px-4 py-2 text-sm">{r.senderEmail || '-'}</td>
                  <td className="px-4 py-2 text-sm">{r.memo || '-'}</td>
                  <td className="px-4 py-2 text-sm truncate max-w-[24ch]" title={r.rawSubject}>{r.rawSubject || '-'}</td>
                  <td className="px-4 py-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4" checked={!!r.reconciled} onChange={e => toggleReconciled(r.id, e.target.checked)} />
                      {r.reconciled ? 'Yes' : 'No'}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center text-slate-500 p-8">No items to show.</div>
          )}
        </div>
      </div>

      <div className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-700 text-sm">
        <div className="font-bold mb-1">Setup (one-time):</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>Choose a provider (SendGrid, Mailgun, or Resend Inbound) and configure an inbound route/webhook to POST raw email data to your Supabase Function endpoint <code>/functions/v1/etransfer-inbound</code>.</li>
          <li>Set a secret token in the provider and the same value in Settings (E-Transfer Inbound Secret) so the function can validate requests.</li>
          <li>Forward Interac e-Transfer notifications from your mailbox (<em>Settings → E-Transfer Notification Email</em>) to the provider’s inbound address.</li>
        </ol>
      </div>
    </div>
  );
};

export default ETransfers;
