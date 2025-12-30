import React, { useEffect, useMemo, useState, useRef } from 'react';
import type { ETransfer, Settings } from '../types';
import { toCsv } from '../utils';
import { loadETransfersFromSupabase, markETransferReconciled } from '../services/supabase';
import { createClient } from '@supabase/supabase-js';

interface ETransfersProps {
  settings: Settings;
}

const ETransfers: React.FC<ETransfersProps> = ({ settings }) => {
  const [items, setItems] = useState<ETransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [showOnlyUnreconciled, setShowOnlyUnreconciled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const canLoad = !!settings.supabaseUrl && !!settings.supabaseKey;

  const fetchItems = async () => {
    if (!canLoad) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await loadETransfersFromSupabase(settings.supabaseUrl, settings.supabaseKey);
      setItems(rows);
      // Mark all current items as seen
      rows.forEach(r => seenIdsRef.current.add(r.id));
    } catch (e: any) {
      setError(e?.message || 'Failed to load e-transfers');
    } finally {
      setLoading(false);
    }
  };

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          setNotificationsEnabled(true);
        }
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  // Subscribe to real-time e-transfer updates
  useEffect(() => {
    if (!canLoad || !notificationsEnabled) return;

    const supabase = createClient(settings.supabaseUrl, settings.supabaseKey);

    const subscription = supabase
      .channel('etransfers-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'etransfers' }, (payload) => {
        const newTransfer = {
          id: payload.new.id,
          receivedAt: payload.new.received_at,
          amount: payload.new.amount,
          currency: payload.new.currency,
          senderName: payload.new.sender_name,
          senderEmail: payload.new.sender_email,
          memo: payload.new.memo,
          rawSubject: payload.new.raw_subject,
          rawText: payload.new.raw_text,
          reconciled: payload.new.reconciled,
          createdAt: payload.new.created_at,
        } as ETransfer;

        // Only notify if this is a new transfer (not seen before)
        if (!seenIdsRef.current.has(newTransfer.id)) {
          seenIdsRef.current.add(newTransfer.id);

          // Add to UI
          setItems(prev => [newTransfer, ...prev]);

          // Send browser notification
          if ('Notification' in window) {
            new Notification('💰 New E-Transfer Received', {
              body: `${newTransfer.senderName || 'Unknown'}: ${newTransfer.currency || 'CAD'} ${newTransfer.amount?.toFixed(2) || '0.00'}`,
              tag: 'etransfer-' + newTransfer.id,
              requireInteraction: false,
              icon: '💰',
            });
          }
        }
      })
      .subscribe();

    subscriptionRef.current = subscription;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [canLoad, notificationsEnabled, settings.supabaseUrl, settings.supabaseKey]);

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

  const stats = useMemo(() => {
    const total = filtered.reduce((sum, r) => sum + (r.amount || 0), 0);
    const unreconciled = filtered.filter(r => !r.reconciled).length;
    const lastReceived = filtered.length ? filtered.map(r => r.receivedAt).sort().slice(-1)[0] : null;
    return { total, unreconciled, lastReceived };
  }, [filtered]);

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
      <div className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-2xl p-6 shadow-lg border border-indigo-500/40">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-wide text-indigo-100 font-semibold">E-Transfers</p>
            <h2 className="text-3xl font-extrabold">Incoming Notifications</h2>
            <p className="text-indigo-100 text-sm">Monitor Interac e-Transfer emails captured by your inbound webhook.</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${canLoad ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {canLoad ? 'Cloud connected' : 'Connect Supabase to sync'}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${notificationsEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-400/40 text-white'}`}>
                <span className={`inline-block w-2 h-2 rounded-full ${notificationsEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}></span>
                {notificationsEnabled ? 'Push notifications active' : 'Push notifications disabled'}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/20 text-white">Webhook: /functions/v1/etransfer-inbound</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchItems}
              disabled={!canLoad || loading}
              className={`px-4 py-2 rounded-xl text-sm font-bold border-2 bg-white text-indigo-700 hover:-translate-y-0.5 transition shadow ${(!canLoad || loading) ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-lg'}`}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className={`px-4 py-2 rounded-xl text-sm font-bold border-2 border-white/60 bg-white/10 text-white backdrop-blur hover:bg-white/20 transition ${filtered.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {!canLoad && (
        <div className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-800">
          Connect Supabase in Settings to load e-transfer data.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs uppercase font-bold text-slate-500">Total amount (filtered)</p>
          <p className="text-2xl font-extrabold text-slate-800 mt-1">{(settings.currency || 'CAD')} {stats.total.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs uppercase font-bold text-slate-500">Unreconciled</p>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">{stats.unreconciled}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs uppercase font-bold text-slate-500">Last received</p>
          <p className="text-base font-semibold text-slate-800 mt-1">{stats.lastReceived ? new Date(stats.lastReceived).toLocaleString() : '—'}</p>
        </div>
      </div>

      <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-md">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search name, email, memo, subject"
              className="w-full sm:w-80 border-2 border-slate-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
              <input type="checkbox" className="h-4 w-4" checked={showOnlyUnreconciled} onChange={e => setShowOnlyUnreconciled(e.target.checked)} />
              Only unreconciled
            </label>
          </div>
          <div className="text-sm text-slate-500">{filtered.length} result{filtered.length === 1 ? '' : 's'}</div>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-lg border-2 border-amber-300 bg-amber-50 text-amber-800 text-sm">{error}</div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-slate-700">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-bold tracking-wide">
              <tr>
                <th className="px-4 py-2">Received</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Sender</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Memo</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2 text-center">Reconciled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-indigo-50/40">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{new Date(r.receivedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{(r.currency || 'CAD') + ' ' + r.amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-800">{r.senderName || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.senderEmail || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{r.memo || '-'}</td>
                  <td className="px-4 py-3 text-slate-700 truncate max-w-[24ch]" title={r.rawSubject}>{r.rawSubject || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleReconciled(r.id, !r.reconciled)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${r.reconciled ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
                    >
                      {r.reconciled ? 'Reconciled' : 'Mark reconciled'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center text-slate-500 p-10 text-sm">No items match your filters.</div>
          )}
        </div>
      </div>

      <div className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-700 text-sm shadow-sm">
        <div className="font-bold mb-2 text-slate-900">Setup (one-time)</div>
        <ol className="list-decimal list-inside space-y-1 leading-relaxed">
          <li>Choose a provider (SendGrid, Mailgun, or Resend Inbound) and configure an inbound route/webhook to POST raw email data to your Supabase Function endpoint <code>/functions/v1/etransfer-inbound</code>.</li>
          <li>Set a secret token in the provider and the same value in Settings (E-Transfer Inbound Secret) so the function can validate requests.</li>
          <li>Forward Interac e-Transfer notifications from your mailbox (<em>Settings → E-Transfer Notification Email</em>) to the provider's inbound address.</li>
          <li className="mt-3 pt-3 border-t border-slate-300">
            <strong>🔔 Push Notifications:</strong> Allow browser notifications when prompted to receive instant alerts when new e-transfers arrive. Your browser will send a desktop notification with the sender name and amount.
          </li>
        </ol>
      </div>
    </div>
  );
};

export default ETransfers;
