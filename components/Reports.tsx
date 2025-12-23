// components/Reports.tsx
import React, { useMemo, useState } from 'react';
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
}

const Reports: React.FC<ReportsProps> = ({ entries, harvestEntries, members, settings, history, setHistory, setEntries }) => {
  const today = new Date().toISOString().slice(0, 10);

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

  const exportFilteredFinancials = () => {
    const filteredEntries = combinedEntries.filter(entry => {
      if (startDate && entry.date < startDate) return false;
      if (endDate && entry.date > endDate) return false;
      if (!selectedTypes.has('all') && !selectedTypes.has(entry.type)) return false;
      const member = membersById.get(entry.memberID);
      if (!selectedClasses.has('all') && (!member || !member.classNumber || !selectedClasses.has(member.classNumber))) return false;
      return true;
    });

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
        // move to next year
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
    <div className="flex flex-col space-y-10 pb-12 max-w-6xl">
      <div>
        <h2 className="inline-block text-3xl font-extrabold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-6 py-3 rounded-xl shadow-lg">📑 Reports</h2>
        <p className="text-base text-slate-600 mt-3 font-medium">Generate financial CSVs and manage weekly service history.</p>
      </div>

      {/* Financial Records & Reports */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-lg border-2 border-indigo-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
          <h3 className="text-lg font-bold text-white">📊 Financial Records & Reports</h3>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Filters Column */}
          <div className="lg:col-span-2 space-y-6">
            <h4 className="font-bold text-indigo-800 uppercase text-sm">🔍 Filter Report Data</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-indigo-800 mb-2">📅 Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border-2 border-indigo-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"/>
              </div>
              <div>
                <label className="block text-sm font-bold text-indigo-800 mb-2">📅 End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border-2 border-indigo-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"/>
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-bold text-indigo-800 mb-2">💷 Contribution Type</legend>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => handleTypeChange('all')}
                  className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-all ${selectedTypes.has('all') ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50'}`}
                >
                  All Types
                </button>
                {entryTypes.map(type => (
                  <button 
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border-2 capitalize transition-all ${selectedTypes.has(type) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50'}`}
                  >
                    {type.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-bold text-indigo-800 mb-2">📚 Class</legend>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => handleClassChange('all')}
                  className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-all ${selectedClasses.has('all') ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50'}`}
                >
                  All Classes
                </button>
                {classNumbers.slice(1).map(cls => (
                  <button 
                    key={cls}
                    onClick={() => handleClassChange(cls)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-all ${selectedClasses.has(cls) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50'}`}
                  >
                    Class {cls}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {/* Actions Column */}
          <div className="flex flex-col gap-4 border-l-2 border-indigo-200 pl-8">
            <h4 className="font-bold text-indigo-800 uppercase text-sm">⚡ Actions</h4>

            <button onClick={exportFilteredFinancials} className="bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 border-2 border-indigo-400">
              <DownloadIcon />
              Generate Report CSV
            </button>

            <label className="bg-white hover:bg-indigo-50 text-indigo-700 font-bold py-3 px-4 rounded-lg border-2 border-indigo-300 shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-all">
              <UploadIcon />
              Import Financial CSV
              <input type="file" accept=".csv" className="hidden" onChange={handleImportEntries} />
            </label>

            <div className="mt-4 pt-4 border-t-2 border-indigo-200">
              <label className="block text-sm font-bold text-indigo-800 mb-2">✉️ Email Report To</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="treasurer@gmct.org"
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  className="flex-1 min-w-0 border-2 border-indigo-300 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                />
                <button 
                  onClick={() => window.location.href = `mailto:${emailTo}?subject=Financial Report&body=Please attach the generated CSV.`}
                  className="bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all border-2 border-blue-400"
                >
                  📧 Email
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly History Manager */}
      <div>
        <WeeklyHistory history={history} setHistory={setHistory} />
      </div>

      {/* Upcoming Birthdays */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg border-2 border-blue-200 overflow-hidden">
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
    </div>
  );
};

export default Reports;
