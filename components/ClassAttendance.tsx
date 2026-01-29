import React, { useState, useEffect, useMemo } from 'react';
import type { Member, Settings, User, AttendanceStatus, SyncStatus } from '../types';
import { saveAttendanceToSupabase, loadAttendanceForDate, loadAttendanceReport, saveMemberToSupabase as saveMemberToSupabaseFn } from '../services/supabase';
import MemberModal from './MemberModal';
import { useToast } from './ToastProvider';
import MobileAttendanceMarking from './MobileAttendanceMarking';
import ClassLeaderMembersEditor from './ClassLeaderMembersEditor';
import { getTodayEST, getWeekStart } from '../utils';
interface ClassAttendanceProps {
    members: Member[];
    setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
    settings: Settings;
    currentUser: User;
    syncStatus?: SyncStatus;
}
const ClassAttendance: React.FC<ClassAttendanceProps> = ({ members, setMembers, settings, currentUser, syncStatus }) => {
    const { showToast } = useToast();
    // Base date selector; we will snap it to the week start (Sunday)
    const [selectedDate, setSelectedDate] = useState<string>(getTodayEST());
    const [attendance, setAttendance] = useState<Map<string, AttendanceStatus>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertType, setAlertType] = useState<'month' | 'quarter' | null>(null);
    const [alertList, setAlertList] = useState<Array<{ memberId: string; name: string; phone?: string; weeksAbsent: number; selected: boolean }>>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editMember, setEditMember] = useState<Member | null>(null);
    const [isMobileMarkingOpen, setIsMobileMarkingOpen] = useState(false);
    const [isAttendanceExpanded, setIsAttendanceExpanded] = useState(true);
    const [isMembersEditorOpen, setIsMembersEditorOpen] = useState(false);

    const isConnected = !!settings.supabaseUrl && !!settings.supabaseKey && syncStatus?.state === 'synced';

    // Filter members by assigned class
    const classMembers = useMemo(() => {
        const assignedClass = currentUser.assignedClass || currentUser.classLed;
        if (!assignedClass) return [];
        return members.filter(m => m.classNumber === assignedClass && m.active !== false).sort((a, b) => a.name.localeCompare(b.name));
    }, [members, currentUser]);

    // Helper: compute week start (Sunday) and end (Saturday) for a given ISO date string
    const getWeekStart = (isoDate: string) => {
        const d = new Date(isoDate + 'T00:00:00');
        const day = d.getUTCDay(); // 0=Sun,6=Sat
        const start = new Date(d);
        start.setUTCDate(d.getUTCDate() - day);
        return start.toISOString().slice(0, 10);
    };
    const getWeekEnd = (isoDate: string) => {
        const startStr = getWeekStart(isoDate);
        const start = new Date(startStr + 'T00:00:00');
        const end = new Date(start);
        end.setUTCDate(start.getUTCDate() + 6);
        return end.toISOString().slice(0, 10);
    };
    const currentWeekStart = getWeekStart(getTodayEST());
    const selectedWeekStart = getWeekStart(selectedDate);
    const selectedWeekEnd = getWeekEnd(selectedDate);
    const isCurrentWeek = selectedWeekStart === currentWeekStart;

    // Helpers for month/quarter ranges (calendar based, ending at current week end)
    const getMonthStart = (isoDate: string) => {
        const d = new Date(isoDate + 'T00:00:00');
        const ms = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
        return ms.toISOString().slice(0, 10);
    };
    const getQuarterStart = (isoDate: string) => {
        const d = new Date(isoDate + 'T00:00:00');
        const q = Math.floor(d.getUTCMonth() / 3); // 0..3
        const qs = new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1));
        return qs.toISOString().slice(0, 10);
    };

    // Load existing attendance for selected week (store as a single record per member using date = weekStart)
    useEffect(() => {
        if (!isConnected || !selectedWeekStart) return;
        loadAttendanceForDate(settings.supabaseUrl, settings.supabaseKey, selectedWeekStart)
            .then(records => {
                const map = new Map<string, AttendanceStatus>();
                records.forEach(r => map.set(r.member_id, (r.status as AttendanceStatus) || 'absent'));
                setAttendance(map);
            })
            .catch(err => console.error('Load attendance failed:', err));
    }, [selectedWeekStart, isConnected, settings.supabaseUrl, settings.supabaseKey]);

    // Default all members to 'absent' for the selected week (fills gaps for new members or no prior data)
    useEffect(() => {
        if (classMembers.length === 0) return;
        setAttendance(prev => {
            const next = new Map(prev);
            classMembers.forEach(m => {
                if (!next.has(m.id)) next.set(m.id, 'absent');
            });
            return next;
        });
    }, [classMembers, selectedWeekStart]);

    const handleStatusChange = (memberId: string, status: AttendanceStatus) => {
        if (!isCurrentWeek) return; // prevent editing past/future weeks
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
                // Persist weekly attendance using the week start (Sunday) as the record date
                date: selectedWeekStart,
                member_id,
                status,
            }));
            await saveAttendanceToSupabase(settings.supabaseUrl, settings.supabaseKey, records);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
            setIsAttendanceExpanded(false);
        } catch (e: any) {
            alert(`Failed to save attendance: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const stats = useMemo(() => {
        const present = Array.from(attendance.values()).filter(s => s === 'present').length;
        const absent = classMembers.length - present;
        return { present, absent, total: classMembers.length };
    }, [attendance, classMembers]);

    const handleSaveMemberLimited = async (updated: Member) => {
        if (!isConnected) {
            alert('Writes are disabled until connected to the cloud.');
            return;
        }
        // Only allow edits for members in assigned class
        const assignedClass = currentUser.assignedClass || currentUser.classLed;
        const original = members.find(m => m.id === updated.id);
        if (!original || original.classNumber !== assignedClass) {
            showToast('You can only edit members in your class.', 'error', 3500);
            setIsEditModalOpen(false);
            setEditMember(null);
            return;
        }
        // Restrict to allowed fields
        const toSave: Member = {
            ...original,
            name: updated.name,
            email: updated.email,
            phone: updated.phone,
            address: updated.address,
        };
        try {
            await saveMemberToSupabaseFn(settings.supabaseUrl, settings.supabaseKey, toSave);
            setMembers(prev => prev.map(m => m.id === toSave.id ? toSave : m));
            showToast(`✅ ${toSave.name} contact updated`, 'success', 3000);
        } catch (e: any) {
            showToast(`❌ Failed to save: ${e.message || e}`, 'error', 4000);
        } finally {
            setIsEditModalOpen(false);
            setEditMember(null);
        }
    };

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
                            <p className="text-sm text-slate-500 mt-1">Week: {new Date(selectedWeekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric'})} – {new Date(selectedWeekEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric'})} {isCurrentWeek ? '• Editing current week' : '• Read-only (past week)'}
                            </p>
                        </div>
                    </div>
                    {/* Week navigation: previous/next week */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                const start = new Date(selectedWeekStart + 'T00:00:00');
                                start.setUTCDate(start.getUTCDate() - 7);
                                setSelectedDate(start.toISOString().slice(0,10));
                            }}
                            className="bg-white border-2 border-indigo-300 text-indigo-700 px-4 py-3 rounded-xl font-bold hover:bg-indigo-50"
                        >
                            ← Prev Week
                        </button>
                        <div className="bg-gradient-to-br from-indigo-100 to-blue-100 p-4 rounded-xl border-2 border-indigo-200 min-w-[220px] text-center">
                            <div className="text-sm font-bold text-indigo-800">Week of</div>
                            <div className="font-bold text-lg">
                                {new Date(selectedWeekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                const start = new Date(selectedWeekStart + 'T00:00:00');
                                start.setUTCDate(start.getUTCDate() + 7);
                                setSelectedDate(start.toISOString().slice(0,10));
                            }}
                            className="bg-white border-2 border-indigo-300 text-indigo-700 px-4 py-3 rounded-xl font-bold hover:bg-indigo-50"
                        >
                            Next Week →
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-400 to-emerald-500 p-5 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase">Present</div>
                    <div className="text-3xl font-bold mt-1">{stats.present}</div>
                </div>
                <div className="bg-gradient-to-br from-red-400 to-rose-500 p-5 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase">Absent</div>
                    <div className="text-3xl font-bold mt-1">{stats.absent}</div>
                </div>
                <div className="bg-gradient-to-br from-slate-600 to-slate-700 p-5 rounded-xl shadow-lg text-white">
                    <div className="text-sm font-bold uppercase">Total</div>
                    <div className="text-3xl font-bold mt-1">{stats.total}</div>
                </div>
            </div>

            {/* Alerts */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-800">Absence Alerts</h3>
                    <div className="text-sm text-slate-500">Generate lists for follow-up</div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={async () => {
                            if (!isConnected) return;
                            setAlertType('month');
                            const today = new Date().toISOString().slice(0,10);
                            const start = getMonthStart(today);
                            const end = getWeekEnd(today);
                            const rows = await loadAttendanceReport(settings.supabaseUrl, settings.supabaseKey, start, end);
                            // Build absent list: members with no 'present' in the period
                            const byMember: Record<string, AttendanceStatus[]> = {};
                            (rows || []).forEach(r => {
                                byMember[r.member_id] ||= [];
                                byMember[r.member_id].push(r.status as AttendanceStatus);
                            });
                            const list = classMembers
                                .filter(m => {
                                    const statuses = byMember[m.id] || [];
                                    // Count weeks in range (approx by distinct week-start dates)
                                    const presentAny = statuses.some(s => s === 'present');
                                    return !presentAny; // absent entire period
                                })
                                .map(m => ({ memberId: m.id, name: m.name, phone: m.phone, weeksAbsent: (byMember[m.id]?.length || 0), selected: true }));
                            setAlertList(list);
                            setIsAlertOpen(true);
                        }}
                        className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-5 py-3 rounded-xl font-bold shadow hover:scale-105"
                    >
                        Generate Monthly Absentees
                    </button>
                    <button
                        onClick={async () => {
                            if (!isConnected) return;
                            setAlertType('quarter');
                            const today = new Date().toISOString().slice(0,10);
                            const start = getQuarterStart(today);
                            const end = getWeekEnd(today);
                            const rows = await loadAttendanceReport(settings.supabaseUrl, settings.supabaseKey, start, end);
                            const byMember: Record<string, AttendanceStatus[]> = {};
                            (rows || []).forEach(r => {
                                byMember[r.member_id] ||= [];
                                byMember[r.member_id].push(r.status as AttendanceStatus);
                            });
                            const list = classMembers
                                .filter(m => {
                                    const statuses = byMember[m.id] || [];
                                    const presentAny = statuses.some(s => s === 'present');
                                    return !presentAny;
                                })
                                .map(m => ({ memberId: m.id, name: m.name, phone: m.phone, weeksAbsent: (byMember[m.id]?.length || 0), selected: true }));
                            setAlertList(list);
                            setIsAlertOpen(true);
                        }}
                        className="bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white px-5 py-3 rounded-xl font-bold shadow hover:scale-105"
                    >
                        Generate Quarterly Absentees
                    </button>
                </div>
                <p className="text-slate-500 text-sm mt-3">Tip: Lists include members with no "present" for the period.</p>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-800">Actions</h3>
                    <div className="text-sm text-slate-500">Manage attendance & members</div>
                </div>
                <div className="flex flex-wrap gap-3">
                    {isCurrentWeek && (
                        <button
                            onClick={() => setIsMobileMarkingOpen(true)}
                            disabled={!isConnected || classMembers.length === 0}
                            className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                            📱 Quick Mark
                        </button>
                    )}
                    <button
                        onClick={() => setIsMembersEditorOpen(true)}
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-xl font-bold shadow hover:scale-105 flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        👥 Edit Members
                    </button>
                </div>
            </div>

            {/* Member List - Collapsible */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden">
                <div 
                    onClick={() => setIsAttendanceExpanded(!isAttendanceExpanded)}
                    className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white cursor-pointer hover:from-indigo-700 hover:to-blue-700 transition-all flex justify-between items-center"
                >
                    <h3 className="text-xl font-bold">Mark Attendance</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-sm bg-white/20 px-3 py-1 rounded-full font-semibold">
                            {attendance.size}/{classMembers.length} marked
                        </span>
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className={`h-6 w-6 transition-transform ${isAttendanceExpanded ? 'rotate-180' : ''}`} 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </div>
                </div>
                {isAttendanceExpanded && (
                    <>
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
                                                {(['present', 'absent'] as AttendanceStatus[]).map(status => (
                                                    <button
                                                        key={status}
                                                        onClick={() => handleStatusChange(member.id, status)}
                                                        disabled={!isCurrentWeek}
                                                        className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm transition-all capitalize ${
                                                            attendance.get(member.id) === status
                                                                ? status === 'present' ? 'bg-green-500 text-white shadow-lg'
                                                                : 'bg-red-500 text-white shadow-lg'
                                                                : (!isCurrentWeek ? 'bg-white border-2 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-2 border-slate-300 text-slate-700 hover:border-slate-400')
                                                        }`}
                                                    >
                                                        {status}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => {
                                                        setEditMember(member);
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="py-2 px-3 rounded-lg font-bold text-sm bg-white border-2 border-indigo-300 text-indigo-700 hover:border-indigo-400"
                                                >
                                                    Edit Contact
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 border-t-2 border-slate-200 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={!isConnected || isSaving || classMembers.length === 0 || !isCurrentWeek}
                            className={`bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center gap-3 ${
                                (!isConnected || isSaving || !isCurrentWeek) ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-xl hover:scale-105'
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
                                    Save Weekly Attendance
                                </>
                            )}
                        </button>
                        </div>
                    </>
                )}
            </div>

            {/* Mobile Quick Mark Modal */}
            <MobileAttendanceMarking 
                isOpen={isMobileMarkingOpen}
                members={classMembers}
                currentAttendance={attendance}
                onClose={() => setIsMobileMarkingOpen(false)}
                onSave={(newAttendance) => {
                    setAttendance(newAttendance);
                    setIsMobileMarkingOpen(false);
                }}
            />

            {/* Edit Members Modal */}
            <ClassLeaderMembersEditor
                isOpen={isMembersEditorOpen}
                onClose={() => setIsMembersEditorOpen(false)}
                members={members}
                setMembers={setMembers}
                classNumber={currentUser.assignedClass || currentUser.classLed}
                settings={settings}
                syncStatus={syncStatus}
            />

            {/* Alert Modal */}
            {isAlertOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsAlertOpen(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border-2 border-slate-200" onClick={e => e.stopPropagation()}>
                    <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-5 rounded-t-2xl flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold">{alertType === 'month' ? 'Monthly' : 'Quarterly'} Absentees — Class {currentUser.assignedClass || currentUser.classLed}</h3>
                            <p className="text-white/70 text-sm">Uncheck anyone you know attended.</p>
                        </div>
                        <button className="text-white/80 hover:text-white text-2xl font-bold" onClick={() => setIsAlertOpen(false)}>×</button>
                    </div>
                    <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2">
                        {alertList.length === 0 ? (
                            <div className="text-slate-500 text-center py-10">No members absent for the entire period.</div>
                        ) : (
                            alertList.map(item => (
                                <label key={item.memberId} className="flex items-center justify-between p-3 rounded-lg border-2 border-slate-200 bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={item.selected}
                                            onChange={e => setAlertList(prev => prev.map(x => x.memberId === item.memberId ? { ...x, selected: e.target.checked } : x))}
                                            className="h-5 w-5 rounded border-slate-300"
                                        />
                                        <div>
                                            <div className="font-bold text-slate-800">{item.name}</div>
                                            <div className="text-xs text-slate-500">Weeks in period: {item.weeksAbsent}{item.phone ? ` • ${item.phone}` : ''}</div>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded">Absent</span>
                                </label>
                            ))
                        )}
                    </div>
                    <div className="p-5 bg-slate-50 rounded-b-2xl border-t-2 border-slate-200 flex items-center justify-between">
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    const selected = alertList.filter(x => x.selected);
                                    const lines = selected.map(x => `${x.name}${x.phone ? ' ('+x.phone+')' : ''}`);
                                    const csv = ['Name,Phone', ...selected.map(x => `${JSON.stringify(x.name)},${JSON.stringify(x.phone || '')}`)].join('\n');
                                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${alertType || 'alert'}_absentees_class_${currentUser.assignedClass || currentUser.classLed}.csv`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="bg-white border-2 border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-bold hover:bg-slate-100"
                            >
                                Download CSV
                            </button>
                            <button
                                onClick={() => {
                                    const selected = alertList.filter(x => x.selected);
                                    const names = selected.map(x => x.name).join(', ');
                                    const subject = encodeURIComponent(`${alertType === 'month' ? 'Monthly' : 'Quarterly'} Absentees — Class ${currentUser.assignedClass || currentUser.classLed}`);
                                    const body = encodeURIComponent(`Dear ${currentUser.assignedClass || currentUser.classLed} Class Leader,\n\nPlease follow up with the following members who were absent for the ${alertType === 'month' ? 'month' : 'quarter'}:\n\n${names}\n\nThank you.`);
                                    window.location.href = `mailto:?subject=${subject}&body=${body}`;
                                }}
                                className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:opacity-90"
                            >
                                Email List
                            </button>
                        </div>
                        <button onClick={() => setIsAlertOpen(false)} className="bg-slate-700 text-white px-4 py-2 rounded-lg font-bold">Close</button>
                    </div>
                </div>
            </div>
            )}
            {isEditModalOpen && editMember && (
                <MemberModal
                    member={editMember}
                    onSave={handleSaveMemberLimited}
                    onClose={() => { setIsEditModalOpen(false); setEditMember(null); }}
                    allowedFields={['name','email','phone','address']}
                />
            )}
        </div>
    );
};

export default ClassAttendance;
