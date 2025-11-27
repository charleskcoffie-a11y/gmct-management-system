import React, { useMemo } from 'react';
import type { Member, AttendanceRecord, AttendanceStatus } from '../types';
import { sanitizeAttendanceStatus, sanitizeString } from '../utils';

interface AttendanceReportModalProps {
    member: Member | null;
    attendance: AttendanceRecord[];
    onClose: () => void;
}

const AttendanceReportModal: React.FC<AttendanceReportModalProps> = ({ member, attendance, onClose }) => {
    const memberHistory = useMemo(() => {
        if (!member) return [];
        
        const history: { date: string, status: AttendanceStatus }[] = [];
        attendance.forEach(record => {
            const memberRecord = record.records.find(r => r.memberId === member.id);
            if (memberRecord) {
                history.push({ date: record.date, status: memberRecord.status });
            }
        });

        return history.sort((a, b) => b.date.localeCompare(a.date));
    }, [member, attendance]);
    
    if (!member) return null;

    const statusCounts = useMemo(() => {
        return memberHistory.reduce((acc, record) => {
            const sanitizedStatus = sanitizeAttendanceStatus(record.status);
            acc[sanitizedStatus] = (acc[sanitizedStatus] || 0) + 1;
            return acc;
        }, {} as Record<AttendanceStatus, number>);
    }, [memberHistory]);


    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-start p-4 pt-16" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">Attendance History: {sanitizeString(member.name)}</h2>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                        <div className="bg-green-100 p-2 rounded-lg">
                            <div className="text-2xl font-bold text-green-800">{statusCounts.present || 0}</div>
                            <div className="text-xs text-green-700">Present</div>
                        </div>
                        <div className="bg-red-100 p-2 rounded-lg">
                            <div className="text-2xl font-bold text-red-800">{statusCounts.absent || 0}</div>
                            <div className="text-xs text-red-700">Absent</div>
                        </div>
                        <div className="bg-yellow-100 p-2 rounded-lg">
                            <div className="text-2xl font-bold text-yellow-800">{statusCounts.sick || 0}</div>
                            <div className="text-xs text-yellow-700">Sick</div>
                        </div>
                         <div className="bg-blue-100 p-2 rounded-lg">
                            <div className="text-2xl font-bold text-blue-800">{statusCounts.travel || 0}</div>
                            <div className="text-xs text-blue-700">Travel</div>
                        </div>
                        <div className="bg-purple-100 p-2 rounded-lg">
                            <div className="text-2xl font-bold text-purple-800">{statusCounts.catechumen || 0}</div>
                            <div className="text-xs text-purple-700">Catechumen</div>
                        </div>
                    </div>
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                            <tr>
                                <th className="px-4 py-2">Date</th>
                                <th className="px-4 py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {memberHistory.map(record => (
                                <tr key={record.date} className="bg-white border-b hover:bg-slate-50">
                                    <td className="px-4 py-2">{sanitizeString(record.date)}</td>
                                    <td className="px-4 py-2 capitalize">{sanitizeAttendanceStatus(record.status)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-slate-50 rounded-b-xl flex justify-end">
                    <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AttendanceReportModal;