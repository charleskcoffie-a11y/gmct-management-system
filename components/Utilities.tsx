
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
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const Utilities: React.FC<UtilitiesProps> = ({ entries, members, history, settings, setEntries, setMembers, setSettings }) => {
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

    // --- LOGO UPLOAD ---
    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        // Check if file is an image
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file (PNG, JPG, etc.)');
            return;
        }
        
        // Check file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('Image size should be less than 2MB');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result as string;
            setSettings(prev => ({ ...prev, logoUrl: base64String }));
            alert('Logo uploaded successfully! Check the header to see your logo.');
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const removeLogo = () => {
        if (confirm('Are you sure you want to remove the logo?')) {
            setSettings(prev => ({ ...prev, logoUrl: undefined }));
            alert('Logo removed successfully!');
        }
    };


    return (
        <div className="flex flex-col space-y-8 pb-12 max-w-6xl">
            <div>
                <h2 className="inline-block text-3xl font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 rounded-xl shadow-lg">🛠️ Utilities & Tools</h2>
                <p className="text-base text-slate-600 mt-3 font-medium">Import & export data, generate financial reports, and manage backups.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Logo Upload Section */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-lg border-2 border-purple-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            🖼️ Organization Logo
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-slate-600 font-medium">Upload your organization's logo to display in the header.</p>
                        
                        {settings.logoUrl && (
                            <div className="bg-white p-4 rounded-lg border-2 border-purple-200 flex items-center justify-center">
                                <img src={settings.logoUrl} alt="Current Logo" className="max-h-24 max-w-full object-contain" />
                            </div>
                        )}
                        
                        <div className="flex flex-wrap gap-4">
                            <label className="flex-1 min-w-[140px] bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-4 rounded-lg cursor-pointer flex justify-center items-center gap-2 transition-all shadow-md border-2 border-purple-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                </svg>
                                <span>{settings.logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                            </label>
                            {settings.logoUrl && (
                                <button onClick={removeLogo} className="flex-1 min-w-[140px] bg-white hover:bg-red-50 text-red-600 font-bold py-3 px-4 rounded-lg flex justify-center items-center gap-2 transition-all border-2 border-red-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span>Remove</span>
                                </button>
                            )}
                        </div>
                        
                        <div className="pt-3 border-t-2 border-purple-100">
                            <p className="text-xs text-slate-500 font-medium">
                                📌 Supported formats: PNG, JPG, GIF • Max size: 2MB
                            </p>
                        </div>
                    </div>
                </div>
                
                {/* 1. Member Utilities */}
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl shadow-lg border-2 border-emerald-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-600 to-green-600 p-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            👥 Member Directory
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-slate-600 font-medium">Import new members from CSV or download a backup.</p>
                        
                        <div className="flex flex-wrap gap-4">
                            <label className="flex-1 min-w-[140px] bg-gradient-to-br from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold py-3 px-4 rounded-lg cursor-pointer flex justify-center items-center gap-2 transition-all shadow-md border-2 border-emerald-400">
                                <UploadIcon />
                                <span>Import CSV</span>
                                <input type="file" accept=".csv" className="hidden" onChange={handleImportMembers} />
                            </label>
                            <button onClick={exportMembers} className="flex-1 min-w-[140px] bg-white hover:bg-emerald-50 text-emerald-700 font-bold py-3 px-4 rounded-lg flex justify-center items-center gap-2 transition-all border-2 border-emerald-300">
                                <DownloadIcon />
                                <span>Export CSV</span>
                            </button>
                        </div>
                        
                        <div className="pt-3 border-t-2 border-emerald-100">
                            <button onClick={downloadMemberTemplate} className="text-sm text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-2 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                </svg>
                                📄 Download Import Template
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. History Utilities */}
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl shadow-lg border-2 border-cyan-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            📅 Weekly History
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                         <p className="text-sm text-slate-600 font-medium">Download a summary log of all weekly services.</p>
                         <button onClick={exportHistory} className="w-full bg-gradient-to-br from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-lg flex justify-center items-center gap-2 transition-all shadow-md border-2 border-cyan-400">
                            <DownloadIcon />
                            <span>📥 Export History Log</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Financial Report Generator */}
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

             {/* Danger Zone */}
            <div className="bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-xl border-2 border-red-300 shadow-lg">
                <h3 className="text-xl font-bold text-red-800">⚠️ Danger Zone</h3>
                <p className="text-red-700 mt-1 mb-4 font-medium">These actions are permanent and cannot be undone.</p>
                <button 
                    onClick={() => {
                        if (window.confirm("Are you sure you want to clear ALL local data? This will not affect your cloud data but will log you out.")) {
                            localStorage.clear();
                            window.location.reload();
                        }
                    }}
                    className="bg-white text-red-700 border-2 border-red-300 hover:bg-red-50 font-bold py-3 px-6 rounded-lg shadow-md transition-all"
                >
                    🗑️ Clear All Local Data & Logout
                </button>
            </div>
        </div>
    );
};

export default Utilities;
