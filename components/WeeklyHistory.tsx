import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { WeeklyHistoryRecord, VisitorRecord, ServiceDonation } from '../types';
import { sanitizeWeeklyHistoryRecord, formatCurrency } from '../utils';
import HistoryArchiveModal from './HistoryArchiveModal';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface WeeklyHistoryProps {
    history: WeeklyHistoryRecord[];
    setHistory: React.Dispatch<React.SetStateAction<WeeklyHistoryRecord[]>>;
}

const initialFormState = (): WeeklyHistoryRecord => ({
    id: uuidv4(),
    dateOfService: new Date().toISOString().slice(0, 10),
    societyName: 'Ghana Methodist Church Toronto (GMCT)',
    officiant: '',
    liturgist: '',
    serviceTypes: [],
    serviceTypeOther: '',
    sermonTopic: '',
    worshipHighlights: '',
    announcementsBy: '',
    attendance: { men: 0, women: 0, junior: 0, children: 0, visitors: 0, catechumens: 0 },
    visitorsList: [],
    donationsList: [],
    noDonation: false,
    newMembersDetails: '',
    newMembersContact: '',
    events: '',
    observations: '',
    preparedBy: '',
});

const serviceTypeOptions = [
    'Divine Service',
    'Communion',
    'Youth Sunday',
    'Lay Movement',
    'Revival/Prayer Sunday',
    'Thanksgiving',
    'Outreach',
    'Other'
];

const WeeklyHistory: React.FC<WeeklyHistoryProps> = ({ history, setHistory }) => {
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [formData, setFormData] = useState<WeeklyHistoryRecord>(initialFormState());
    const [showArchive, setShowArchive] = useState(false);
    const [isFullEditorOpen, setIsFullEditorOpen] = useState(false);
    const [activeModal, setActiveModal] = useState<'details' | 'attendance' | 'visitors' | 'donations' | 'events' | null>(null);
    const [editingArchiveId, setEditingArchiveId] = useState<string | null>(null);
    
    // Temporary state for new donor/visitor input
    const [newDonor, setNewDonor] = useState({ donor: '', amount: 0, description: '' });
    const [newVisitor, setNewVisitor] = useState({ name: '', from: '', position: '', reason: '' });

    // Always start with a clean slate on load
    useEffect(() => {
        setSelectedRecordId(null);
        setFormData(initialFormState());
    }, []);

    useEffect(() => {
        if (selectedRecordId) {
            const record = history.find(h => h.id === selectedRecordId);
            if (record) setFormData(record);
        }
        // Note: We don't reset to initialFormState here when selectedRecordId is null
        // because that would clear the form while the user is typing.
        // The form is explicitly reset when the New button is clicked.
    }, [selectedRecordId, history]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAttendanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, attendance: { ...prev.attendance, [name as keyof typeof prev.attendance]: parseInt(value) || 0 }}));
    };

    const handleAddDonation = () => {
        if (newDonor.donor.trim() && newDonor.amount > 0) {
            setFormData(prev => ({
                ...prev,
                donationsList: [...prev.donationsList, { donor: newDonor.donor, amount: newDonor.amount, description: newDonor.description }]
            }));
            setNewDonor({ donor: '', amount: 0, description: '' });
        }
    };

    const handleRemoveDonation = (index: number) => {
        setFormData(prev => ({
            ...prev,
            donationsList: prev.donationsList.filter((_, i) => i !== index)
        }));
    };

    const handleAddVisitor = () => {
        if (newVisitor.name.trim()) {
            setFormData(prev => ({
                ...prev,
                visitorsList: [...prev.visitorsList, { name: newVisitor.name, from: newVisitor.from, position: newVisitor.position, reason: newVisitor.reason }]
            }));
            setNewVisitor({ name: '', from: '', position: '', reason: '' });
        }
    };

    const handleRemoveVisitor = (index: number) => {
        setFormData(prev => ({
            ...prev,
            visitorsList: prev.visitorsList.filter((_, i) => i !== index)
        }));
    };

    const handleServiceTypeToggle = (type: string) => {
        setFormData(prev => ({
            ...prev,
            serviceTypes: prev.serviceTypes.includes(type)
                ? prev.serviceTypes.filter(t => t !== type)
                : [...prev.serviceTypes, type]
        }));
    };

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const sanitized = sanitizeWeeklyHistoryRecord(formData);
        const newHistory = history.findIndex(h => h.id === sanitized.id) > -1 
            ? history.map(h => h.id === sanitized.id ? sanitized : h)
            : [...history, sanitized];
        setHistory(newHistory);
        alert('Record saved!');
        setSelectedRecordId(sanitized.id);
        setEditingArchiveId(null);
        setFormData(sanitized);
    };

    const handleSaveAndReset = () => {
        handleSubmit();
        setSelectedRecordId(null);
        setFormData(initialFormState());
        setActiveModal(null);
        setIsFullEditorOpen(false);
    };

    const handleEditArchiveRecord = (record: WeeklyHistoryRecord) => {
        setSelectedRecordId(record.id);
        setFormData(record);
        setEditingArchiveId(record.id);
    };

    const totalAttendance = useMemo(() => {
        const { men, women, junior, children, visitors, catechumens } = formData.attendance;
        return men + women + junior + children + visitors + catechumens;
    }, [formData.attendance]);

    // Calculate completion status - all required sections
    const completionStatus = useMemo(() => {
        const sections = [
            { name: 'Service Details', filled: !!formData.dateOfService && !!formData.officiant },
            { name: 'Attendance', filled: totalAttendance > 0 },
            { name: 'Visitors', filled: formData.visitorsList.length > 0 },
            { name: 'Donations', filled: formData.donationsList.length > 0 || formData.noDonation },
            { name: 'Worship', filled: !!formData.sermonTopic || !!formData.events },
        ];
        const completed = sections.filter(s => s.filled).length;
        return { sections, completed, total: sections.length };
    }, [formData, totalAttendance]);

    const canSave = completionStatus.completed === completionStatus.total;

    const archiveCount = history.length;

    const monthlyAttendance = useMemo(() => {
        const aggregates: Record<string, any> = {};
        history.forEach(h => {
            const monthKey = (h.dateOfService || '').slice(0, 7) || 'Unknown';
            if (!aggregates[monthKey]) {
                aggregates[monthKey] = {
                    month: monthKey,
                    men: 0,
                    women: 0,
                    junior: 0,
                    children: 0,
                    visitors: 0,
                    catechumens: 0,
                };
            }
            const att = h.attendance || {} as any;
            aggregates[monthKey].men += att.men || 0;
            aggregates[monthKey].women += att.women || 0;
            aggregates[monthKey].junior += att.junior || 0;
            aggregates[monthKey].children += att.children || 0;
            aggregates[monthKey].visitors += att.visitors || 0;
            aggregates[monthKey].catechumens += att.catechumens || 0;
        });
        return Object.values(aggregates).sort((a: any, b: any) => (a.month > b.month ? 1 : -1));
    }, [history]);

    const filteredHistory = useMemo(() => {
        const now = new Date();
        return history.filter(rec => {
            const recDate = new Date(rec.dateOfService);
            return recDate.getMonth() === now.getMonth() && recDate.getFullYear() === now.getFullYear();
        });
    }, [history]);

    return (
        <div className="pb-12 max-w-6xl mx-auto p-4">
            <h2 className="text-3xl font-bold mb-6 text-white bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-3 rounded-lg inline-block">📅 Weekly History</h2>

            {/* Show empty state when no history and no active editing */}
            {history.length === 0 && !selectedRecordId ? (
                <div className="text-center py-20 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto mb-6 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-3xl font-bold text-slate-800 mb-3">No Weekly History Records Yet</p>
                    <p className="text-lg text-slate-600 mb-6">Start recording your weekly service history to track attendance, visitors, and events.</p>
                    <button 
                        onClick={() => setSelectedRecordId(null)}
                        className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 text-base"
                    >
                        ✏️ Create First Record
                    </button>
                </div>
            ) : (
                <>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <button onClick={() => { setShowArchive(true); setEditingArchiveId(null); }} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-3 rounded text-sm flex items-center justify-between gap-2">
                    <span>📚 Archives</span>
                    <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">{archiveCount}</span>
                </button>
                <button onClick={() => { setSelectedRecordId(null); setFormData(initialFormState()); setIsFullEditorOpen(true); }} className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-3 rounded text-sm">✏️ New</button>
                <button onClick={() => { setSelectedRecordId(null); setFormData(initialFormState()); setActiveModal(null); setIsFullEditorOpen(false); }} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-3 rounded text-sm">🔄 Reset</button>
                <button onClick={() => window.print()} disabled={!selectedRecordId} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-3 rounded text-sm">🖨️ Print</button>
                <button onClick={() => { if (selectedRecordId) { if (window.confirm('Delete?')) { setHistory(history.filter(h => h.id !== selectedRecordId)); setSelectedRecordId(null); } } }} disabled={!selectedRecordId} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 px-3 rounded text-sm">🗑️ Delete</button>
            </div>

            <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-800">Monthly Attendance by Category</h3>
                    <span className="text-xs text-gray-500">Totals per month</span>
                </div>
                {monthlyAttendance.length === 0 ? (
                    <div className="text-sm text-gray-500">No attendance data yet.</div>
                ) : (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyAttendance} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="men" stackId="a" fill="#2563eb" name="Men" />
                                <Bar dataKey="women" stackId="a" fill="#ec4899" name="Women" />
                                <Bar dataKey="junior" stackId="a" fill="#f59e0b" name="Junior" />
                                <Bar dataKey="children" stackId="a" fill="#10b981" name="Children" />
                                <Bar dataKey="visitors" stackId="a" fill="#8b5cf6" name="Visitors" />
                                <Bar dataKey="catechumens" stackId="a" fill="#ef4444" name="Catechumens" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Completion Progress Indicator */}
            {selectedRecordId && (
                <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-sm text-gray-700">Form Completion</h3>
                        <span className="text-2xl font-bold text-purple-600">{completionStatus.completed}/{completionStatus.total}</span>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-3 mb-3">
                        <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${(completionStatus.completed / completionStatus.total) * 100}%` }}
                        ></div>
                    </div>
                    <div className="mb-3">
                        {completionStatus.sections.some(s => !s.filled) && (
                            <div className="text-sm font-semibold text-red-700 mb-2">
                                ⚠️ Missing: {completionStatus.sections.filter(s => !s.filled).map(s => s.name).join(', ')}
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {completionStatus.sections.map(section => (
                            <div key={section.name} className={`text-xs p-2 rounded font-semibold ${section.filled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {section.filled ? '✓' : '✗'} {section.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <button type="button" onClick={() => setActiveModal('details')} className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg hover:shadow-lg">
                    <div className="text-2xl mb-1">📋</div>
                    <h3 className="font-bold text-sm text-blue-900">Service Details</h3>
                    <p className="text-xs text-blue-600">{formData.dateOfService}</p>
                </button>

                <button type="button" onClick={() => setActiveModal('attendance')} className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-lg hover:shadow-lg">
                    <div className="text-2xl mb-1">👥</div>
                    <h3 className="font-bold text-sm text-emerald-900">Attendance</h3>
                    <p className="text-lg font-bold text-emerald-700">{totalAttendance}</p>
                </button>

                <button type="button" onClick={() => setActiveModal('visitors')} className="bg-purple-50 border-2 border-purple-200 p-4 rounded-lg hover:shadow-lg">
                    <div className="text-2xl mb-1">🤝</div>
                    <h3 className="font-bold text-sm text-purple-900">Visitors</h3>
                    <p className="text-lg font-bold text-purple-700">{formData.visitorsList.length}</p>
                </button>

                <button type="button" onClick={() => setActiveModal('donations')} className="bg-rose-50 border-2 border-rose-200 p-4 rounded-lg hover:shadow-lg">
                    <div className="text-2xl mb-1">💝</div>
                    <h3 className="font-bold text-sm text-rose-900">Donations</h3>
                    <p className="text-lg font-bold text-rose-700">{formData.donationsList.length}</p>
                </button>

                <button type="button" onClick={() => setActiveModal('events')} className="bg-orange-50 border-2 border-orange-200 p-4 rounded-lg hover:shadow-lg sm:col-span-2 lg:col-span-1">
                    <div className="text-2xl mb-1">🙏</div>
                    <h3 className="font-bold text-sm text-orange-900">Worship</h3>
                    <p className="text-xs text-orange-600 line-clamp-1">{formData.sermonTopic || 'Add topic'}</p>
                </button>
            </div>

            <button 
                type="button" 
                onClick={handleSubmit} 
                disabled={!canSave}
                className={`w-full mt-6 font-bold py-3 rounded-lg shadow-lg transition-all ${
                    canSave 
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer' 
                        : 'bg-gray-400 text-gray-700 cursor-not-allowed'
                }`}
            >
                {canSave ? '💾 Save Record - Complete!' : `⚠️ Complete ${completionStatus.total - completionStatus.completed} more sections`}
            </button>

            {activeModal === 'details' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-gray-900">📋 Service Details</h2>
                        <div className="space-y-3 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Date of Service *</label>
                                <input type="date" name="dateOfService" value={formData.dateOfService} onChange={handleChange} className="w-full border-2 border-blue-300 rounded p-2"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Officiant *</label>
                                <input type="text" name="officiant" value={formData.officiant} onChange={handleChange} placeholder="e.g., Rev. John Doe" className="w-full border-2 border-blue-300 rounded p-2"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Liturgist</label>
                                <input type="text" name="liturgist" value={formData.liturgist} onChange={handleChange} placeholder="Optional" className="w-full border-2 rounded p-2"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Prepared By</label>
                                <input type="text" name="preparedBy" value={formData.preparedBy} onChange={handleChange} placeholder="Person preparing this report" className="w-full border-2 rounded p-2" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-2">Service Types *</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {serviceTypeOptions.map(type => (
                                        <label key={type} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-blue-50 border border-blue-200">
                                            <input 
                                                type="checkbox" 
                                                checked={formData.serviceTypes.includes(type)}
                                                onChange={() => handleServiceTypeToggle(type)}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-xs font-bold text-gray-700">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            {formData.serviceTypes.includes('Other') && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Specify Other Service Type</label>
                                    <input type="text" name="serviceTypeOther" value={formData.serviceTypeOther} onChange={handleChange} placeholder="Please specify" className="w-full border-2 rounded p-2"/>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-gray-300 text-gray-900 py-2 rounded font-bold hover:bg-gray-400">Cancel</button>
                            <button onClick={() => { setActiveModal(null); }} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'attendance' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-sm w-full p-6">
                        <h2 className="text-xl font-bold mb-4 text-gray-900">👥 Attendance Breakdown</h2>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-xs font-bold text-gray-700">Men</label>
                                <input type="number" name="men" value={formData.attendance.men} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700">Women</label>
                                <input type="number" name="women" value={formData.attendance.women} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700">Junior</label>
                                <input type="number" name="junior" value={formData.attendance.junior} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700">Children</label>
                                <input type="number" name="children" value={formData.attendance.children} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700">Visitors</label>
                                <input type="number" name="visitors" value={formData.attendance.visitors} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700">Catechumens</label>
                                <input type="number" name="catechumens" value={formData.attendance.catechumens} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1"/>
                            </div>
                        </div>
                        <div className={`text-lg font-bold p-3 rounded mb-4 ${totalAttendance > 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`}>
                            Total Attendance: {totalAttendance}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-gray-300 text-gray-900 py-2 rounded font-bold hover:bg-gray-400">Cancel</button>
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-emerald-600 text-white py-2 rounded font-bold hover:bg-emerald-700">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'visitors' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-gray-900">🤝 Visitors List ({formData.visitorsList.length})</h2>
                        
                        {/* Add New Visitor */}
                        <div className="bg-purple-50 border-2 border-purple-200 p-3 rounded-lg mb-4">
                            <h3 className="font-bold text-sm text-purple-900 mb-3">Add New Visitor</h3>
                            <div className="space-y-2">
                                <input 
                                    type="text" 
                                    value={newVisitor.name}
                                    onChange={(e) => setNewVisitor(prev => ({...prev, name: e.target.value}))}
                                    placeholder="Visitor Name *"
                                    className="w-full border-2 border-purple-300 rounded p-2 text-sm"
                                />
                                <input 
                                    type="text" 
                                    value={newVisitor.from}
                                    onChange={(e) => setNewVisitor(prev => ({...prev, from: e.target.value}))}
                                    placeholder="From (church/location)"
                                    className="w-full border-2 rounded p-2 text-sm"
                                />
                                <input 
                                    type="text" 
                                    value={newVisitor.position}
                                    onChange={(e) => setNewVisitor(prev => ({...prev, position: e.target.value}))}
                                    placeholder="Position/Role (optional)"
                                    className="w-full border-2 rounded p-2 text-sm"
                                />
                                <input 
                                    type="text" 
                                    value={newVisitor.reason}
                                    onChange={(e) => setNewVisitor(prev => ({...prev, reason: e.target.value}))}
                                    placeholder="Reason for visit (optional)"
                                    className="w-full border-2 rounded p-2 text-sm"
                                />
                                <button 
                                    onClick={handleAddVisitor}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded text-sm"
                                >
                                    ➕ Add Visitor
                                </button>
                            </div>
                        </div>

                        {/* List of Visitors */}
                        <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
                            {formData.visitorsList.length > 0 ? (
                                formData.visitorsList.map((v, i) => (
                                    <div key={i} className="text-sm bg-purple-100 p-3 rounded border border-purple-300 flex justify-between items-start gap-2">
                                        <div className="flex-1">
                                            <div className="font-bold text-purple-900">{v.name}</div>
                                            {v.from && <div className="text-xs text-purple-700">From: {v.from}</div>}
                                            {v.position && <div className="text-xs text-purple-700">Position: {v.position}</div>}
                                            {v.reason && <div className="text-xs text-purple-700">Reason: {v.reason}</div>}
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveVisitor(i)}
                                            className="text-red-600 hover:text-red-800 font-bold text-lg"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-gray-500">No visitors recorded yet</div>
                            )}
                        </div>
                        
                        <div className="flex gap-2">
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-gray-300 text-gray-900 py-2 rounded font-bold hover:bg-gray-400">Cancel</button>
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-purple-600 text-white py-2 rounded font-bold hover:bg-purple-700">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'donations' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-gray-900">💝 Donations ({formData.donationsList.length})</h2>
                        
                        {/* Add New Donation */}
                        <div className="bg-rose-50 border-2 border-rose-200 p-3 rounded-lg mb-4">
                            <h3 className="font-bold text-sm text-rose-900 mb-3">Add New Donation</h3>
                            <div className="space-y-2">
                                <input 
                                    type="text" 
                                    value={newDonor.donor}
                                    onChange={(e) => setNewDonor(prev => ({...prev, donor: e.target.value}))}
                                    placeholder="Donor Name *"
                                    className="w-full border-2 border-rose-300 rounded p-2 text-sm"
                                />
                                <input 
                                    type="number" 
                                    value={newDonor.amount || ''}
                                    onChange={(e) => setNewDonor(prev => ({...prev, amount: parseFloat(e.target.value) || 0}))}
                                    placeholder="Amount *"
                                    className="w-full border-2 border-rose-300 rounded p-2 text-sm"
                                    min="0"
                                    step="0.01"
                                />
                                <input 
                                    type="text" 
                                    value={newDonor.description}
                                    onChange={(e) => setNewDonor(prev => ({...prev, description: e.target.value}))}
                                    placeholder="Description/Purpose (optional)"
                                    className="w-full border-2 rounded p-2 text-sm"
                                />
                                <button 
                                    onClick={handleAddDonation}
                                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded text-sm"
                                >
                                    ➕ Add Donation
                                </button>
                            </div>
                        </div>

                        {/* No Donation Checkbox */}
                        <div className="mb-4 p-3 bg-rose-50 border-2 border-rose-200 rounded-lg">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.noDonation || false}
                                    onChange={(e) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            noDonation: e.target.checked,
                                            donationsList: e.target.checked ? [] : prev.donationsList
                                        }));
                                    }}
                                    className="w-4 h-4 cursor-pointer"
                                />
                                <span className="text-sm font-bold text-rose-900">No donations received this week</span>
                            </label>
                        </div>

                        {/* List of Donations */}
                        <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
                            {formData.donationsList.length > 0 ? (
                                formData.donationsList.map((d, i) => (
                                    <div key={i} className="text-sm bg-rose-100 p-3 rounded border border-rose-300 flex justify-between items-start gap-2">
                                        <div className="flex-1">
                                            <div className="font-bold text-rose-900">{formatCurrency(d.amount)}</div>
                                            {d.donor && <div className="text-xs text-rose-700">From: {d.donor}</div>}
                                            {d.description && <div className="text-xs text-rose-700">{d.description}</div>}
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveDonation(i)}
                                            className="text-red-600 hover:text-red-800 font-bold text-lg"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-gray-500">{formData.noDonation ? '✓ No donations recorded' : 'No donations recorded yet'}</div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-gray-300 text-gray-900 py-2 rounded font-bold hover:bg-gray-400">Cancel</button>
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-rose-600 text-white py-2 rounded font-bold hover:bg-rose-700">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'events' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-sm w-full p-6">
                        <h2 className="text-xl font-bold mb-4 text-gray-900">🙏 Worship & Events</h2>
                        <div className="space-y-3 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Sermon Topic *</label>
                                <input 
                                    type="text" 
                                    name="sermonTopic" 
                                    value={formData.sermonTopic} 
                                    onChange={handleChange} 
                                    placeholder="Main sermon topic"
                                    className="w-full border-2 border-orange-300 rounded p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Special Events / Announcements</label>
                                <textarea 
                                    name="events" 
                                    value={formData.events} 
                                    onChange={handleChange} 
                                    placeholder="Special events, announcements, highlights..." 
                                    className="w-full border-2 rounded p-2" 
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Worship Highlights</label>
                                <textarea 
                                    name="worshipHighlights" 
                                    value={formData.worshipHighlights} 
                                    onChange={handleChange} 
                                    placeholder="Special moments during worship..." 
                                    className="w-full border-2 rounded p-2" 
                                    rows={2}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-gray-300 text-gray-900 py-2 rounded font-bold hover:bg-gray-400">Cancel</button>
                            <button onClick={() => setActiveModal(null)} className="flex-1 bg-orange-600 text-white py-2 rounded font-bold hover:bg-orange-700">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {isFullEditorOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-gradient-to-r from-amber-600 to-orange-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-extrabold">New Weekly History</h3>
                                <p className="text-sm opacity-90">Fill all sections below, then save.</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsFullEditorOpen(false)}
                                    className="bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-4 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => { handleSubmit(); setIsFullEditorOpen(false); }}
                                    className={`font-extrabold py-2 px-4 rounded-lg shadow ${canSave ? 'bg-white text-amber-700' : 'bg-amber-300 text-amber-800 opacity-75 cursor-not-allowed'}`}
                                    disabled={!canSave}
                                >
                                    Save
                                </button>
                                <button
                                    onClick={handleSaveAndReset}
                                    className={`font-extrabold py-2 px-4 rounded-lg shadow ${canSave ? 'bg-amber-100 text-amber-900' : 'bg-amber-200 text-amber-700 opacity-75 cursor-not-allowed'}`}
                                    disabled={!canSave}
                                >
                                    Save & New
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Completion Status Bar - Sticky */}
                            <div className="sticky top-0 z-40 bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-200 p-4 -m-6 mb-6 px-6">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-bold text-sm text-amber-900">Completion Status: {completionStatus.completed}/{completionStatus.total}</h4>
                                    <span className={`text-sm font-bold ${canSave ? 'text-green-600' : 'text-red-600'}`}>
                                        {canSave ? '✓ Ready to Save' : '⚠️ Incomplete'}
                                    </span>
                                </div>
                                <div className="w-full bg-amber-200 rounded-full h-2 mb-3">
                                    <div 
                                        className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${(completionStatus.completed / completionStatus.total) * 100}%` }}
                                    ></div>
                                </div>
                                {completionStatus.sections.some(s => !s.filled) && (
                                    <div className="text-sm font-semibold text-red-700">
                                        Missing: {completionStatus.sections.filter(s => !s.filled).map(s => s.name).join(', ')}
                                    </div>
                                )}
                            </div>
                            {/* Service Details */}
                            <section className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">📋</span>
                                    <h4 className="text-blue-900 font-bold">Service Details</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Date of Service *</label>
                                        <input type="date" name="dateOfService" value={formData.dateOfService} onChange={handleChange} className="w-full border-2 border-blue-300 rounded p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Officiant *</label>
                                        <input type="text" name="officiant" value={formData.officiant} onChange={handleChange} placeholder="e.g., Rev. John Doe" className="w-full border-2 border-blue-300 rounded p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Liturgist</label>
                                        <input type="text" name="liturgist" value={formData.liturgist} onChange={handleChange} placeholder="Optional" className="w-full border-2 rounded p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Prepared By</label>
                                        <input type="text" name="preparedBy" value={formData.preparedBy} onChange={handleChange} placeholder="Person preparing this report" className="w-full border-2 rounded p-2" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-gray-700 mb-2">Service Types *</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {serviceTypeOptions.map(type => (
                                                <label key={type} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-blue-100 border border-blue-200">
                                                    <input type="checkbox" checked={formData.serviceTypes.includes(type)} onChange={() => handleServiceTypeToggle(type)} className="w-4 h-4" />
                                                    <span className="text-xs font-bold text-gray-700">{type}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {formData.serviceTypes.includes('Other') && (
                                            <div className="mt-2">
                                                <label className="block text-xs font-bold text-gray-700 mb-1">Specify Other Service Type</label>
                                                <input type="text" name="serviceTypeOther" value={formData.serviceTypeOther} onChange={handleChange} placeholder="Please specify" className="w-full border-2 rounded p-2" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Attendance */}
                            <section className="border-2 border-emerald-200 rounded-xl p-4 bg-emerald-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">👥</span>
                                    <h4 className="text-emerald-900 font-bold">Attendance</h4>
                                    <span className="ml-auto text-emerald-700 font-bold">Total: {totalAttendance}</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {(['men','women','junior','children','visitors','catechumens'] as const).map(key => (
                                        <div key={key}>
                                            <label className="text-xs font-bold text-gray-700 capitalize">{key}</label>
                                            <input type="number" name={key} value={(formData.attendance as any)[key]} onChange={handleAttendanceChange} className="w-full border-2 border-emerald-300 rounded p-1" />
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Visitors */}
                            <section className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">🤝</span>
                                    <h4 className="text-purple-900 font-bold">Visitors ({formData.visitorsList.length})</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                                    <input type="text" value={newVisitor.name} onChange={(e) => setNewVisitor(prev => ({ ...prev, name: e.target.value }))} placeholder="Visitor Name *" className="w-full border-2 border-purple-300 rounded p-2 text-sm" />
                                    <input type="text" value={newVisitor.from} onChange={(e) => setNewVisitor(prev => ({ ...prev, from: e.target.value }))} placeholder="From (church/location)" className="w-full border-2 rounded p-2 text-sm" />
                                    <input type="text" value={newVisitor.position} onChange={(e) => setNewVisitor(prev => ({ ...prev, position: e.target.value }))} placeholder="Position/Role (optional)" className="w-full border-2 rounded p-2 text-sm" />
                                    <input type="text" value={newVisitor.reason} onChange={(e) => setNewVisitor(prev => ({ ...prev, reason: e.target.value }))} placeholder="Reason for visit (optional)" className="w-full border-2 rounded p-2 text-sm" />
                                </div>
                                <button onClick={handleAddVisitor} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded text-sm">➕ Add Visitor</button>
                                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                                    {formData.visitorsList.length > 0 ? (
                                        formData.visitorsList.map((v, i) => (
                                            <div key={i} className="text-sm bg-purple-100 p-3 rounded border border-purple-300 flex justify-between items-start gap-2">
                                                <div className="flex-1">
                                                    <div className="font-bold text-purple-900">{v.name}</div>
                                                    {v.from && <div className="text-xs text-purple-700">From: {v.from}</div>}
                                                    {v.position && <div className="text-xs text-purple-700">Position: {v.position}</div>}
                                                    {v.reason && <div className="text-xs text-purple-700">Reason: {v.reason}</div>}
                                                </div>
                                                <button onClick={() => handleRemoveVisitor(i)} className="text-red-600 hover:text-red-800 font-bold text-lg">×</button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-2 text-gray-500">No visitors recorded yet</div>
                                    )}
                                </div>
                            </section>

                            {/* Donations */}
                            <section className="border-2 border-rose-200 rounded-xl p-4 bg-rose-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">💝</span>
                                    <h4 className="text-rose-900 font-bold">Donations ({formData.donationsList.length})</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                                    <input type="text" value={newDonor.donor} onChange={(e) => setNewDonor(prev => ({ ...prev, donor: e.target.value }))} placeholder="Donor Name *" className="w-full border-2 border-rose-300 rounded p-2 text-sm" />
                                    <input type="number" value={newDonor.amount || ''} onChange={(e) => setNewDonor(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))} placeholder="Amount *" className="w-full border-2 border-rose-300 rounded p-2 text-sm" min="0" step="0.01" />
                                    <input type="text" value={newDonor.description} onChange={(e) => setNewDonor(prev => ({ ...prev, description: e.target.value }))} placeholder="Description/Purpose (optional)" className="w-full border-2 rounded p-2 text-sm" />
                                </div>
                                <button onClick={handleAddDonation} className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded text-sm">➕ Add Donation</button>
                                <div className="mt-3 p-3 bg-white border-2 border-rose-200 rounded-lg">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.noDonation || false}
                                            onChange={(e) => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    noDonation: e.target.checked,
                                                    donationsList: e.target.checked ? [] : prev.donationsList
                                                }));
                                            }}
                                            className="w-4 h-4 cursor-pointer"
                                        />
                                        <span className="text-sm font-bold text-rose-900">No donations received this week</span>
                                    </label>
                                </div>
                                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                                    {formData.donationsList.length > 0 ? (
                                        formData.donationsList.map((d, i) => (
                                            <div key={i} className="text-sm bg-rose-100 p-3 rounded border border-rose-300 flex justify-between items-start gap-2">
                                                <div className="flex-1">
                                                    <div className="font-bold text-rose-900">{formatCurrency(d.amount)}</div>
                                                    {d.donor && <div className="text-xs text-rose-700">From: {d.donor}</div>}
                                                    {d.description && <div className="text-xs text-rose-700">{d.description}</div>}
                                                </div>
                                                <button onClick={() => handleRemoveDonation(i)} className="text-red-600 hover:text-red-800 font-bold text-lg">×</button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-2 text-gray-500">{formData.noDonation ? '✓ No donations recorded' : 'No donations recorded yet'}</div>
                                    )}
                                </div>
                            </section>

                            {/* Worship & Events */}
                            <section className="border-2 border-orange-200 rounded-xl p-4 bg-orange-50">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">🙏</span>
                                    <h4 className="text-orange-900 font-bold">Worship & Events</h4>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Sermon Topic *</label>
                                        <input type="text" name="sermonTopic" value={formData.sermonTopic} onChange={handleChange} placeholder="Main sermon topic" className="w-full border-2 border-orange-300 rounded p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Special Events / Announcements</label>
                                        <textarea name="events" value={formData.events} onChange={handleChange} placeholder="Special events, announcements, highlights..." className="w-full border-2 rounded p-2" rows={3} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Worship Highlights</label>
                                        <textarea name="worshipHighlights" value={formData.worshipHighlights} onChange={handleChange} placeholder="Special moments during worship..." className="w-full border-2 rounded p-2" rows={2} />
                                    </div>
                                </div>
                            </section>

                            {/* Save Button (bottom) */}
                            <div className="pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => { handleSubmit(); setIsFullEditorOpen(false); }} 
                                    disabled={!canSave}
                                    className={`w-full mt-2 font-bold py-3 rounded-lg shadow-lg transition-all ${
                                        canSave ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer' : 'bg-gray-400 text-gray-700 cursor-not-allowed'
                                    }`}
                                >
                                    {canSave ? '💾 Save Record - Complete!' : `⚠️ Complete ${completionStatus.total - completionStatus.completed} more sections`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

                </>
            )}

            <HistoryArchiveModal 
                isOpen={showArchive} 
                onClose={() => setShowArchive(false)} 
                history={history}
                onEditRecord={handleEditArchiveRecord}
            />
        </div>
    );
};

export default WeeklyHistory;
