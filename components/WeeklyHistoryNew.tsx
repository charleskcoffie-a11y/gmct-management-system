// components/WeeklyHistory.tsx (Redesigned)
import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { WeeklyHistoryRecord, VisitorRecord, ServiceDonation } from '../types';
import { sanitizeWeeklyHistoryRecord, formatCurrency } from '../utils';
import HistoryArchiveModal from './HistoryArchiveModal';

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
    newMembersDetails: '',
    newMembersContact: '',
    events: '',
    observations: '',
    preparedBy: '',
});

const SOCIETY_NAMES = [
    "Ghana Methodist Church Toronto (GMCT)", "Holy Trinity Society, Montreal", "New Life International, Ottawa",
    "Bethel, Calgary", "Wesley, Edmonton", "Redemption, Toronto", "Ebenezer, Hamilton", "St. John's, Newfoundland", "Peniel, Vancouver"
];

const SERVICE_TYPES = [
    "Divine Service", "Communion", "Youth Sunday", "Lay Movement / Wesley Hour",
    "Revival / Prayer Meeting", "Thanksgiving / Harvest", "Outreach / Evangelism"
];

const WeeklyHistory: React.FC<WeeklyHistoryProps> = ({ history, setHistory }) => {
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [formData, setFormData] = useState<WeeklyHistoryRecord>(initialFormState());
    const [showArchive, setShowArchive] = useState(false);
    const [activeModal, setActiveModal] = useState<'details' | 'attendance' | 'visitors' | 'donations' | 'events' | null>(null);
    const [newVisitor, setNewVisitor] = useState<VisitorRecord>({ name: '', from: '', position: '', reason: '' });
    const [newDonation, setNewDonation] = useState<ServiceDonation>({ donor: '', amount: 0, description: '' });

    useEffect(() => {
        if (selectedRecordId) {
            const record = history.find(h => h.id === selectedRecordId);
            if (record) setFormData(record);
        } else {
            setFormData(initialFormState());
        }
    }, [selectedRecordId, history]);
    
    const filteredHistory = useMemo(() => {
        return history.filter(rec => {
            const year = rec.dateOfService.slice(0, 4);
            const month = rec.dateOfService.slice(5, 7);
            const currentMonth = new Date().toISOString().substring(5, 7);
            const currentYear = new Date().toISOString().substring(0, 4);
            return year === currentYear && month === currentMonth;
        });
    }, [history]);

    const totalAttendance = useMemo(() => {
        const { men, women, junior, children, visitors, catechumens } = formData.attendance;
        return men + women + junior + children + visitors + catechumens;
    }, [formData.attendance]);

    // Handlers
    const handleSelectRecord = (id: string) => setSelectedRecordId(id);
    const handleAddNew = () => setSelectedRecordId(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleServiceTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        const newTypes = checked ? [...formData.serviceTypes, value] : formData.serviceTypes.filter(t => t !== value);
        setFormData(prev => ({
            ...prev,
            serviceTypes: newTypes,
            serviceTypeOther: value === 'Other' && !checked ? '' : prev.serviceTypeOther
        }));
    };

    const handleAttendanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const numValue = parseInt(value, 10) || 0;
        setFormData(prev => ({ ...prev, attendance: { ...prev.attendance, [name]: numValue }}));
    };

    const addVisitor = () => {
        if (!newVisitor.name) return alert("Visitor Name is required");
        setFormData(prev => ({ ...prev, visitorsList: [...prev.visitorsList, newVisitor] }));
        setNewVisitor({ name: '', from: '', position: '', reason: '' });
    };

    const removeVisitor = (index: number) => {
        setFormData(prev => ({ ...prev, visitorsList: prev.visitorsList.filter((_, i) => i !== index) }));
    };

    const addDonation = () => {
        if (!newDonation.amount || !newDonation.description) return alert("Amount and Description are required");
        setFormData(prev => ({ ...prev, donationsList: [...prev.donationsList, newDonation] }));
        setNewDonation({ donor: '', amount: 0, description: '' });
    };

    const removeDonation = (index: number) => {
        setFormData(prev => ({ ...prev, donationsList: prev.donationsList.filter((_, i) => i !== index) }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const sanitized = sanitizeWeeklyHistoryRecord(formData);
        const index = history.findIndex(h => h.id === sanitized.id);
        const newHistory = [...history];
        if (index > -1) {
            newHistory[index] = sanitized;
        } else {
            newHistory.push(sanitized);
        }
        setHistory(newHistory);
        alert('Record saved successfully!');
        setSelectedRecordId(sanitized.id);
    };

    const handleDelete = () => {
        if (selectedRecordId && window.confirm("Delete this record?")) {
            setHistory(history.filter(h => h.id !== selectedRecordId));
            setSelectedRecordId(null);
        }
    };

    // Modal Component
    const Modal = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-gradient-to-r from-amber-600 to-orange-600 text-white p-6 flex justify-between items-center">
                    <h2 className="text-2xl font-bold">{title}</h2>
                    <button onClick={onClose} className="text-2xl font-bold hover:opacity-80">✕</button>
                </div>
                <div className="p-6 space-y-4">{children}</div>
            </div>
        </div>
    );

    return (
        <div className="pb-12 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h2 className="inline-block text-3xl font-extrabold text-white bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-3 rounded-xl shadow-lg">📅 Weekly History</h2>
                <p className="text-base text-slate-600 mt-3 font-medium">Record and archive all service information.</p>
            </div>

            {/* Archiving Toolbar - Horizontal on Top */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-xl shadow-lg border-2 border-slate-600 p-4 mb-8 flex flex-wrap gap-3">
                <button onClick={() => setShowArchive(true)} className="flex-1 min-w-[120px] bg-gradient-to-br from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 border border-slate-500">
                    📚 View All Archives
                </button>
                <button onClick={handleAddNew} className="flex-1 min-w-[120px] bg-gradient-to-br from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 border-2 border-amber-400">
                    ✏️ New Record
                </button>
                <button onClick={() => window.print()} disabled={!selectedRecordId} className="flex-1 min-w-[120px] bg-gradient-to-br from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 border-2 border-blue-400">
                    🖨️ Print
                </button>
                <button onClick={handleDelete} disabled={!selectedRecordId} className="flex-1 min-w-[120px] bg-gradient-to-br from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 border-2 border-red-400">
                    🗑️ Delete
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar: Quick Access List */}
                <aside className="lg:col-span-1">
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-lg border-2 border-amber-200 p-4 max-h-[70vh] overflow-y-auto sticky top-6">
                        <h3 className="text-sm font-bold uppercase text-slate-700 mb-3 px-2">This Month's Records</h3>
                        <ul className="space-y-2">
                            {filteredHistory.sort((a,b) => b.dateOfService.localeCompare(a.dateOfService)).map(rec => (
                                <li key={rec.id}>
                                    <button onClick={() => setSelectedRecordId(rec.id)} className={`w-full text-left p-3 rounded-lg transition-all border-2 text-sm font-bold ${selectedRecordId === rec.id ? 'bg-white border-amber-500 text-amber-900 shadow-md ring-2 ring-amber-200' : 'bg-white border-amber-100 hover:bg-amber-50 hover:border-amber-300 text-slate-700'}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span>{rec.dateOfService}</span>
                                            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">👥 {rec.attendance.men + rec.attendance.women + rec.attendance.children + rec.attendance.visitors}</span>
                                        </div>
                                        <p className="text-xs opacity-80 line-clamp-1">{rec.sermonTopic || "No Topic"}</p>
                                    </button>
                                </li>
                            ))}
                            {filteredHistory.length === 0 && (
                                <p className="text-xs text-slate-400 italic text-center py-4">No records this month yet.</p>
                            )}
                        </ul>
                    </div>
                </aside>

                {/* Main Content: Compact Card Grid */}
                <section className="lg:col-span-3">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {selectedRecordId !== null && (
                            <div className="px-4 py-3 bg-cyan-100 border-2 border-cyan-300 text-cyan-900 font-bold rounded-xl">✏️ Editing record from {formData.dateOfService}</div>
                        )}

                        {/* Quick Info Cards - Modal Triggered */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Card 1: Service Details */}
                            <button type="button" onClick={() => setActiveModal('details')} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg border-2 border-blue-200 p-6 hover:shadow-xl transition-all hover:scale-105 text-left">
                                <div className="text-3xl mb-2">📋</div>
                                <h3 className="text-lg font-bold text-blue-900 mb-1">Service Details</h3>
                                <p className="text-sm text-blue-700 font-medium">{formData.dateOfService}</p>
                                <p className="text-xs text-blue-600 mt-1">{formData.officiant || "Add Officiant"}</p>
                            </button>

                            {/* Card 2: Attendance */}
                            <button type="button" onClick={() => setActiveModal('attendance')} className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl shadow-lg border-2 border-emerald-200 p-6 hover:shadow-xl transition-all hover:scale-105 text-left">
                                <div className="text-3xl mb-2">👥</div>
                                <h3 className="text-lg font-bold text-emerald-900 mb-1">Attendance</h3>
                                <p className="text-2xl font-bold text-emerald-700">{totalAttendance}</p>
                                <p className="text-xs text-emerald-600 mt-1">Total attendees</p>
                            </button>

                            {/* Card 3: Visitors */}
                            <button type="button" onClick={() => setActiveModal('visitors')} className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-lg border-2 border-purple-200 p-6 hover:shadow-xl transition-all hover:scale-105 text-left">
                                <div className="text-3xl mb-2">🤝</div>
                                <h3 className="text-lg font-bold text-purple-900 mb-1">Visitors</h3>
                                <p className="text-2xl font-bold text-purple-700">{formData.visitorsList.length}</p>
                                <p className="text-xs text-purple-600 mt-1">visitors logged</p>
                            </button>

                            {/* Card 4: Donations */}
                            <button type="button" onClick={() => setActiveModal('donations')} className="bg-gradient-to-br from-rose-50 to-red-50 rounded-xl shadow-lg border-2 border-rose-200 p-6 hover:shadow-xl transition-all hover:scale-105 text-left">
                                <div className="text-3xl mb-2">💝</div>
                                <h3 className="text-lg font-bold text-rose-900 mb-1">Donations</h3>
                                <p className="text-2xl font-bold text-rose-700">{formData.donationsList.length}</p>
                                <p className="text-xs text-rose-600 mt-1">donations logged</p>
                            </button>

                            {/* Card 5: Sermon/Worship */}
                            <button type="button" onClick={() => setActiveModal('events')} className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl shadow-lg border-2 border-orange-200 p-6 hover:shadow-xl transition-all hover:scale-105 text-left">
                                <div className="text-3xl mb-2">🙏</div>
                                <h3 className="text-lg font-bold text-orange-900 mb-1">Worship & Events</h3>
                                <p className="text-sm text-orange-700 font-medium line-clamp-1">{formData.sermonTopic || "Add sermon topic"}</p>
                                <p className="text-xs text-orange-600 mt-1">{formData.events ? formData.events.slice(0, 20) + '...' : 'Add event notes'}</p>
                            </button>

                            {/* Card 6: Quick Summary */}
                            <button type="button" onClick={() => selectedRecordId && setActiveModal('details')} className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl shadow-lg border-2 border-slate-300 p-6 hover:shadow-xl transition-all hover:scale-105 text-left">
                                <div className="text-3xl mb-2">📊</div>
                                <h3 className="text-lg font-bold text-slate-800 mb-1">Summary</h3>
                                <p className="text-sm text-slate-700 font-medium">{formData.societyName?.slice(0, 20)}</p>
                                <p className="text-xs text-slate-600 mt-1">Prepared by: {formData.preparedBy || "—"}</p>
                            </button>
                        </div>

                        {/* Save Button */}
                        <button type="submit" className="w-full bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg text-lg transition-all hover:scale-105 border-2 border-indigo-400">
                            💾 Save Record
                        </button>
                    </form>
                </section>
            </div>

            {/* Modals */}
            {activeModal === 'details' && (
                <Modal title="📋 Service Details" onClose={() => setActiveModal(null)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">📅 Date of Service</label>
                            <input type="date" name="dateOfService" value={formData.dateOfService} onChange={handleChange} className="w-full border-2 border-amber-300 rounded-lg py-2 px-3 font-medium"/>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">🏢 Society Name</label>
                            <select name="societyName" value={formData.societyName} onChange={handleChange} className="w-full border-2 border-amber-300 rounded-lg py-2 px-3 font-medium">
                                {SOCIETY_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">🎤 Minister / Officiant</label>
                            <input type="text" name="officiant" value={formData.officiant} onChange={handleChange} className="w-full border-2 border-amber-300 rounded-lg py-2 px-3 font-medium" placeholder="e.g. Rev. John Doe"/>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">📖 Liturgist</label>
                            <input type="text" name="liturgist" value={formData.liturgist} onChange={handleChange} className="w-full border-2 border-amber-300 rounded-lg py-2 px-3 font-medium" placeholder="e.g. Sis. Jane Doe"/>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">📢 Service Type</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {SERVICE_TYPES.map(type => (
                                    <label key={type} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-100 rounded-lg">
                                        <input type="checkbox" value={type} checked={formData.serviceTypes.includes(type)} onChange={handleServiceTypeChange} className="w-5 h-5"/>
                                        <span className="font-medium text-sm">{type}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {activeModal === 'attendance' && (
                <Modal title="👥 Attendance" onClose={() => setActiveModal(null)}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {(['men', 'women', 'children', 'junior', 'catechumens', 'visitors'] as const).map(key => (
                            <div key={key} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <label className="block text-xs font-bold uppercase text-slate-600 mb-2">{key}</label>
                                <input type="number" min="0" name={key} value={String(formData.attendance[key])} onChange={handleAttendanceChange} className="block w-full text-center text-2xl font-bold p-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-400"/>
                            </div>
                        ))}
                    </div>
                    <div className="text-center p-4 bg-emerald-100 border-2 border-emerald-300 rounded-lg">
                        <p className="text-sm font-bold text-emerald-900">Total Attendance</p>
                        <p className="text-3xl font-bold text-emerald-700">{totalAttendance}</p>
                    </div>
                </Modal>
            )}

            {activeModal === 'visitors' && (
                <Modal title="🤝 Visitors Log" onClose={() => setActiveModal(null)}>
                    <div className="space-y-4">
                        <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200 space-y-3">
                            <input placeholder="Name *" className="w-full border-2 border-blue-300 rounded-lg p-2 font-medium" value={newVisitor.name} onChange={e => setNewVisitor(p => ({...p, name: e.target.value}))} />
                            <input placeholder="From" className="w-full border-2 border-blue-300 rounded-lg p-2 font-medium" value={newVisitor.from} onChange={e => setNewVisitor(p => ({...p, from: e.target.value}))} />
                            <input placeholder="Position/Reason" className="w-full border-2 border-blue-300 rounded-lg p-2 font-medium" value={newVisitor.position} onChange={e => setNewVisitor(p => ({...p, position: e.target.value}))} />
                            <button type="button" onClick={addVisitor} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">+ Add Visitor</button>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {formData.visitorsList.map((v, idx) => (
                                <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-slate-900">{v.name}</p>
                                        <p className="text-xs text-slate-600">{v.from} {v.position && `• ${v.position}`}</p>
                                    </div>
                                    <button type="button" onClick={() => removeVisitor(idx)} className="text-red-600 hover:text-red-800 font-bold text-lg">✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </Modal>
            )}

            {activeModal === 'donations' && (
                <Modal title="💝 Donations" onClose={() => setActiveModal(null)}>
                    <div className="space-y-4">
                        <div className="bg-rose-50 p-4 rounded-lg border-2 border-rose-200 space-y-3">
                            <input placeholder="Donor" className="w-full border-2 border-rose-300 rounded-lg p-2 font-medium" value={newDonation.donor} onChange={e => setNewDonation(p => ({...p, donor: e.target.value}))} />
                            <input type="number" placeholder="Amount" className="w-full border-2 border-rose-300 rounded-lg p-2 font-medium" value={newDonation.amount || ''} onChange={e => setNewDonation(p => ({...p, amount: parseFloat(e.target.value) || 0}))} />
                            <input placeholder="Description *" className="w-full border-2 border-rose-300 rounded-lg p-2 font-medium" value={newDonation.description} onChange={e => setNewDonation(p => ({...p, description: e.target.value}))} />
                            <button type="button" onClick={addDonation} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg">+ Add Donation</button>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {formData.donationsList.map((d, idx) => (
                                <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-slate-900">{d.donor || "Anonymous"}</p>
                                        <p className="text-sm text-slate-600">{d.description}</p>
                                        <p className="text-lg font-bold text-rose-700 mt-1">{formatCurrency(d.amount)}</p>
                                    </div>
                                    <button type="button" onClick={() => removeDonation(idx)} className="text-red-600 hover:text-red-800 font-bold text-lg">✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </Modal>
            )}

            {activeModal === 'events' && (
                <Modal title="🙏 Worship & Events" onClose={() => setActiveModal(null)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">📖 Sermon Topic</label>
                            <input type="text" name="sermonTopic" value={formData.sermonTopic} onChange={handleChange} className="w-full border-2 border-amber-300 rounded-lg py-2 px-3 font-medium" placeholder="Main message title"/>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">✨ Worship Highlights</label>
                            <textarea name="worshipHighlights" rows={3} value={formData.worshipHighlights} onChange={handleChange} className="w-full border-2 border-amber-300 rounded-lg py-2 px-3 font-medium" placeholder="Key points, scriptures, or songs..."/>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">📣 Announcements By</label>
                            <input type="text" name="announcementsBy" value={formData.announcementsBy} onChange={handleChange} className="w-full border-2 border-amber-300 rounded-lg py-2 px-3 font-medium"/>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">🎪 Special Events</label>
                            <textarea name="events" rows={3} value={formData.events} onChange={handleChange} className="w-full border-2 border-amber-300 rounded-lg py-2 px-3 font-medium" placeholder="Any special activities?"/>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">📝 Observations / Challenges</label>
                            <textarea name="observations" rows={3} value={formData.observations} onChange={handleChange} className="w-full border-2 border-amber-300 rounded-lg py-2 px-3 font-medium" placeholder="Notes for next week..."/>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">✍️ Prepared By</label>
                            <input type="text" name="preparedBy" value={formData.preparedBy} onChange={handleChange} className="w-full border-2 border-amber-300 rounded-lg py-2 px-3 font-medium" placeholder="Your Name"/>
                        </div>
                    </div>
                </Modal>
            )}

            <HistoryArchiveModal isOpen={showArchive} onClose={() => setShowArchive(false)} history={history} />
        </div>
    );
};

export default WeeklyHistory;
