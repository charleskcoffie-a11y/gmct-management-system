
// components/AdminAttendanceView.tsx
import React, { useState, useMemo } from 'react';
import type { Member, AttendanceRecord, AttendanceStatus, Settings, User } from '../types';
import AttendanceReportModal from './AttendanceReportModal';
import { sanitizeAttendanceStatus, sanitizeString } from '../utils';

interface AdminAttendanceViewProps {
    members: Member[];
    attendance: AttendanceRecord[];
    settings: Settings;
    currentUser: User;
}

type SortKey = 'name' | 'status';

const AdminAttendanceView: React.FC<AdminAttendanceViewProps> = ({ members, attendance, settings, currentUser }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [classFilter, setClassFilter] = useState<string>('all');
    
    // Sorting State (Removed classNumber from sort, as we are now grouping by it)
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ 
        key: 'name', 
        direction: 'asc' 
    });

    const viewTitle = useMemo(() => {
        if (currentUser.role === 'class-leader') {
            const classNumber = currentUser.classNumber || currentUser.classLed;
            return `Attendance Report for Class ${sanitizeString(classNumber)}`;
        }
        return 'Attendance Report';
    }, [currentUser]);

    const classOptions = useMemo(() => {
        return ['all', ...Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1))];
    }, [settings.maxClasses]);

    const attendanceForDate = useMemo(() => {
        const record = attendance.find(r => r.date === selectedDate);
        const map = new Map<string, AttendanceStatus>();
        if (record) {
            record.records.forEach(r => map.set(r.memberId, r.status));
        }
        return map;
    }, [attendance, selectedDate]);

    const getStatusForMember = (memberId: string): AttendanceStatus => {
        const status = attendanceForDate.get(memberId);
        return sanitizeAttendanceStatus(status);
    };

    // 1. Filter Members based on role/selection
    const filteredMembers = useMemo(() => {
        if (currentUser.role === 'class-leader') {
            const classNumber = currentUser.classNumber || currentUser.classLed;
            return members.filter(m => m.classNumber === classNumber);
        }
        if (classFilter === 'all') {
            return members;
        }
        return members.filter(m => m.classNumber === classFilter);
    }, [members, classFilter, currentUser]);

    // 2. Group Members by Class
    const groupedMembers = useMemo(() => {
        const groups: Record<string, Member[]> = {};
        
        filteredMembers.forEach(member => {
            const cls = member.classNumber || 'Unassigned';
            if (!groups[cls]) {
                groups[cls] = [];
            }
            groups[cls].push(member);
        });

        // Sort members WITHIN groups
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => {
                let comparison = 0;
                if (sortConfig.key === 'name') {
                    comparison = a.name.localeCompare(b.name);
                } else if (sortConfig.key === 'status') {
                    const statusA = getStatusForMember(a.id);
                    const statusB = getStatusForMember(b.id);
                    comparison = statusA.localeCompare(statusB);
                }
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            });
        });

        return groups;
    }, [filteredMembers, sortConfig, attendanceForDate]);

    // Get sorted class keys for rendering (numeric sort)
    const sortedClassKeys = useMemo(() => {
        return Object.keys(groupedMembers).sort((a, b) => {
            if (a === 'Unassigned') return 1;
            if (b === 'Unassigned') return -1;
            return parseInt(a) - parseInt(b);
        });
    }, [groupedMembers]);


    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Calculate aggregate stats
    const stats = useMemo(() => {
        const total = filteredMembers.length;
        if (total === 0) return { present: 0, absent: 0, sick: 0, travel: 0, catechumen: 0, total };
        
        const counts: Record<AttendanceStatus, number> = { present: 0, absent: 0, sick: 0, travel: 0, catechumen: 0 };
        
        filteredMembers.forEach(m => {
             const status = getStatusForMember(m.id);
             if (counts.hasOwnProperty(status)) {
                counts[status]++;
             }
        })
        return {...counts, total};
    }, [filteredMembers, attendanceForDate]);

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-slate-800">{viewTitle}</h2>

            {/* Filters */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200/80 flex flex-wrap items-center gap-6">
                <div className="flex-grow md:flex-grow-0">
                    <label htmlFor="reportDate" className="block text-lg font-bold text-slate-700 mb-2">Report Date</label>
                    <input
                        id="reportDate"
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="block w-full border-slate-300 rounded-lg text-lg py-3 px-4 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                {currentUser.role === 'admin' && (
                    <div className="flex-grow md:flex-grow-0 min-w-[200px]">
                        <label htmlFor="classFilter" className="block text-lg font-bold text-slate-700 mb-2">Filter by Class</label>
                        <select
                            id="classFilter"
                            value={classFilter}
                            onChange={e => setClassFilter(e.target.value)}
                            className="block w-full border-slate-300 rounded-lg text-lg py-3 px-4 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            {classOptions.map(cls => (
                                <option key={cls} value={cls}>
                                    {cls === 'all' ? 'All Classes' : `Class ${cls}`}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
            
            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-green-100 border-2 border-green-200 text-green-900 p-4 rounded-xl text-center shadow-sm">
                    <div className="font-extrabold text-4xl">{stats.present}</div>
                    <div className="text-sm font-bold uppercase tracking-wider mt-1">Present</div>
                </div>
                <div className="bg-red-100 border-2 border-red-200 text-red-900 p-4 rounded-xl text-center shadow-sm">
                    <div className="font-extrabold text-4xl">{stats.absent}</div>
                    <div className="text-sm font-bold uppercase tracking-wider mt-1">Absent</div>
                </div>
                <div className="bg-yellow-100 border-2 border-yellow-200 text-yellow-900 p-4 rounded-xl text-center shadow-sm">
                    <div className="font-extrabold text-4xl">{stats.sick}</div>
                    <div className="text-sm font-bold uppercase tracking-wider mt-1">Sick</div>
                </div>
                <div className="bg-blue-100 border-2 border-blue-200 text-blue-900 p-4 rounded-xl text-center shadow-sm">
                    <div className="font-extrabold text-4xl">{stats.travel}</div>
                    <div className="text-sm font-bold uppercase tracking-wider mt-1">Travel</div>
                </div>
                <div className="bg-purple-100 border-2 border-purple-200 text-purple-900 p-4 rounded-xl text-center shadow-sm">
                    <div className="font-extrabold text-4xl">{stats.catechumen}</div>
                    <div className="text-sm font-bold uppercase tracking-wider mt-1">Catechumen</div>
                </div>
            </div>

            {/* Grouped Tables */}
            <div className="space-y-8">
                {sortedClassKeys.map(classNum => (
                    <div key={classNum} className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                        <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-xl font-extrabold text-slate-800">
                                {classNum === 'Unassigned' ? 'Unassigned Members' : `Class ${classNum}`}
                            </h3>
                            <span className="bg-white text-slate-600 px-3 py-1 rounded-full text-sm font-bold border border-slate-300">
                                {groupedMembers[classNum].length} Members
                            </span>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-slate-600">
                                <thead className="text-sm text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th 
                                            className="px-6 py-4 cursor-pointer hover:bg-slate-200 transition-colors select-none font-bold tracking-wider"
                                            onClick={() => handleSort('name')}
                                        >
                                            Member Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th className="px-6 py-4 font-bold tracking-wider">Member ID</th>
                                        <th 
                                            className="px-6 py-4 cursor-pointer hover:bg-slate-200 transition-colors select-none font-bold tracking-wider text-center"
                                            onClick={() => handleSort('status')}
                                        >
                                            Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="text-lg divide-y divide-slate-100">
                                    {groupedMembers[classNum].map(member => (
                                        <tr key={member.id} className="bg-white hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-900">{sanitizeString(member.name)}</td>
                                            <td className="px-6 py-4 font-mono text-base text-slate-400">{member.memberNumber || '-'}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-block px-4 py-2 rounded-lg text-sm font-extrabold uppercase tracking-wide shadow-sm ${
                                                    getStatusForMember(member.id) === 'present' ? 'bg-green-100 text-green-800 border border-green-200' :
                                                    getStatusForMember(member.id) === 'absent' ? 'bg-red-100 text-red-800 border border-red-200' :
                                                    getStatusForMember(member.id) === 'sick' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                                    'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                    {getStatusForMember(member.id)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => setSelectedMember(member)} className="text-base font-bold text-indigo-600 hover:text-indigo-800 hover:underline">View History</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
                
                {sortedClassKeys.length === 0 && (
                    <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
                        <p className="text-xl">No members found for the selected criteria.</p>
                    </div>
                )}
            </div>

            {selectedMember && (
                <AttendanceReportModal 
                    member={selectedMember}
                    attendance={attendance}
                    onClose={() => setSelectedMember(null)}
                />
            )}
        </div>
    );
};

export default AdminAttendanceView;
