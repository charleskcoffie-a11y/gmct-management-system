
// components/Utilities.tsx
import React, { useState, useMemo } from 'react';
import type { Entry, Member, Settings, WeeklyHistoryRecord, DevelopmentFundEntry } from '../types';
import { toCsv, sanitizeString, fromCsv, sanitizeEntry, sanitizeMember } from '../utils';
import { DownloadIcon, UploadIcon } from './icons';
import BackupSettings from './BackupSettings';

interface UtilitiesProps {
    entries: Entry[];
    members: Member[];
    history: WeeklyHistoryRecord[];
    developmentFund: DevelopmentFundEntry[];
    settings: Settings;
    setEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
    setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    setDevelopmentFund: React.Dispatch<React.SetStateAction<DevelopmentFundEntry[]>>;
}

const Utilities: React.FC<UtilitiesProps> = ({ entries, members, history, developmentFund, settings, setEntries, setMembers, setSettings, setDevelopmentFund }) => {
    const today = new Date().toISOString().slice(0, 10);
    const [showBackupSettings, setShowBackupSettings] = useState(false);

    // --- Helpers for Filtering ---
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

    const exportMembers = () => {
        // Export specific columns that match the import template
        const exportData = members.map(m => ({
            name: m.name,
            classNumber: m.classNumber || '',
            memberNumber: m.memberNumber || '',
            address: m.address || '',
            id: m.id // Optional: Useful for system admin, ignored during import if not needed
        }));
        generateAndDownloadCsv(exportData, `Members_Directory_${today}.csv`);
    };

    const downloadMemberTemplate = () => {
        const headers = "name,classNumber,memberNumber,address";
        const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "gmct_members_template.csv";
        link.click();
        URL.revokeObjectURL(link.href);
    }
    
    // Weekly History export moved to Reports tab

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
            console.log('Logo uploaded, size:', base64String.length, 'characters');
            setSettings(prev => {
                const updated = { ...prev, logoUrl: base64String };
                console.log('Settings updated with logo');
                return updated;
            });
            // Give a slight delay to ensure state updates
            setTimeout(() => {
                alert('Logo uploaded successfully! The logo should now appear in the header.');
            }, 100);
        };
        reader.onerror = () => {
            alert('Error reading file. Please try again.');
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

    const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file (PNG, JPG, etc.)');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('Signature image should be less than 2MB');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result as string;
            setSettings(prev => ({ ...prev, signatureImage: base64String }));
            setTimeout(() => alert('Signature uploaded successfully.'), 50);
        };
        reader.onerror = () => alert('Error reading file. Please try again.');
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const removeSignature = () => {
        if (confirm('Remove the stored signature?')) {
            setSettings(prev => ({ ...prev, signatureImage: undefined }));
            alert('Signature removed.');
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

                {/* Signature Upload Section */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-lg border-2 border-amber-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            ✍️ Authorized Signature
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-slate-600 font-medium">Upload an authorized signature for tax receipts and official documents.</p>
                        
                        {settings.signatureImage && (
                            <div className="bg-white p-4 rounded-lg border-2 border-amber-200 flex items-center justify-center">
                                <img src={settings.signatureImage} alt="Current Signature" className="max-h-24 max-w-full object-contain" />
                            </div>
                        )}
                        
                        <div className="flex flex-wrap gap-4">
                            <label className="flex-1 min-w-[140px] bg-gradient-to-br from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-3 px-4 rounded-lg cursor-pointer flex justify-center items-center gap-2 transition-all shadow-md border-2 border-amber-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                <span>{settings.signatureImage ? 'Change Signature' : 'Upload Signature'}</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                            </label>
                            {settings.signatureImage && (
                                <button onClick={removeSignature} className="flex-1 min-w-[140px] bg-white hover:bg-red-50 text-red-600 font-bold py-3 px-4 rounded-lg flex justify-center items-center gap-2 transition-all border-2 border-red-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span>Remove</span>
                                </button>
                            )}
                        </div>
                        
                        <div className="pt-3 border-t-2 border-amber-100">
                            <p className="text-xs text-slate-500 font-medium">
                                📌 Supported formats: PNG, JPG, GIF • Max size: 2MB
                            </p>
                        </div>
                    </div>
                </div>

                {/* Database Backup Section */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl shadow-lg border-2 border-blue-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            💾 Database Backup
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-slate-600 font-medium">Configure automatic backups and email delivery for critical data tables.</p>
                        
                        <button 
                            onClick={() => setShowBackupSettings(true)}
                            className="w-full bg-gradient-to-br from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 px-4 rounded-lg flex justify-center items-center gap-2 transition-all shadow-md border-2 border-blue-400"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m6 2a2 2 0 11-4 0 2 2 0 014 0zm0 0h.01M18 8a2 2 0 11-4 0 2 2 0 014 0zm0 0h.01M6 8a2 2 0 11-4 0 2 2 0 014 0zm0 0h.01M6 20v-2a3 3 0 00-3-3H3a3 3 0 00-3 3v2m18 0v-2a3 3 0 00-3-3h-.5a3 3 0 00-3 3v2M9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Configure Backup Settings
                        </button>
                        
                        <div className="pt-3 border-t-2 border-blue-100">
                            <p className="text-xs text-slate-500 font-medium">
                                ✓ Backs up Entries & Development Fund tables as JSON
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

                {/* Weekly History tools moved to Reports tab */}
            </div>



            {/* Financial report generator moved to Reports tab */}

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

            {/* Backup Settings Modal */}
            {showBackupSettings && (
                <BackupSettings 
                    entries={entries}
                    onClose={() => setShowBackupSettings(false)}
                />
            )}
        </div>
    );
};

export default Utilities;
