import React, { useState } from 'react';
import type { Entry } from '../types';

interface BackupSettingsProps {
    entries: Entry[];
    onClose: () => void;
}

const BackupSettings: React.FC<BackupSettingsProps> = ({ entries, onClose }) => {
    const [backupEmails, setBackupEmails] = useState<string[]>(() => {
        const saved = localStorage.getItem('gmct-backup-emails');
        return saved ? JSON.parse(saved) : [];
    });
    const [newEmail, setNewEmail] = useState('');
    const [backupDate, setBackupDate] = useState(() => {
        const saved = localStorage.getItem('gmct-backup-date');
        return saved || new Date().toISOString().split('T')[0];
    });
    const [backupTime, setBackupTime] = useState(() => {
        const saved = localStorage.getItem('gmct-backup-time');
        return saved || '09:00';
    });
    const [message, setMessage] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    const handleAddEmail = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (newEmail.trim() && emailRegex.test(newEmail.trim())) {
            if (!backupEmails.includes(newEmail.trim())) {
                const updated = [...backupEmails, newEmail.trim()];
                setBackupEmails(updated);
                localStorage.setItem('gmct-backup-emails', JSON.stringify(updated));
                setNewEmail('');
                setMessage('✓ Email added successfully');
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage('⚠ Email already added');
                setTimeout(() => setMessage(''), 3000);
            }
        } else {
            setMessage('⚠ Please enter a valid email address');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleRemoveEmail = (email: string) => {
        const updated = backupEmails.filter(e => e !== email);
        setBackupEmails(updated);
        localStorage.setItem('gmct-backup-emails', JSON.stringify(updated));
    };

    const handleSaveDateAndTime = () => {
        localStorage.setItem('gmct-backup-date', backupDate);
        localStorage.setItem('gmct-backup-time', backupTime);
        setMessage('✓ Backup schedule saved');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleExportBackup = () => {
        setIsExporting(true);
        try {
            const backupData = {
                exportDate: new Date().toISOString(),
                entries: entries.filter(e => !e.deleted),
                backupMetadata: {
                    totalEntries: entries.filter(e => !e.deleted).length,
                    generatedAt: new Date().toLocaleString()
                }
            };

            const dataStr = JSON.stringify(backupData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `gmct-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setMessage('✓ Backup downloaded successfully');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            setMessage('⚠ Error creating backup');
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setIsExporting(false);
        }
    };

    const handleCopyBackupJson = () => {
        try {
            const backupData = {
                exportDate: new Date().toISOString(),
                entries: entries.filter(e => !e.deleted),
                backupMetadata: {
                    totalEntries: entries.filter(e => !e.deleted).length,
                    generatedAt: new Date().toLocaleString()
                }
            };

            const dataStr = JSON.stringify(backupData, null, 2);
            navigator.clipboard.writeText(dataStr);
            setMessage('✓ Backup JSON copied to clipboard');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            setMessage('⚠ Error copying backup');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex justify-between items-center">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Database Backup Settings
                    </h2>
                    <button 
                        onClick={onClose}
                        className="text-white hover:bg-white/20 p-2 rounded-lg transition"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
                    {/* Status Message */}
                    {message && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 font-medium">
                            {message}
                        </div>
                    )}

                    {/* Backup Schedule */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-800 text-lg">📅 Backup Schedule</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-2">Backup Date</label>
                                <input 
                                    type="date" 
                                    value={backupDate}
                                    onChange={(e) => setBackupDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-600 mb-2">Backup Time</label>
                                <input 
                                    type="time" 
                                    value={backupTime}
                                    onChange={(e) => setBackupTime(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>
                        </div>
                        <button 
                            onClick={handleSaveDateAndTime}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                        >
                            Save Schedule
                        </button>
                    </div>

                    {/* Email Configuration */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-800 text-lg">📧 Backup Email Recipients</h3>
                        <p className="text-sm text-slate-600">Add at least 2 email addresses to receive backup files</p>
                        
                        <div className="flex gap-2">
                            <input 
                                type="email" 
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
                                placeholder="Enter email address"
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                            />
                            <button 
                                onClick={handleAddEmail}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
                            >
                                Add
                            </button>
                        </div>

                        {/* Email List */}
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {backupEmails.length > 0 ? (
                                backupEmails.map((email, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <span className="text-slate-700 font-medium">{email}</span>
                                        <button 
                                            onClick={() => handleRemoveEmail(email)}
                                            className="text-red-600 hover:text-red-800 font-bold text-lg"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 italic text-center py-3">No emails added yet</p>
                            )}
                        </div>
                        {backupEmails.length > 0 && (
                            <p className="text-sm text-green-600 font-medium">✓ {backupEmails.length} email(s) configured</p>
                        )}
                    </div>

                    {/* Backup Tables Info */}
                    <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 space-y-2">
                        <h4 className="font-bold text-indigo-900">📊 Backup Contents</h4>
                        <div className="text-sm text-indigo-800 space-y-1">
                            <p>✓ <strong>Entries Table:</strong> {entries.filter(e => !e.deleted).length} records</p>
                            <p>✓ <strong>Development Fund Entries:</strong> {entries.filter(e => !e.deleted && e.type === 'development-fund').length} records</p>
                            <p className="text-indigo-700 mt-2">Backup will be sent as JSON file to all registered emails</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-100 border-t border-slate-200 p-4 flex justify-between gap-2 flex-wrap">
                    <button 
                        onClick={handleCopyBackupJson}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
                        title="Copy backup JSON to clipboard for manual backup"
                    >
                        📋 Copy JSON
                    </button>
                    <button 
                        onClick={handleExportBackup}
                        disabled={isExporting}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                    >
                        {isExporting ? '⏳ Exporting...' : '⬇️ Download Backup'}
                    </button>
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BackupSettings;
