import React, { useState, useEffect, useMemo } from 'react';
import type { Member, Settings, User, AttendanceStatus, SyncStatus } from '../types';
import { saveAttendanceToSupabase, loadAttendanceForDate } from '../services/supabase';

interface ClassAttendanceProps {
    members: Member[];
    settings: Settings;
    currentUser: User;
    syncStatus?: SyncStatus;
}

const ClassAttendance: React.FC<ClassAttendanceProps> = ({ members, settings, currentUser, syncStatus }) => {
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [attendance, setAttendance] = useState<Map<string, AttendanceStatus>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const isConnected = !!settings.supabaseUrl && !!settings.supabaseKey && syncStatus?.state === 'synced';

    // Filter members by assigned class
    const classMembers = useMemo(() => {
        const assignedClass = currentUser.assignedClass || currentUser.classLed;
        if (!assignedClass) return [];
        return members.filter(m => m.classNumber === assignedClass && m.active !== false).sort((a, b) => a.name.localeCompare(b.name));
    }, [members, currentUser]);

    // Load existing attendance for selected date
    useEffect(() => {
        if (!isConnected || !selectedDate) return;
        loadAttendanceForDate(settings.supabaseUrl, settings.supabaseKey, selectedDate)
            .then(records => {
                const map = new Map<string, AttendanceStatus>();
                records.forEach(r => map.set(r.member_id, r.status as AttendanceStatus));
                setAttendance(map);
            })
            .catch(err => console.error('Load attendance failed:', err));
    }, [selectedDate, isConnected, settings.supabaseUrl, settings.supabaseKey]);

    const handleStatusChange = (memberId: string, status: AttendanceStatus) => {
        setAttendance(prev => new Map(prev).set(memberId, status));
    };

    const handleSave = async () => {
        if (!isConnected) {
            alert('Please ensure you are connected to the cloud.');
            return;
        }
        setIsSaving(true);
        try {
            const records = Array.from(attendance.entries()).map(([member_id, status]) => ({
                date: selectedDate,
                member_id,
                status,
            }));
            await saveAttendanceToSupabase(settings.supabaseUrl, settings.supabaseKey, records);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (e: any) {
            alert(`Failed to save attendance: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const stats = useMemo(() => {
        const present = Array.from(attendance.values()).filter(s => s === 'present').length;
        const absent = Array.from(attendance.values()).filter(s => s === 'absent').length;
        const sick = Array.from(attendance.values()).filter(s => s === 'sick').length;
        const travel = Array.from(attendance.values()).filter(s => s === 'travel').length;
        return { present, absent, sick, travel, total: classMembers.length };
    }, [attendance, classMembers]);

    if (!currentUser.assignedClass && !currentUser.classLed) {
        return (
            <div className="p-8 text-center">
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 max-w-md mx-auto">
                    <h2 className="text-xl font-bold text-yellow-800 mb-2">No Class Assigned</h2>
                    <p className="text-yellow-700">Please contact an administrator to assign you to a class.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            {showSuccess && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-3 rounded-full shadow-2xl font-bold z-50 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Attendance saved successfully!
                </div>
            )}

            {/* Header */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-8 rounded-2xl shadow-lg border-2 border-slate-200">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-xl shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-slate-800">Class Attendance</h2>
                            <p className="text-base text-slate-500 mt-1 font-medium">Class {currentUser.assignedClass || currentUser.classLed} • {classMembers.length} members</p>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-indigo-100 to-blue-100 p-6 rounded-xl border-2 border-indigo-200 min-w-[200px]">
                        <label className="block text-sm font-bold text-indigo-800 mb-2">Service Date</label>
                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full border-2 border-indigo-300 rounded-lg py-3 px-4 font-bold text-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-green-400 to-emerald-500 p-5 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase">Present</div>
                    <div className="text-3xl font-bold mt-1">{stats.present}</div>
                </div>
                <div className="bg-gradient-to-br from-red-400 to-rose-500 p-5 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase">Absent</div>
                    <div className="text-3xl font-bold mt-1">{stats.absent}</div>
                </div>
                <div className="bg-gradient-to-br from-orange-400 to-amber-500 p-5 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase">Sick</div>
                    <div className="text-3xl font-bold mt-1">{stats.sick}</div>
                </div>
                <div className="bg-gradient-to-br from-blue-400 to-cyan-500 p-5 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase">Travel</div>
                    <div className="text-3xl font-bold mt-1">{stats.travel}</div>
                </div>
                <div className="bg-gradient-to-br from-slate-600 to-slate-700 p-5 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase">Total</div>
                    <div className="text-3xl font-bold mt-1">{stats.total}</div>
                </div>
            </div>

            {/* Member List */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white">
                    <h3 className="text-xl font-bold">Mark Attendance</h3>
                </div>
                <div className="p-6">
                    {classMembers.length === 0 ? (
                        <div className="text-center text-slate-400 p-12">
                            <p className="text-lg">No members found in Class {currentUser.assignedClass || currentUser.classLed}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {classMembers.map(member => (
                                <div key={member.id} className="bg-gradient-to-br from-slate-50 to-blue-50 p-5 rounded-xl border-2 border-slate-200 hover:border-blue-300 transition-all">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="font-bold text-lg text-slate-800">{member.name}</div>
                                        {member.phone && <div className="text-sm text-slate-500">{member.phone}</div>}
                                    </div>
                                    <div className="flex gap-2">
                                        {(['present', 'absent', 'sick', 'travel'] as AttendanceStatus[]).map(status => (
                                            <button
                                                key={status}
                                                onClick={() => handleStatusChange(member.id, status)}
                                                className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm transition-all capitalize ${
                                                    attendance.get(member.id) === status
                                                        ? status === 'present' ? 'bg-green-500 text-white shadow-lg'
                                                        : status === 'absent' ? 'bg-red-500 text-white shadow-lg'
                                                        : status === 'sick' ? 'bg-orange-500 text-white shadow-lg'
                                                        : 'bg-blue-500 text-white shadow-lg'
                                                        : 'bg-white border-2 border-slate-300 text-slate-700 hover:border-slate-400'
                                                }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-6 bg-slate-50 border-t-2 border-slate-200 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={!isConnected || isSaving || classMembers.length === 0}
                        className={`bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center gap-3 ${
                            !isConnected || isSaving ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-xl hover:scale-105'
                        }`}
                    >
                        {isSaving ? (
                            <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Saving...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Save Attendance
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClassAttendance;
