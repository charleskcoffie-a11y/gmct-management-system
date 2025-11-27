
// components/Utilities.tsx
import React, { useState, useMemo } from 'react';
import type { Entry, Member, Settings, EntryType, WeeklyHistoryRecord } from '../types';
import { toCsv, sanitizeString, fromCsv, sanitizeEntry, sanitizeMember } from '../utils';
import { DownloadIcon, UploadIcon } from './icons';

interface UtilitiesProps {
    entries: Entry[];
    members: Member[];
    history: WeeklyHistoryRecord[];
    settings: Settings;
    setEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
    setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
}

const Utilities: React.FC<UtilitiesProps> = ({ entries, members, history, settings, setEntries, setMembers }) => {
    const today = new Date().toISOString().slice(0, 10);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState(today);
    const [emailTo, setEmailTo] = useState('');

    // --- Helpers for Filtering ---
    const entryTypes = useMemo(() => Array.from(new Set(entries.map(e => e.type))), [entries]);
    const classNumbers = useMemo(() => ['all', ...Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1))], [settings.maxClasses]);
    
    const [selectedTypes, setSelectedTypes] = useState<Set<EntryType | 'all'>>(new Set(['all']));
    const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set(['all']));

    const handleTypeChange = (type: EntryType | 'all') => {
        const newSelection = new Set(selectedTypes);
        if (type === 'all') {
            newSelection.clear();
            newSelection.add('all');
        } else {
            newSelection.delete('all');
            if (newSelection.has(type)) {
                newSelection.delete(type);
            } else {
                newSelection.add(type);
            }
            if(newSelection.size === 0 || newSelection.size === entryTypes.length) {
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
            if (newSelection.has(cls)) {
                newSelection.delete(cls);
            } else {
                newSelection.add(cls);
            }
            if(newSelection.size === 0 || newSelection.size === classNumbers.length - 1) {
                newSelection.clear();
                newSelection.add('all');
            }
        }
        setSelectedClasses(newSelection);
    };

    const membersById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

    // --- IMPORTS ---

    const handleImportMembers = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const rows = fromCsv(String(reader.result));
                const importedMembers = rows.map(r => sanitizeMember(r)).filter(m => m.name && m.name !== "Unnamed Member");
                
                // Check for duplicates
                const existingNames = new Set(members.map(m => m.name.toLowerCase()));
                const newMembers = importedMembers.filter(m => !existingNames.has(m.name.toLowerCase()));
                
                setMembers(prev => [...prev, ...newMembers]);
                alert(`Import Complete:\n- ${newMembers.length} new members added.\n- ${importedMembers.length - newMembers.length} duplicates skipped.`);
            } catch (e) {
                console.error(e);
                alert("Failed to parse CSV.");
            }
        };
        reader.readAsText(file);
        event.target.value = ""; 
    };

    const handleImportEntries = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const rows = fromCsv(String(reader.result));
                const importedEntries = rows.map(r => sanitizeEntry(r)).filter(e => e.amount > 0);
                setEntries(prev => [...prev, ...importedEntries]);
                alert(`Imported ${importedEntries.length} financial records successfully.`);
            } catch (e) {
                alert("Failed to parse CSV.");
            }
        };
        reader.readAsText(file);
        event.target.value = "";
    };


    // --- EXPORTS ---

    const generateAndDownloadCsv = (data: any[], filename: string) => {
         if (data.length === 0) {
            alert("No data to export.");
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
        const filteredEntries = entries.filter(entry => {
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
                Method: entry.method,
                Note: sanitizeString(entry.note),
            };
        });
        
        generateAndDownloadCsv(reportData, `Financial_Report_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
    };

    const exportMembers = () => {
        // Export specific columns that match the import template
        const exportData = members.map(m => ({
            name: m.name,
            classNumber: m.classNumber || '',
            memberNumber: m.memberNumber || '',
            id: m.id // Optional: Useful for system admin, ignored during import if not needed
        }));
        generateAndDownloadCsv(exportData, `Members_Directory_${today}.csv`);
    };

    const downloadMemberTemplate = () => {
        const headers = "name,classNumber,memberNumber";
        const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "gmct_members_template.csv";
        link.click();
        URL.revokeObjectURL(link.href);
    }
    
    const exportHistory = () => {
        // Flatten simple history for CSV
        const flatHistory = history.map(h => ({
            Date: h.dateOfService,
            Topic: h.sermonTopic,
            Officiant: h.officiant,
            TotalAttendance: h.attendance.men + h.attendance.women + h.attendance.children + h.attendance.visitors + h.attendance.catechumens,
            Men: h.attendance.men,
            Women: h.attendance.women,
            Children: h.attendance.children,
            Visitors: h.attendance.visitors
        }));
        generateAndDownloadCsv(flatHistory, `Weekly_History_Summary_${today}.csv`);
    }


    return (
        <div className="flex flex-col space-y-8 pb-12">
            <div>
                <h2 className="text-3xl font-bold text-slate-800">Utilities & Tools</h2>
                <p className="text-slate-500 mt-2">Manage data imports, exports, and generate reports.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 1. Member Utilities */}
                <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                             Member Directory
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-slate-600">Import new members from CSV or download a backup.</p>
                        
                        <div className="flex flex-wrap gap-4">
                            <label className="flex-1 min-w-[140px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-lg cursor-pointer flex justify-center items-center gap-2 transition-all">
                                <UploadIcon />
                                <span>Import CSV</span>
                                <input type="file" accept=".csv" className="hidden" onChange={handleImportMembers} />
                            </label>
                            <button onClick={exportMembers} className="flex-1 min-w-[140px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-3 px-4 rounded-lg flex justify-center items-center gap-2 transition-all border border-indigo-200">
                                <DownloadIcon />
                                <span>Export CSV</span>
                            </button>
                        </div>
                        
                        <div className="pt-2 border-t border-slate-100">
                            <button onClick={downloadMemberTemplate} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                </svg>
                                Download Import Template
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. History Utilities */}
                <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                             Weekly History
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                         <p className="text-sm text-slate-600">Download a summary log of all weekly services.</p>
                         <button onClick={exportHistory} className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-3 px-4 rounded-lg flex justify-center items-center gap-2 transition-all border border-indigo-200">
                            <DownloadIcon />
                            <span>Export History Log</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Financial Report Generator */}
            <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Financial Records & Reports</h3>
                </div>
                
                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Filters Column */}
                    <div className="lg:col-span-2 space-y-6">
                        <h4 className="font-semibold text-slate-700">Filter Report Data</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Start Date</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">End Date</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                            </div>
                        </div>

                         <fieldset>
                             <legend className="text-sm font-medium text-slate-600 mb-2">Contribution Type</legend>
                             <div className="flex flex-wrap gap-2">
                                 <button 
                                    onClick={() => handleTypeChange('all')}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${selectedTypes.has('all') ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}
                                >
                                    All Types
                                </button>
                                 {entryTypes.map(type => (
                                     <button 
                                        key={type}
                                        onClick={() => handleTypeChange(type)}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${selectedTypes.has(type) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}
                                    >
                                        {type}
                                    </button>
                                 ))}
                             </div>
                        </fieldset>

                        <fieldset>
                             <legend className="text-sm font-medium text-slate-600 mb-2">Class</legend>
                             <div className="flex flex-wrap gap-2">
                                <button 
                                    onClick={() => handleClassChange('all')}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${selectedClasses.has('all') ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}
                                >
                                    All Classes
                                </button>
                                {classNumbers.slice(1).map(cls => (
                                    <button 
                                        key={cls}
                                        onClick={() => handleClassChange(cls)}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${selectedClasses.has(cls) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}
                                    >
                                        Class {cls}
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                    </div>

                    {/* Actions Column */}
                    <div className="flex flex-col gap-4 border-l pl-0 lg:pl-8 border-slate-100">
                        <h4 className="font-semibold text-slate-700">Actions</h4>
                        
                        <button onClick={exportFilteredFinancials} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2">
                            <DownloadIcon />
                            Generate Report CSV
                        </button>

                        <label className="bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-lg border border-slate-300 shadow-sm cursor-pointer flex items-center justify-center gap-2 transition-all">
                            <UploadIcon />
                            Import Financial CSV
                            <input type="file" accept=".csv" className="hidden" onChange={handleImportEntries} />
                        </label>
                        
                        <div className="mt-4 pt-4 border-t border-slate-100">
                             <label className="block text-sm font-medium text-slate-600 mb-1">Email Report To</label>
                             <div className="flex gap-2">
                                <input
                                    type="email"
                                    placeholder="treasurer@gmct.org"
                                    value={emailTo}
                                    onChange={e => setEmailTo(e.target.value)}
                                    className="flex-1 min-w-0 border-slate-300 rounded-lg shadow-sm text-sm"
                                />
                                <button 
                                    onClick={() => window.location.href = `mailto:${emailTo}?subject=Financial Report&body=Please attach the generated CSV.`}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-bold"
                                >
                                    Email
                                </button>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

             {/* Danger Zone */}
            <div className="bg-red-50 p-6 rounded-xl border border-red-200 mt-8">
                <h3 className="text-xl font-bold text-red-800">Danger Zone</h3>
                <p className="text-red-700 mt-1 mb-4">These actions are permanent and cannot be undone.</p>
                <button 
                    onClick={() => {
                        if (window.confirm("Are you sure you want to clear ALL local data? This will not affect your cloud data but will log you out.")) {
                            localStorage.clear();
                            window.location.reload();
                        }
                    }}
                    className="bg-white text-red-600 border border-red-200 hover:bg-red-50 font-bold py-2 px-4 rounded-lg shadow-sm"
                >
                    Clear All Local Data & Logout
                </button>
            </div>
        </div>
    );
};

export default Utilities;
