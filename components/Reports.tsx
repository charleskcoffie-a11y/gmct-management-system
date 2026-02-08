// components/Reports.tsx
import React, { useEffect, useMemo, useState } from 'react';
import type { Entry, Member, Settings, WeeklyHistoryRecord, EntryType, HarvestEntry } from '../types';
import { toCsv, sanitizeString, fromCsv, sanitizeEntry, sanitizeEntryType, formatMethod } from '../utils';
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
  const today = getTodayEST();
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
  const [specificDay, setSpecificDay] = useState('');

  const entryTypes = useMemo(() => Array.from(new Set(combinedEntries.map(e => e.type))), [combinedEntries]);
  const classNumbers = useMemo(() => ['all', ...Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1))], [settings.maxClasses]);
  const membersById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  const [selectedTypes, setSelectedTypes] = useState<Set<EntryType | 'all'>>(new Set(['all']));
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set(['all']));
  const [selectedDayBorns, setSelectedDayBorns] = useState<Set<string>>(new Set(['all']));
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<string>>(new Set(['all']));
  const dayBornOptions = useMemo(() => ['all', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], []);
  const weekdayOptions = useMemo(() => ['all', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], []);
  const weekdayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  // Keep weekday filter in sync when Day Born returns to "All"
  useEffect(() => {
    if (selectedDayBorns.has('all') && !selectedWeekdays.has('all')) {
      setSelectedWeekdays(new Set(['all']));
    }
  }, [selectedDayBorns, selectedWeekdays]);

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

  const handleDayBornChange = (day: string) => {
    const newSelection = new Set(selectedDayBorns);
    if (day === 'all') {
      newSelection.clear();
      newSelection.add('all');
    } else {
      newSelection.delete('all');
      const normalized = day.toLowerCase();
      if (newSelection.has(normalized)) newSelection.delete(normalized); else newSelection.add(normalized);
      if (newSelection.size === 0 || newSelection.size === dayBornOptions.length - 1) {
        newSelection.clear();
        newSelection.add('all');
      }
    }
    setSelectedDayBorns(newSelection);
  };

  const handleWeekdayChange = (day: string) => {
    const newSelection = new Set(selectedWeekdays);
    if (day === 'all') {
      newSelection.clear();
      newSelection.add('all');
    } else {
      newSelection.delete('all');
      const normalized = day.toLowerCase();
      if (newSelection.has(normalized)) newSelection.delete(normalized); else newSelection.add(normalized);
      if (newSelection.size === 0 || newSelection.size === weekdayOptions.length - 1) {
        newSelection.clear();
        newSelection.add('all');
      }
    }
    setSelectedWeekdays(newSelection);
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
      if (specificDay && entry.date !== specificDay) return false;
      const entryWeekday = (() => {
        const d = new Date(entry.date + 'T00:00:00');
        if (isNaN(d.getTime())) return undefined;
        return weekdayNames[d.getDay()];
      })();
      if (!selectedWeekdays.has('all') && (!entryWeekday || !selectedWeekdays.has(entryWeekday))) return false;
      if (!selectedTypes.has('all') && !selectedTypes.has(entry.type)) return false;
      const member = membersById.get(entry.memberID);
      if (!selectedClasses.has('all') && (!member || !member.classNumber || !selectedClasses.has(member.classNumber))) return false;
      const memberDayBorn = member?.dayBorn ? member.dayBorn.toLowerCase() : undefined;
      if (!selectedDayBorns.has('all') && (!memberDayBorn || !selectedDayBorns.has(memberDayBorn))) return false;
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
        Method: formatMethod(entry.method || 'other'),
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

  // Upcoming Birthdays (Current month start through end of next month; local time to avoid label drift)
  const startWindow = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  const endDateObj = useMemo(() => {
    const start = startWindow;
    // Last day of next month (local)
    return new Date(start.getFullYear(), start.getMonth() + 2, 0);
  }, [startWindow]);

  const upcomingBirthdays = useMemo(() => {
    const list: {
      id: string;
      name: string;
      month: number;
      day: number;
      dateStr: string;
      classNumber?: string;
      email?: string;
      phone?: string;
      weekStartMs: number;
    }[] = [];

    members.forEach(m => {
      if (!m.dobMonth || !m.dobDay) return;
      const currentYear = startWindow.getFullYear();
      let bday = new Date(currentYear, m.dobMonth - 1, m.dobDay);
      const startMs = startWindow.getTime();
      const endMs = endDateObj.getTime();
      let bdayMs = bday.getTime();

      // If the birthday already passed in this window, roll forward a year so it stays in range.
      if (bdayMs < startMs) {
        bday = new Date(currentYear + 1, m.dobMonth - 1, m.dobDay);
        bdayMs = bday.getTime();
      }

      if (bdayMs >= startMs && bdayMs <= endMs) {
        const weekStart = new Date(bdayMs);
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday anchor

        list.push({
          id: m.id,
          name: m.name,
          month: m.dobMonth,
          day: m.dobDay,
          dateStr: new Date(bdayMs).toISOString().slice(0, 10),
          classNumber: m.classNumber,
          email: m.email,
          phone: m.phone,
          weekStartMs: weekStart.getTime(),
        });
      }
    });

    return list.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [members, startWindow, endDateObj]);

  const birthdaysByWeek = useMemo(() => {
    const grouped = new Map<number, { weekStartMs: number; birthdays: typeof upcomingBirthdays }>();

    upcomingBirthdays.forEach(b => {
      if (!grouped.has(b.weekStartMs)) {
        grouped.set(b.weekStartMs, { weekStartMs: b.weekStartMs, birthdays: [] });
      }
      grouped.get(b.weekStartMs)!.birthdays.push(b);
    });

    return Array.from(grouped.values())
      .map(group => ({
        ...group,
        birthdays: group.birthdays.sort((a, b) => a.dateStr.localeCompare(b.dateStr)),
      }))
      .sort((a, b) => a.weekStartMs - b.weekStartMs);
  }, [upcomingBirthdays]);

  const membersWithDobCount = useMemo(() => members.filter(m => m.dobMonth && m.dobDay).length, [members]);

  const dobPreview = useMemo(() => {
    return members
      .filter(m => m.dobMonth && m.dobDay)
      .map(m => ({
        id: m.id,
        name: m.name,
        dobMonth: m.dobMonth as number,
        dobDay: m.dobDay as number,
      }))
      .sort((a, b) => (a.dobMonth === b.dobMonth ? a.dobDay - b.dobDay : a.dobMonth - b.dobMonth))
      .slice(0, 10);
  }, [members]);

  useEffect(() => {
    console.debug('[Birthdays] window', {
      start: startWindow.toISOString(),
      end: endDateObj.toISOString(),
      eligibleMembers: membersWithDobCount,
      upcomingCount: upcomingBirthdays.length,
      upcomingBirthdays,
    });
  }, [startWindow, endDateObj, membersWithDobCount, upcomingBirthdays]);

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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border-2 border-indigo-200 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border-2 border-indigo-200 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Specific Day (optional)</label>
                  <input type="date" value={specificDay} onChange={e => setSpecificDay(e.target.value)} className="w-full border-2 border-indigo-200 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400" />
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div className="space-y-2">
                  <div className="text-sm font-bold text-slate-700">Day Born</div>
                  <div className="flex flex-wrap gap-2">
                    {dayBornOptions.map(day => (
                      <button
                        key={day}
                        onClick={() => handleDayBornChange(day)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-all ${selectedDayBorns.has(day) ? 'bg-cyan-600 text-white border-cyan-600 shadow-md' : 'border-cyan-200 text-cyan-700 bg-cyan-50 hover:bg-cyan-100'}`}
                      >
                        {day === 'all' ? 'All' : day.charAt(0).toUpperCase() + day.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-bold text-slate-700">Entry Day of Week</div>
                  <div className="flex flex-wrap gap-2">
                    {weekdayOptions.map(day => {
                      const disabled = selectedDayBorns.has('all');
                      return (
                        <button
                          key={day}
                          onClick={() => !disabled && handleWeekdayChange(day)}
                          className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-all ${selectedWeekdays.has(day) ? 'bg-cyan-600 text-white border-cyan-600 shadow-md' : 'border-cyan-200 text-cyan-700 bg-cyan-50 hover:bg-cyan-100'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          aria-disabled={disabled}
                        >
                          {day === 'all' ? 'All' : day.charAt(0).toUpperCase() + day.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500">Enable by selecting a specific Day Born above.</p>
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
            <h3 className="text-lg font-bold">🎉 Upcoming Birthdays (Current + Next Month)</h3>
            <p className="text-sm opacity-90">
              Range: {startWindow.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} (1st of this month) – {endDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </p>
            <p className="text-xs opacity-80">Members with DOB: {membersWithDobCount} · Showing: {upcomingBirthdays.length}</p>
          </div>
          <div className="p-6 space-y-6">
            <div className="bg-white/70 border border-blue-100 rounded-lg p-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-800">Debug: DOB Preview (first 10)</div>
              {dobPreview.length === 0 ? (
                <div>No members with dobMonth/dobDay found.</div>
              ) : (
                <ol className="list-decimal list-inside">
                  {dobPreview.map(d => (
                    <li key={d.id}>{d.name} — {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.dobMonth - 1]} {d.dobDay}</li>
                  ))}
                </ol>
              )}
            </div>
            {upcomingBirthdays.length === 0 ? (
              <div className="text-center text-slate-500 p-8">No upcoming birthdays in the current or next month.</div>
            ) : (
              birthdaysByWeek.map(week => {
                const sundayLabel = new Date(week.weekStartMs).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
                const saturday = new Date(week.weekStartMs);
                saturday.setDate(saturday.getDate() + 6);
                const saturdayLabel = saturday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

                return (
                  <div key={week.weekStartMs} className="bg-white border-2 border-blue-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-100 to-indigo-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="font-bold text-slate-800">Week of Sunday {sundayLabel}</div>
                      <div className="text-xs text-slate-600">Covers Sunday–Saturday: {sundayLabel} – {saturdayLabel}</div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-slate-700">
                        <thead className="text-slate-700 text-sm uppercase font-bold bg-white">
                          <tr>
                            <th className="px-6 py-3">Member</th>
                            <th className="px-6 py-3">Class</th>
                            <th className="px-6 py-3">Birthday</th>
                            <th className="px-6 py-3">Contact</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {week.birthdays.map(b => (
                            <tr key={b.id} className="hover:bg-blue-50 transition-colors">
                              <td className="px-6 py-3 font-semibold">{b.name}</td>
                              <td className="px-6 py-3">{b.classNumber || '-'}</td>
                              <td className="px-6 py-3">{new Date(b.dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</td>
                              <td className="px-6 py-3 text-sm text-slate-600">{b.email || b.phone || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
