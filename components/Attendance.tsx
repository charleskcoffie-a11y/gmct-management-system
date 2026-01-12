
// components/Attendance.tsx
import React, { useState, useMemo, useEffect } from 'react';
import type { Member, AttendanceRecord, AttendanceStatus, User, Settings } from '../types';
import { sanitizeAttendanceStatus, sanitizeString, getTodayEST } from '../utils';
import BulkAttendanceModal from './BulkAttendanceModal';

interface AttendanceProps {
    members: Member[];
    attendance: AttendanceRecord[];
    setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
    currentUser: User;
    settings: Settings;
}

const Attendance: React.FC<AttendanceProps> = ({ members, attendance, setAttendance, currentUser, settings }) => {
    const [selectedDate, setSelectedDate] = useState(getTodayEST());
    const [classFilter, setClassFilter] = useState<string>('all');
    const [pendingChanges, setPendingChanges] = useState<Map<string, AttendanceStatus>>(new Map());
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    
    // UI Feedback State
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Reset pending changes when date or filter changes
    useEffect(() => {
        setPendingChanges(new Map());
        setSuccessMessage(null);
    }, [selectedDate, classFilter]);

    // Clear success message automatically
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);
    
    const classOptions = useMemo(() => {
        return ['all', ...Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1))];
    }, [settings.maxClasses]);

    const filteredMembers = useMemo(() => {
        if (currentUser.role !== 'admin' || classFilter === 'all') {
            return members;
        }
        return members.filter(m => m.classNumber === classFilter);
    }, [members, classFilter, currentUser.role]);

    const getStatusForMember = (memberId: string): AttendanceStatus => {
        // Show pending change if it exists
        if (pendingChanges.has(memberId)) {
            return pendingChanges.get(memberId)!;
        }
        // Otherwise, show the saved status
        const record = attendance.find(r => r.date === selectedDate);
        const status = record?.records.find(mr => mr.memberId === memberId)?.status;
        return sanitizeAttendanceStatus(status);
    };

    const handleStatusChange = (memberId: string, status: AttendanceStatus) => {
        const newChanges = new Map(pendingChanges);
        newChanges.set(memberId, status);
        setPendingChanges(newChanges);
        setSuccessMessage(null); // Dismiss success message if user starts editing again
    };

    const handleBulkApply = (memberIds: string[], status: AttendanceStatus) => {
        const newChanges = new Map(pendingChanges);
        memberIds.forEach(id => newChanges.set(id, status));
        setPendingChanges(newChanges);
        setIsBulkModalOpen(false);
    };
    
    const handleSave = async () => {
        if (pendingChanges.size === 0) return;

        setIsSaving(true);
        
        // Artificial delay (500ms) so user sees the "Saving..." state/spinner
        await new Promise(resolve => setTimeout(resolve, 500));

        const newAttendance = [...attendance.filter(r => r.date !== selectedDate)]; // Remove old record for this date
        const existingRecord = attendance.find(r => r.date === selectedDate);
        let recordForDate = existingRecord ? { ...existingRecord, records: [...existingRecord.records] } : { date: selectedDate, records: [] };

        pendingChanges.forEach((status, memberId) => {
            const memberRecordIndex = recordForDate.records.findIndex(mr => mr.memberId === memberId);
            if (memberRecordIndex > -1) {
                recordForDate.records[memberRecordIndex].status = status;
            } else {
                recordForDate.records.push({ memberId, status });
            }
        });

        newAttendance.push(recordForDate);
        setAttendance(newAttendance);
        
        // Reset UI state
        setPendingChanges(new Map());
        setIsSaving(false);
        setSuccessMessage("Attendance saved successfully!");
    };

    const STATUS_OPTIONS: { value: AttendanceStatus, label: string }[] = [
        { value: 'present', label: 'Present' },
        { value: 'absent', label: 'Absent' },
        { value: 'sick', label: 'Sick' },
        { value: 'travel', label: 'Travel' },
        { value: 'catechumen', label: 'Catechumen' },
    ];

    return (
        <div className="space-y-6 relative pb-20">
            <h2 className="text-2xl font-bold text-slate-800">Class Attendance</h2>
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex flex-wrap items-center gap-4">
                <div>
                    <label className="block font-medium text-slate-700 mb-1">Select Date</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="border-slate-300 rounded-md shadow-sm"
                    />
                </div>
                 {currentUser.role === 'admin' && (
                    <>
                        <div>
                            <label htmlFor="classFilter" className="block font-medium text-slate-700 mb-1">Filter by Class</label>
                            <select
                                id="classFilter"
                                value={classFilter}
                                onChange={e => setClassFilter(e.target.value)}
                                className="border-slate-300 rounded-md shadow-sm"
                            >
                                {classOptions.map(cls => (
                                    <option key={cls} value={cls}>
                                        {cls === 'all' ? 'All Classes' : `Class ${cls}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="ml-auto">
                            <label className="block font-medium text-transparent mb-1">Action</label>
                            <button 
                                onClick={() => setIsBulkModalOpen(true)}
                                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                                </svg>
                                Bulk Mark
                            </button>
                        </div>
                    </>
                 )}
            </div>
            
             <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-y-auto max-h-[60vh]">
                 <div className="p-4 space-y-3">
                    {filteredMembers.map(member => (
                        <div key={member.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center p-3 rounded-lg bg-slate-50/50 hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-400 text-sm w-10">{member.memberNumber || '#'}</span>
                                <span className="font-medium text-slate-800 text-lg">{sanitizeString(member.name)}</span>
                                {pendingChanges.has(member.id) && (
                                    <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold">Modified</span>
                                )}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {STATUS_OPTIONS.map(opt => (
                                     <button 
                                        key={opt.value}
                                        onClick={() => handleStatusChange(member.id, opt.value)}
                                        className={`px-3 py-1 font-medium rounded-full transition-all text-sm border ${
                                            getStatusForMember(member.id) === opt.value
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                    {filteredMembers.length === 0 && (
                        <div className="text-center py-10 text-slate-400 italic">No members found matching filter.</div>
                    )}
                 </div>
            </div>

            {/* Sticky Save Bar */}
            <div className="fixed bottom-6 right-6 z-40 flex items-center gap-4">
                {successMessage && (
                    <div className="bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg font-bold animate-fade-in-up flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        {successMessage}
                    </div>
                )}
                
                <button
                    onClick={handleSave}
                    disabled={pendingChanges.size === 0 || isSaving}
                    className={`
                        font-bold py-4 px-8 rounded-xl shadow-xl text-lg flex items-center gap-2 transition-all
                        ${pendingChanges.size > 0 
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white transform hover:scale-105' 
                            : 'bg-slate-300 text-slate-500 cursor-not-allowed'}
                    `}
                >
                    {isSaving ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                        </>
                    ) : (
                        `Save ${pendingChanges.size} Changes`
                    )}
                </button>
            </div>

            {isBulkModalOpen && (
                <BulkAttendanceModal
                    members={members}
                    settings={settings}
                    onApply={handleBulkApply}
                    onClose={() => setIsBulkModalOpen(false)}
                />
            )}
        </div>
    );
};

export default Attendance;
