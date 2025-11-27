
// components/BulkAttendanceModal.tsx
import React, { useState, useMemo } from 'react';
import type { Member, Settings, AttendanceStatus } from '../types';
import { sanitizeString } from '../utils';

interface BulkAttendanceModalProps {
    members: Member[];
    settings: Settings;
    onApply: (memberIds: string[], status: AttendanceStatus) => void;
    onClose: () => void;
}

const BulkAttendanceModal: React.FC<BulkAttendanceModalProps> = ({ members, settings, onApply, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
    const [targetStatus, setTargetStatus] = useState<AttendanceStatus>('present');

    // Filter members based on criteria
    const filteredMembers = useMemo(() => {
        return members.filter(member => {
            const matchesClass = classFilter === 'all' || member.classNumber === classFilter;
            const matchesName = searchTerm === '' || member.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesClass && matchesName;
        });
    }, [members, classFilter, searchTerm]);

    const isAllSelected = filteredMembers.length > 0 && filteredMembers.every(m => selectedMemberIds.has(m.id));

    // Toggle Select All
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSelected = new Set(selectedMemberIds);
        if (e.target.checked) {
            filteredMembers.forEach(m => newSelected.add(m.id));
        } else {
            filteredMembers.forEach(m => newSelected.delete(m.id));
        }
        setSelectedMemberIds(newSelected);
    };

    // Toggle Single Member
    const handleToggleMember = (id: string) => {
        const newSelected = new Set(selectedMemberIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedMemberIds(newSelected);
    };

    const handleApply = () => {
        if (selectedMemberIds.size === 0) {
            alert("No members selected.");
            return;
        }
        onApply(Array.from(selectedMemberIds), targetStatus);
        onClose();
    };

    const classOptions = useMemo(() => {
        return ['all', ...Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1))];
    }, [settings.maxClasses]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Bulk Mark Attendance</h2>
                        <p className="text-slate-500 text-sm">Select members and apply a status to all at once.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
                </div>

                {/* Filters */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <input
                            type="text"
                            placeholder="Search Name..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full border-slate-300 rounded-lg shadow-sm py-3 px-4 text-lg"
                        />
                    </div>
                    <div>
                        <select
                            value={classFilter}
                            onChange={e => setClassFilter(e.target.value)}
                            className="w-full border-slate-300 rounded-lg shadow-sm py-3 px-4 text-lg"
                        >
                            {classOptions.map(cls => (
                                <option key={cls} value={cls}>
                                    {cls === 'all' ? 'All Classes' : `Class ${cls}`}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4">
                     <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                        <input 
                            type="checkbox" 
                            id="selectAll"
                            checked={isAllSelected}
                            onChange={handleSelectAll}
                            className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <label htmlFor="selectAll" className="font-bold text-slate-700 cursor-pointer select-none text-lg">
                            Select All Filtered ({filteredMembers.length})
                        </label>
                        <span className="ml-auto text-sm font-medium text-slate-500">
                            {selectedMemberIds.size} selected
                        </span>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredMembers.map(member => (
                            <div 
                                key={member.id} 
                                onClick={() => handleToggleMember(member.id)}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                    selectedMemberIds.has(member.id) 
                                        ? 'bg-indigo-50 border-indigo-300 shadow-sm' 
                                        : 'bg-white border-slate-200 hover:border-indigo-200'
                                }`}
                            >
                                <input 
                                    type="checkbox" 
                                    checked={selectedMemberIds.has(member.id)} 
                                    readOnly 
                                    className="w-5 h-5 text-indigo-600 rounded border-slate-300"
                                />
                                <div className="truncate">
                                    <div className="font-bold text-slate-800 truncate text-lg">{sanitizeString(member.name)}</div>
                                    <div className="text-sm text-slate-500">
                                        Class {member.classNumber || '-'} • ID: {member.memberNumber || 'N/A'}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredMembers.length === 0 && (
                            <div className="col-span-full text-center py-8 text-slate-400 italic text-lg">No members found matching filters.</div>
                        )}
                     </div>
                </div>

                {/* Actions Footer */}
                <div className="p-6 border-t border-slate-200 bg-slate-50">
                    <div className="flex flex-col sm:flex-row justify-end items-center gap-4">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <label className="font-bold text-slate-700 whitespace-nowrap text-lg">Mark Selected As:</label>
                            <select
                                value={targetStatus}
                                onChange={(e) => setTargetStatus(e.target.value as AttendanceStatus)}
                                className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-medium py-3 px-4 text-slate-700 text-lg"
                            >
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                                <option value="sick">Sick</option>
                                <option value="travel">Travel</option>
                                <option value="catechumen">Catechumen</option>
                            </select>
                        </div>

                        <button
                            onClick={handleApply}
                            disabled={selectedMemberIds.size === 0}
                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 text-lg"
                        >
                            Apply to {selectedMemberIds.size} Members
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkAttendanceModal;
