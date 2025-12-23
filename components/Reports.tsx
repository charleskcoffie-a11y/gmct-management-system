// components/Reports.tsx
import React, { useEffect, useMemo, useState } from 'react';
import type { Entry, Member, Settings, WeeklyHistoryRecord, EntryType, HarvestEntry } from '../types';
import { toCsv, sanitizeString, fromCsv, sanitizeEntry, sanitizeEntryType } from '../utils';
import WeeklyHistory from './WeeklyHistory';
import { DownloadIcon, UploadIcon } from './icons';

interface ReportsProps {
  entries: Entry[];
  harvestEntries: HarvestEntry[];
  members: Member[];
  settings: Settings;
  history: WeeklyHistoryRecord[];
  setHistory: React.Dispatch<React.SetStateAction<WeeklyHistoryRecord[]>>;
  setEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
  targetSection?: 'financial' | 'weekly' | 'birthdays' | null;
  onConsumeTarget?: () => void;
}

const Reports: React.FC<ReportsProps> = ({ entries, harvestEntries, members, settings, history, setHistory, setEntries, targetSection, onConsumeTarget }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [activeSection, setActiveSection] = useState<'financial' | 'weekly' | 'birthdays'>('financial');

  const combinedEntries = useMemo(() => {
    const harvestedAsEntries: Entry[] = harvestEntries.map(h => ({
      id: h.id,
      date: h.date,
      memberID: h.memberID,
      memberName: h.memberName,
      classNumber: h.classNumber,
      type: 'harvest-levy',
      fund: 'harvest levy',
      method: 'other',
      amount: h.amount,
      note: h.note,
      createdAt: h.createdAt,
      deleted: h.deleted,
    }));

    return [...entries, ...harvestedAsEntries]
      .filter(e => !e.deleted)
      .map(e => ({ ...e, type: sanitizeEntryType(e.type) }));
  }, [entries, harvestEntries]);

  // Financial report generator state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(today);
  const [emailTo, setEmailTo] = useState('');

  const entryTypes = useMemo(() => Array.from(new Set(combinedEntries.map(e => e.type))), [combinedEntries]);
  const classNumbers = useMemo(() => ['all', ...Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1))], [settings.maxClasses]);
  const membersById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  const [selectedTypes, setSelectedTypes] = useState<Set<EntryType | 'all'>>(new Set(['all']));
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set(['all']));

  useEffect(() => {
    if (!targetSection) return;
    setActiveSection(targetSection);
    const id = targetSection === 'financial' ? 'financial-report-section' : targetSection === 'weekly' ? 'weekly-history-section' : 'upcoming-birthdays-section';
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    if (onConsumeTarget) onConsumeTarget();
  }, [targetSection, onConsumeTarget]);

  const handleTypeChange = (type: EntryType | 'all') => {
    const newSelection = new Set(selectedTypes);
    if (type === 'all') {
      newSelection.clear();
      newSelection.add('all');
    } else {
      newSelection.delete('all');
      if (newSelection.has(type)) newSelection.delete(type); else newSelection.add(type);
      if (newSelection.size === 0 || newSelection.size === entryTypes.length) {
        newSelection.clear();
        newSelection.add('all');
      }
    }
    setSelectedTypes(newSelection);
  };

  const handleClassChange = (cls: string) => {
    const newSelection = new Set(selectedClasses);
    if (cls === 'all') {
      newSelection.clear();
      newSelection.add('all');
    } else {
      newSelection.delete('all');
      if (newSelection.has(cls)) newSelection.delete(cls); else newSelection.add(cls);
      if (newSelection.size === 0 || newSelection.size === classNumbers.length - 1) {
        newSelection.clear();
        newSelection.add('all');
      }
    }
    setSelectedClasses(newSelection);
  };

  const generateAndDownloadCsv = (data: any[], filename: string) => {
    if (data.length === 0) {
      alert('No data to export.');
      return;
    }
    const csv = toCsv(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const getFilteredEntries = () => {
    return combinedEntries.filter(entry => {
      if (startDate && entry.date < startDate) return false;
      if (endDate && entry.date > endDate) return false;
      if (!selectedTypes.has('all') && !selectedTypes.has(entry.type)) return false;
      const member = membersById.get(entry.memberID);
      if (!selectedClasses.has('all') && (!member || !member.classNumber || !selectedClasses.has(member.classNumber))) return false;
      return true;
    });
  };

  const exportFilteredFinancials = () => {
    const filteredEntries = getFilteredEntries();

    const reportData = filteredEntries.map(entry => {
      const member = membersById.get(entry.memberID);
      return {
        Date: entry.date,
        MemberName: sanitizeString(entry.memberName),
        Class: member ? sanitizeString(member.classNumber) : 'N/A',
        Type: entry.type,
        Amount: entry.amount.toFixed(2),
        Method: entry.method || 'other',
        Note: sanitizeString(entry.note),
      };
    });

    generateAndDownloadCsv(reportData, `Financial_Report_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
  };

  const exportSummaryByType = () => {
    const filtered = getFilteredEntries();
    const summary = new Map<string, number>();
    filtered.forEach(entry => {
      summary.set(entry.type, (summary.get(entry.type) || 0) + entry.amount);
    });
    const data = Array.from(summary.entries()).map(([type, total]) => ({
      Type: type,
      TotalAmount: total.toFixed(2),
    }));
    generateAndDownloadCsv(data, `Financial_Summary_By_Type_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
  };

  const exportByClass = () => {
    const filtered = getFilteredEntries();
    const summary = new Map<string, number>();
    filtered.forEach(entry => {
      const member = membersById.get(entry.memberID);
      const cls = member?.classNumber || 'Unassigned';
      summary.set(cls, (summary.get(cls) || 0) + entry.amount);
    });
    const data = Array.from(summary.entries()).map(([cls, total]) => ({
      Class: cls,
      TotalAmount: total.toFixed(2),
    }));
    generateAndDownloadCsv(data, `Financial_By_Class_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
  };

  const filterPledgeEntries = () => getFilteredEntries().filter(e => e.type.toLowerCase().includes('pledge'));

  const exportPledges = () => {
    const pledges = filterPledgeEntries();
    const data = pledges.map(entry => {
      const member = membersById.get(entry.memberID);
      return {
        Date: entry.date,
        MemberName: sanitizeString(entry.memberName),
        Class: member ? sanitizeString(member.classNumber) : 'N/A',
        Type: entry.type,
        Amount: entry.amount.toFixed(2),
        Note: sanitizeString(entry.note),
      };
    });
    generateAndDownloadCsv(data, `Pledges_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
  };

  const exportPledgesByGroup = () => {
    const pledges = filterPledgeEntries();
    const summary = new Map<string, number>();
    pledges.forEach(entry => {
      const member = membersById.get(entry.memberID);
      const cls = member?.classNumber || 'Unassigned';
      summary.set(cls, (summary.get(cls) || 0) + entry.amount);
    });
    const data = Array.from(summary.entries()).map(([cls, total]) => ({
      Class: cls,
      TotalPledges: total.toFixed(2),
    }));
    generateAndDownloadCsv(data, `Pledges_By_Class_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
  };

  const handleImportEntries = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = fromCsv(String(reader.result));
        const importedEntries = rows.map(r => sanitizeEntry(r)).filter(e => e.amount > 0);
        const key = (e: Entry) => `${e.memberID}|${e.date}|${e.type}`;
        setEntries(prev => {
          const existingKeys = new Set(prev.filter(e => !e.deleted).map(key));
          const uniqueImported: Entry[] = [];
          const seen = new Set<string>();
          for (const e of importedEntries) {
            const k = key(e);
            if (!existingKeys.has(k) && !seen.has(k)) {
              uniqueImported.push(e);
              seen.add(k);
            }
          }
          const skipped = importedEntries.length - uniqueImported.length;
          if (skipped > 0) {
            alert(`Skipped ${skipped} duplicate record(s). Imported ${uniqueImported.length} new record(s).`);
          } else {
            alert(`Imported ${uniqueImported.length} financial record(s) successfully.`);
          }
          return [...prev, ...uniqueImported];
        });
      } catch (e) {
        alert('Failed to parse CSV.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const formatCurrency = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
    } catch {
      return amount.toFixed(2);
    }
  };

  // Upcoming Birthdays (Next 4 Weeks starting next Sunday)
  const nextSunday = (base: Date) => {
    const d = new Date(base);
    const day = d.getDay(); // 0=Sun
    if (day === 0) return d;
    d.setDate(d.getDate() + (7 - day));
    return d;
  };

  const startSunday = useMemo(() => nextSunday(new Date()), []);
  const endDateObj = useMemo(() => {
    const e = new Date(startSunday);
    e.setDate(e.getDate() + 27); // 4 weeks window
    return e;
  }, [startSunday]);

  const upcomingBirthdays = useMemo(() => {
    const list: { id: string; name: string; month: number; day: number; dateStr: string; week: number; classNumber?: string; email?: string; phone?: string }[] = [];
    members.forEach(m => {
      if (!m.dobMonth || !m.dobDay) return;
      const currentYear = startSunday.getFullYear();
      let bday = new Date(Date.UTC(currentYear, m.dobMonth - 1, m.dobDay));
      const startUTC = Date.UTC(startSunday.getFullYear(), startSunday.getMonth(), startSunday.getDate());
      const endUTC = Date.UTC(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate());
      let bdayUTC = Date.UTC(bday.getUTCFullYear(), bday.getUTCMonth(), bday.getUTCDate());
      if (bdayUTC < startUTC) {
        bday = new Date(Date.UTC(currentYear + 1, m.dobMonth - 1, m.dobDay));
        bdayUTC = Date.UTC(bday.getUTCFullYear(), bday.getUTCMonth(), bday.getUTCDate());
      }
      if (bdayUTC >= startUTC && bdayUTC <= endUTC) {
        const week = Math.floor((bdayUTC - startUTC) / (7 * 24 * 60 * 60 * 1000));
        list.push({
          id: m.id,
          name: m.name,
          month: m.dobMonth,
          day: m.dobDay,
          dateStr: new Date(bdayUTC).toISOString().slice(0, 10),
          week: Math.min(Math.max(week, 0), 3),
          classNumber: m.classNumber,
          email: m.email,
          phone: m.phone,
        });
      }
    });
    return list.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [members, startSunday, endDateObj]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">Reports</h2>
          <p className="text-sm text-slate-600">Pick a report to view or export.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 cursor-pointer">
          <UploadIcon className="h-4 w-4" />
          Import CSV
          <input type="file" accept=".csv" onChange={handleImportEntries} className="hidden" />
        </label>
      </div>

      <div className="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-md flex flex-wrap gap-2">
        <button
          onClick={() => setActiveSection('financial')}
          className={`px-4 py-2 rounded-lg font-bold text-sm border-2 transition-all ${activeSection === 'financial' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}
        >
          Financial Report
        </button>
        <button
          onClick={() => setActiveSection('weekly')}
          className={`px-4 py-2 rounded-lg font-bold text-sm border-2 transition-all ${activeSection === 'weekly' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}
        >
          Weekly History
        </button>
        <button
          onClick={() => setActiveSection('birthdays')}
          className={`px-4 py-2 rounded-lg font-bold text-sm border-2 transition-all ${activeSection === 'birthdays' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}
        >
          Upcoming Birthdays
        </button>
      </div>

      {activeSection === 'financial' && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-lg border-2 border-indigo-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
            <h3 className="text-lg font-bold text-white">📊 Financial Records & Reports</h3>
          </div>

          <div id="financial-report-section" className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border-2 border-indigo-200 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border-2 border-indigo-200 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Email To</label>
                  <input
                    type="email"
                    placeholder="treasurer@gmct.org"
                    value={emailTo}
                    onChange={e => setEmailTo(e.target.value)}
                    className="w-full border-2 border-indigo-200 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-bold text-slate-700">Entry Types</div>
                  <div className="flex flex-wrap gap-2">
                    {['all', ...entryTypes].map(type => (
                      <button
                        key={type}
                        onClick={() => handleTypeChange(type as EntryType | 'all')}
                        className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-all ${selectedTypes.has(type as EntryType | 'all') ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'}`}
                      >
                        {type === 'all' ? 'All' : type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-bold text-slate-700">Classes</div>
                  <div className="flex flex-wrap gap-2">
                    {classNumbers.map(cls => (
                      <button
                        key={cls}
                        onClick={() => handleClassChange(cls)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-all ${selectedClasses.has(cls) ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100'}`}
                      >
                        {cls === 'all' ? 'All' : `Class ${cls}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-slate-100 rounded-xl p-4 shadow-inner">
                <div className="flex flex-wrap gap-2">
                  <button onClick={exportFilteredFinancials} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all border-2 border-indigo-400">
                    <DownloadIcon className="h-4 w-4" />
                    Export CSV
                  </button>
                  <button onClick={exportSummaryByType} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all border-2 border-purple-400">
                    <DownloadIcon className="h-4 w-4" />
                    Export by Type
                  </button>
                  <button onClick={exportByClass} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all border-2 border-emerald-400">
                    <DownloadIcon className="h-4 w-4" />
                    Export by Class
                  </button>
                  <button onClick={exportPledges} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all border-2 border-amber-400">
                    <DownloadIcon className="h-4 w-4" />
                    Export Pledges
                  </button>
                  <button onClick={exportPledgesByGroup} className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all border-2 border-pink-400">
                    <DownloadIcon className="h-4 w-4" />
                    Export Pledges by Group
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border-2 border-indigo-100 shadow-inner p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600">Total Entries</span>
                <span className="text-lg font-extrabold text-indigo-700">{combinedEntries.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600">Total Amount</span>
                <span className="text-lg font-extrabold text-indigo-700">{formatCurrency(combinedEntries.reduce((sum, e) => sum + e.amount, 0), settings.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600">Total Classes</span>
                <span className="text-lg font-extrabold text-indigo-700">{classNumbers.length - 1}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600">Types Selected</span>
                <span className="text-lg font-extrabold text-indigo-700">{selectedTypes.has('all') ? 'All' : `${selectedTypes.size}`}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600">Classes Selected</span>
                <span className="text-lg font-extrabold text-indigo-700">{selectedClasses.has('all') ? 'All' : `${selectedClasses.size}`}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'weekly' && (
        <div id="weekly-history-section">
          <WeeklyHistory history={history} setHistory={setHistory} />
        </div>
      )}

      {activeSection === 'birthdays' && (
        <div id="upcoming-birthdays-section" className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg border-2 border-blue-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
            <h3 className="text-lg font-bold">🎉 Upcoming Birthdays (Next 4 Weeks)</h3>
            <p className="text-sm opacity-90">Starting Sunday {startSunday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="p-6">
            {upcomingBirthdays.length === 0 ? (
              <div className="text-center text-slate-500 p-8">No upcoming birthdays in the next four weeks.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-slate-700">
                  <thead className="bg-gradient-to-r from-blue-100 to-indigo-100 text-slate-700 text-sm uppercase font-bold">
                    <tr>
                      <th className="px-6 py-3">Member</th>
                      <th className="px-6 py-3">Class</th>
                      <th className="px-6 py-3">Birthday</th>
                      <th className="px-6 py-3">Week</th>
                      <th className="px-6 py-3">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {upcomingBirthdays.map(b => (
                      <tr key={b.id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-6 py-3 font-semibold">{b.name}</td>
                        <td className="px-6 py-3">{b.classNumber || '-'}</td>
                        <td className="px-6 py-3">{new Date(b.dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</td>
                        <td className="px-6 py-3"><span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">Week {b.week + 1}</span></td>
                        <td className="px-6 py-3 text-sm text-slate-600">{b.email || b.phone || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
