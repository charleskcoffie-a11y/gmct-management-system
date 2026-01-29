import React, { useState, useMemo } from 'react';
import type { Member, AttendanceStatus } from '../types';

interface SelectedMember {
    id: string;
    name: string;
    status: AttendanceStatus;
}

interface MobileAttendanceMarkingProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (selections: Map<string, AttendanceStatus>) => void;
    members: Member[];
    currentAttendance: Map<string, AttendanceStatus>;
    isLoading?: boolean;
}

const MobileAttendanceMarking: React.FC<MobileAttendanceMarkingProps> = ({
    isOpen,
    onClose,
    onSave,
    members,
    currentAttendance,
    isLoading = false
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<Map<string, AttendanceStatus>>(new Map(currentAttendance));
    const [isSaving, setIsSaving] = useState(false);

    // Filter members by search query
    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return members;
        const query = searchQuery.toLowerCase();
        return members.filter(m => m.name.toLowerCase().includes(query) || m.phone?.includes(searchQuery));
    }, [members, searchQuery]);

    const handleAddStatus = (memberId: string, status: AttendanceStatus) => {
        const newMap = new Map(selectedMembers);
        newMap.set(memberId, status);
        setSelectedMembers(newMap);
    };

    const handleRemoveSelection = (memberId: string) => {
        const newMap = new Map(selectedMembers);
        newMap.delete(memberId);
        setSelectedMembers(newMap);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            onSave(selectedMembers);
            setSearchQuery('');
        } finally {
            setIsSaving(false);
        }
    };

    const selectedCount = selectedMembers.size;
    const presentCount = Array.from(selectedMembers.values()).filter(s => s === 'present').length;
    const sickCount = Array.from(selectedMembers.values()).filter(s => s === 'sick').length;
    const travelCount = Array.from(selectedMembers.values()).filter(s => s === 'travel').length;
    const absentCount = Array.from(selectedMembers.values()).filter(s => s === 'absent').length;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 overflow-hidden backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col border border-gray-100">
                {/* Header */}
                <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-600 px-8 py-6 flex-shrink-0 rounded-t-3xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-white">📱 Mark Attendance</h2>
                            <p className="text-indigo-100 text-sm mt-1">Search & mark members quickly</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-indigo-700 p-2 rounded-lg transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="p-6 pb-4 flex-shrink-0 border-b border-gray-200">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="🔍 Search name or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full border-2 border-gray-300 rounded-xl py-3 px-4 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                            autoFocus
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200 flex-shrink-0">
                    <div className="grid grid-cols-5 gap-2 text-center">
                        <div className="bg-white rounded-lg p-3 border-2 border-gray-200">
                            <div className="text-xs text-gray-600 font-bold">Total</div>
                            <div className="text-xl font-bold text-gray-800">{selectedCount}</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 border-2 border-green-200">
                            <div className="text-xs text-green-600 font-bold">Present</div>
                            <div className="text-xl font-bold text-green-600">{presentCount}</div>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3 border-2 border-orange-200">
                            <div className="text-xs text-orange-600 font-bold">Sick</div>
                            <div className="text-xl font-bold text-orange-600">{sickCount}</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border-2 border-blue-200">
                            <div className="text-xs text-blue-600 font-bold">Travel</div>
                            <div className="text-xl font-bold text-blue-600">{travelCount}</div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3 border-2 border-red-200">
                            <div className="text-xs text-red-600 font-bold">Absent</div>
                            <div className="text-xl font-bold text-red-600">{absentCount}</div>
                        </div>
                    </div>
                </div>

                {/* Members List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {filteredMembers.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400 text-lg">No members found</p>
                            <p className="text-gray-400 text-sm mt-2">Try a different search term</p>
                        </div>
                    ) : (
                        filteredMembers.map(member => {
                            const status = selectedMembers.get(member.id);
                            const isSelected = !!status;
                            
                            return (
                                <div
                                    key={member.id}
                                    className={`p-3 rounded-lg border transition-all ${
                                        isSelected
                                            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-indigo-300 shadow-sm'
                                            : 'bg-gray-50 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900 text-base">{member.name}</h3>
                                            {member.phone && <p className="text-xs text-gray-500">{member.phone}</p>}
                                        </div>
                                        {isSelected && (
                                            <button
                                                onClick={() => handleRemoveSelection(member.id)}
                                                className="text-red-500 hover:text-red-700 font-bold text-lg ml-2"
                                                title="Remove selection"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                    
                                    {!isSelected ? (
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <button
                                                onClick={() => handleAddStatus(member.id, 'present')}
                                                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-1.5 px-2 rounded transition flex items-center justify-center gap-1 text-xs"
                                            >
                                                <span className="text-sm">✓</span> Present
                                            </button>
                                            <button
                                                onClick={() => handleAddStatus(member.id, 'sick')}
                                                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-1.5 px-2 rounded transition flex items-center justify-center gap-1 text-xs"
                                            >
                                                <span className="text-sm">🤒</span> Sick
                                            </button>
                                            <button
                                                onClick={() => handleAddStatus(member.id, 'travel')}
                                                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-1.5 px-2 rounded transition flex items-center justify-center gap-1 text-xs"
                                            >
                                                <span className="text-sm">✈️</span> Travel
                                            </button>
                                            <button
                                                onClick={() => handleAddStatus(member.id, 'absent')}
                                                className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-1.5 px-2 rounded transition flex items-center justify-center gap-1 text-xs"
                                            >
                                                <span className="text-lg">✗</span> Absent
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-2 px-2 bg-white rounded border border-indigo-300">
                                            <div className="text-2xl font-black mb-1">
                                                {status === 'present' && '✓'}
                                                {status === 'sick' && '🤒'}
                                                {status === 'travel' && '✈️'}
                                                {status === 'absent' && '✗'}
                                            </div>
                                            <div className="text-center">
                                                <div className={`text-sm font-bold mb-1 ${
                                                    status === 'present' ? 'text-green-600' :
                                                    status === 'sick' ? 'text-orange-600' :
                                                    status === 'travel' ? 'text-blue-600' :
                                                    'text-red-600'
                                                }`}>
                                                    {status === 'present' && 'PRESENT'}
                                                    {status === 'sick' && 'SICK'}
                                                    {status === 'travel' && 'TRAVELLED'}
                                                    {status === 'absent' && 'ABSENT'}
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveSelection(member.id)}
                                                    className="mt-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded transition text-xs"
                                                >
                                                    Change
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 flex justify-end gap-3 flex-shrink-0 border-t border-gray-200 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-white border border-slate-300 hover:border-slate-400 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition duration-200 text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={selectedCount === 0 || isSaving || isLoading}
                        className={`px-6 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold rounded-lg transition duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 text-sm`}
                    >
                        {isSaving || isLoading ? (
                            <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Saving {selectedCount}...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Save {selectedCount} Members
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileAttendanceMarking;
