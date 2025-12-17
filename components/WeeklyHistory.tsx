
// components/WeeklyHistory.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { WeeklyHistoryRecord, VisitorRecord, ServiceDonation } from '../types';
import { sanitizeWeeklyHistoryRecord, formatCurrency } from '../utils';

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
    "Bethel, Calgary", "Wesley, Edmonton", "Redemption, Toronto", "Ebenezer, Hamilton", "St. John’s, Newfoundland", "Peniel, Vancouver"
];

const SERVICE_TYPES = [
    "Divine Service", "Communion", "Youth Sunday", "Lay Movement / Wesley Hour",
    "Revival / Prayer Meeting", "Thanksgiving / Harvest", "Outreach / Evangelism"
];

const WeeklyHistory: React.FC<WeeklyHistoryProps> = ({ history, setHistory }) => {
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [formData, setFormData] = useState<WeeklyHistoryRecord>(initialFormState());
    const [yearFilter, setYearFilter] = useState<string>('all');
    const [monthFilter, setMonthFilter] = useState<string>('all');

    // Local state for adding new visitor/donation rows
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

            if (yearFilter !== 'all' && year !== yearFilter) return false;
            if (monthFilter !== 'all' && month !== monthFilter) return false;
            return true;
        });
    }, [history, yearFilter, monthFilter]);

    const sortedHistory = useMemo(() => {
        return [...filteredHistory].sort((a, b) => b.dateOfService.localeCompare(a.dateOfService));
    }, [filteredHistory]);

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        history.forEach(rec => years.add(rec.dateOfService.slice(0, 4)));
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [history]);

    const totalAttendance = useMemo(() => {
        const { men, women, junior, children, visitors, catechumens } = formData.attendance;
        return men + women + junior + children + visitors + catechumens;
    }, [formData.attendance]);

    // -- Handlers --

    const handleSelectRecord = (id: string) => setSelectedRecordId(id);
    const handleAddNew = () => setSelectedRecordId(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleServiceTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        const currentTypes = formData.serviceTypes;
        const newTypes = checked ? [...currentTypes, value] : currentTypes.filter(t => t !== value);

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

    // -- Visitor List Handlers --
    const addVisitor = () => {
        if (!newVisitor.name) return alert("Visitor Name is required");
        setFormData(prev => ({ ...prev, visitorsList: [...prev.visitorsList, newVisitor], attendance: { ...prev.attendance, visitors: prev.attendance.visitors + 1 } }));
        setNewVisitor({ name: '', from: '', position: '', reason: '' });
    };

    const removeVisitor = (index: number) => {
        setFormData(prev => ({ ...prev, visitorsList: prev.visitorsList.filter((_, i) => i !== index), attendance: { ...prev.attendance, visitors: Math.max(0, prev.attendance.visitors - 1) } }));
    };

    // -- Donation List Handlers --
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
        if (selectedRecordId && window.confirm("Are you sure you want to delete this record?")) {
            setHistory(history.filter(h => h.id !== selectedRecordId));
            setSelectedRecordId(null);
        }
    };
    
    // --- Styles for larger, easier to tap inputs ---
    const formSectionClasses = "p-6 md:p-8 rounded-2xl border-2 border-slate-200 shadow-sm space-y-6 bg-white mb-8";
    const labelClass = "block text-lg md:text-xl font-bold text-slate-700 mb-2 tracking-wide";
    const inputClass = "block w-full border-2 border-slate-300 rounded-xl shadow-sm py-4 px-5 text-xl bg-slate-100 focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-200 transition-all font-medium text-slate-800 placeholder-slate-400";
    const textareaClass = "block w-full border-2 border-slate-300 rounded-xl shadow-sm py-4 px-5 text-xl bg-slate-100 focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-200 transition-all font-medium text-slate-800 min-h-[120px]";
    const selectClass = "block w-full border-2 border-slate-300 rounded-xl shadow-sm py-4 px-5 text-xl bg-slate-100 focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-200 transition-all font-medium text-slate-800 appearance-none";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-32">
            {/* Left Column: Record List */}
            <aside className="lg:col-span-1 space-y-6 no-print">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800">History Log</h2>
                </div>
                <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 space-y-4 max-h-[75vh] overflow-y-auto">
                    <button onClick={handleAddNew} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl mb-6 shadow-md transition-all text-lg flex items-center justify-center gap-2">
                        <span className="text-2xl">+</span> New Record
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1">Filter by Year</label>
                            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50">
                                <option value="all">All Years</option>
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1">Filter by Month</label>
                            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50">
                                <option value="all">All Months</option>
                                {["01","02","03","04","05","06","07","08","09","10","11","12"].map(month => (
                                    <option key={month} value={month}>Month {month}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <ul className="space-y-3 pr-2">
                        {sortedHistory.map(rec => (
                            <li key={rec.id}>
                                <button onClick={() => handleSelectRecord(rec.id)} className={`w-full text-left p-5 rounded-xl transition-all border-2 ${selectedRecordId === rec.id ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-md ring-2 ring-indigo-200' : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-300 text-slate-700'}`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-xl">{rec.dateOfService}</span>
                                        <span className="text-sm font-bold bg-slate-200 text-slate-700 px-3 py-1 rounded-full">Att: {rec.attendance.men + rec.attendance.women + rec.attendance.children + rec.attendance.visitors}</span>
                                    </div>
                                    <p className="text-base opacity-80 truncate font-medium">{rec.sermonTopic || "No Topic"}</p>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </aside>

            {/* Right Column: Form */}
            <section className="lg:col-span-3">
                 <form onSubmit={handleSubmit}>
                     <div className="printable-area">
                        
                        {/* 1. Header & Service Details */}
                        <div className={formSectionClasses}>
                            <h3 className="text-2xl font-black text-indigo-900 border-b-2 border-indigo-100 pb-4 mb-6">Service Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className={labelClass}>Date of Service</label>
                                    <input type="date" name="dateOfService" value={formData.dateOfService} onChange={handleChange} required className={inputClass}/>
                                </div>
                                 <div>
                                    <label className={labelClass}>Society Name</label>
                                    <div className="relative">
                                        <select name="societyName" value={formData.societyName} onChange={handleChange} className={selectClass}>
                                            {SOCIETY_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               <div>
                                   <label className={labelClass}>Minister / Officiant</label>
                                   <input type="text" name="officiant" value={formData.officiant} onChange={handleChange} required className={inputClass} placeholder="e.g. Rev. John Doe"/>
                               </div>
                               <div>
                                   <label className={labelClass}>Liturgist</label>
                                   <input type="text" name="liturgist" value={formData.liturgist} onChange={handleChange} required className={inputClass} placeholder="e.g. Sis. Jane Doe"/>
                               </div>
                            </div>
                            
                            <div className="pt-4">
                                <label className={labelClass}>Service Type</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                                    {SERVICE_TYPES.map(type => (
                                        <label key={type} className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.serviceTypes.includes(type) ? 'bg-indigo-100 border-indigo-500 shadow-md' : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300'}`}>
                                            <input type="checkbox" value={type} checked={formData.serviceTypes.includes(type)} onChange={handleServiceTypeChange} className="w-6 h-6 text-indigo-600 rounded focus:ring-indigo-500"/>
                                            <span className={`ml-3 text-lg font-bold ${formData.serviceTypes.includes(type) ? 'text-indigo-900' : 'text-slate-600'}`}>{type}</span>
                                        </label>
                                    ))}
                                    <label className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.serviceTypes.includes('Other') ? 'bg-indigo-100 border-indigo-500 shadow-md' : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300'}`}>
                                        <input type="checkbox" value="Other" checked={formData.serviceTypes.includes('Other')} onChange={handleServiceTypeChange} className="w-6 h-6 text-indigo-600 rounded focus:ring-indigo-500"/>
                                        <span className={`ml-3 text-lg font-bold ${formData.serviceTypes.includes('Other') ? 'text-indigo-900' : 'text-slate-600'}`}>Other</span>
                                    </label>
                                </div>
                                {formData.serviceTypes.includes('Other') && (
                                    <div className="mt-4">
                                        <label className={labelClass}>Other Service Type</label>
                                        <input type="text" name="serviceTypeOther" value={formData.serviceTypeOther} onChange={handleChange} className={inputClass} placeholder="Describe other service" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Worship Content */}
                         <div className={formSectionClasses}>
                            <h3 className="text-2xl font-black text-indigo-900 border-b-2 border-indigo-100 pb-4 mb-6">Worship Content</h3>
                            <div>
                                <label className={labelClass}>Sermon Topic / Theme</label>
                                <input type="text" name="sermonTopic" value={formData.sermonTopic} onChange={handleChange} required className={inputClass} placeholder="Main message title"/>
                            </div>
                            <div>
                                <label className={labelClass}>Worship Highlights / Notes</label>
                                <textarea name="worshipHighlights" rows={4} value={formData.worshipHighlights} onChange={handleChange} className={textareaClass} placeholder="Key points, scriptures, or songs..."/>
                            </div>
                            <div>
                                <label className={labelClass}>Announcements By</label>
                                <input type="text" name="announcementsBy" value={formData.announcementsBy} onChange={handleChange} className={inputClass}/>
                            </div>
                        </div>
                        
                        {/* 3. Attendance */}
                        <div className={formSectionClasses}>
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b-2 border-indigo-100 pb-4 mb-6 gap-4">
                                <h3 className="text-2xl font-black text-indigo-900">Attendance</h3>
                                <div className="text-xl font-bold bg-indigo-600 text-white px-6 py-2 rounded-full shadow-md text-center">Total: {totalAttendance}</div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                                {(['men', 'women', 'children', 'junior', 'catechumens', 'visitors'] as const).map(key => (
                                    <div key={key} className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-300 transition-colors">
                                        <label className="block text-sm font-bold uppercase text-slate-500 mb-2 tracking-wider">{key}</label>
                                        <input type="number" min="0" name={key} value={String(formData.attendance[key])} onChange={handleAttendanceChange} className="block w-full bg-white border-2 border-slate-300 rounded-lg focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500 text-center font-bold text-3xl py-3 text-slate-800"/>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 4. Visitors & Donations */}
                        <div className={formSectionClasses}>
                            <h3 className="text-2xl font-black text-indigo-900 border-b-2 border-indigo-100 pb-4 mb-6">Visitors Log</h3>
                            
                            {/* New Visitor Input */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-indigo-50/50 p-4 rounded-xl border-2 border-indigo-100 mb-6">
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold uppercase text-indigo-800 mb-1 ml-1">Name</label>
                                    <input placeholder="Name" className="w-full border-slate-300 rounded-lg p-3 text-base shadow-sm focus:ring-indigo-500" value={newVisitor.name} onChange={e => setNewVisitor(p => ({...p, name: e.target.value}))} />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold uppercase text-indigo-800 mb-1 ml-1">From</label>
                                    <input placeholder="Location" className="w-full border-slate-300 rounded-lg p-3 text-base shadow-sm focus:ring-indigo-500" value={newVisitor.from} onChange={e => setNewVisitor(p => ({...p, from: e.target.value}))} />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold uppercase text-indigo-800 mb-1 ml-1">Position/Reason</label>
                                    <input placeholder="Details" className="w-full border-slate-300 rounded-lg p-3 text-base shadow-sm focus:ring-indigo-500" value={newVisitor.position} onChange={e => setNewVisitor(p => ({...p, position: e.target.value}))} />
                                </div>
                                <div className="md:col-span-3">
                                    <button type="button" onClick={addVisitor} className="w-full h-[50px] bg-indigo-600 text-white rounded-lg text-lg font-bold hover:bg-indigo-700 shadow-md active:transform active:scale-95 transition-all">Add Visitor</button>
                                </div>
                            </div>

                            {formData.visitorsList.length > 0 ? (
                                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                                    <table className="w-full text-base text-left text-slate-700 mb-8">
                                        <thead className="bg-slate-100 text-slate-800 font-extrabold uppercase text-sm">
                                            <tr>
                                                <th className="p-4 rounded-tl-lg">Name</th><th className="p-4">From</th><th className="p-4">Details</th><th className="p-4 rounded-tr-lg"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-100 border border-slate-200">
                                            {formData.visitorsList.map((v, idx) => (
                                                <tr key={idx}>
                                                    <td className="p-4 font-bold text-lg">{v.name}</td>
                                                    <td className="p-4">{v.from}</td>
                                                    <td className="p-4">{v.position} {v.reason ? `(${v.reason})` : ''}</td>
                                                    <td className="p-4 text-right"><button type="button" onClick={() => removeVisitor(idx)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 w-8 h-8 rounded-full font-bold flex items-center justify-center transition-colors">×</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <p className="text-lg text-slate-400 italic mb-8 p-4 bg-slate-50 rounded-lg text-center">No visitors logged yet.</p>}

                            <h3 className="text-2xl font-black text-indigo-900 border-b-2 border-indigo-100 pb-4 mb-6 mt-8">Special Donations</h3>
                             {/* New Donation Input */}
                             <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-emerald-50/50 p-4 rounded-xl border-2 border-emerald-100 mb-6">
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold uppercase text-emerald-800 mb-1 ml-1">Donor</label>
                                    <input placeholder="Donor Name" className="w-full border-slate-300 rounded-lg p-3 text-base shadow-sm focus:ring-emerald-500" value={newDonation.donor} onChange={e => setNewDonation(p => ({...p, donor: e.target.value}))} />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold uppercase text-emerald-800 mb-1 ml-1">Amount</label>
                                    <input type="number" placeholder="0.00" className="w-full border-slate-300 rounded-lg p-3 text-base shadow-sm focus:ring-emerald-500 font-bold" value={newDonation.amount || ''} onChange={e => setNewDonation(p => ({...p, amount: parseFloat(e.target.value) || 0}))} />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold uppercase text-emerald-800 mb-1 ml-1">Description</label>
                                    <input placeholder="Reason" className="w-full border-slate-300 rounded-lg p-3 text-base shadow-sm focus:ring-emerald-500" value={newDonation.description} onChange={e => setNewDonation(p => ({...p, description: e.target.value}))} />
                                </div>
                                <div className="md:col-span-3">
                                    <button type="button" onClick={addDonation} className="w-full h-[50px] bg-emerald-600 text-white rounded-lg text-lg font-bold hover:bg-emerald-700 shadow-md active:transform active:scale-95 transition-all">Add Donation</button>
                                </div>
                            </div>

                            {formData.donationsList.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-base text-left text-slate-700">
                                        <thead className="bg-slate-100 text-slate-800 font-extrabold uppercase text-sm">
                                            <tr>
                                                <th className="p-4 rounded-tl-lg">Donor</th><th className="p-4">Amount</th><th className="p-4">Description</th><th className="p-4 rounded-tr-lg"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-100 border border-slate-200">
                                            {formData.donationsList.map((d, idx) => (
                                                <tr key={idx}>
                                                    <td className="p-4 font-bold text-lg">{d.donor}</td>
                                                    <td className="p-4 font-bold text-emerald-700">{formatCurrency(d.amount)}</td>
                                                    <td className="p-4">{d.description}</td>
                                                    <td className="p-4 text-right"><button type="button" onClick={() => removeDonation(idx)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 w-8 h-8 rounded-full font-bold flex items-center justify-center transition-colors">×</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <p className="text-lg text-slate-400 italic p-4 bg-slate-50 rounded-lg text-center">No ad-hoc donations logged.</p>}
                        </div>

                        {/* 5. Events & Observations */}
                        <div className={formSectionClasses}>
                            <h3 className="text-2xl font-black text-indigo-900 border-b-2 border-indigo-100 pb-4 mb-6">Events & Observations</h3>
                            <div>
                                <label className={labelClass}>Special Events or Activities</label>
                                <textarea name="events" rows={4} value={formData.events} onChange={handleChange} className={textareaClass} placeholder="Anything special happening today?"/>
                            </div>
                            <div>
                                <label className={labelClass}>Observations / Challenges</label>
                                <textarea name="observations" rows={4} value={formData.observations} onChange={handleChange} className={textareaClass} placeholder="Notes for next week..."/>
                            </div>
                            <div>
                                <label className={labelClass}>Prepared By</label>
                                <input type="text" name="preparedBy" value={formData.preparedBy} onChange={handleChange} className={inputClass} placeholder="Your Name"/>
                            </div>
                        </div>
                     </div>
                     
                     {/* Sticky Footer Actions */}
                     <div className="no-print bg-white p-4 md:p-6 rounded-t-2xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)] border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center fixed bottom-0 left-0 right-0 z-50 lg:static lg:shadow-none lg:border-t-0 lg:rounded-none lg:p-0 lg:bg-transparent lg:mt-8">
                         <div className="w-full sm:w-auto mb-4 sm:mb-0">
                            {selectedRecordId && (
                                <button type="button" onClick={handleDelete} className="w-full sm:w-auto text-red-600 hover:text-red-800 font-bold px-6 py-4 border-2 border-red-200 rounded-xl bg-red-50 text-lg transition-colors">Delete Record</button>
                            )}
                         </div>
                         <div className="flex gap-4 w-full sm:w-auto">
                            <button type="button" onClick={() => window.print()} disabled={!selectedRecordId} className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-4 rounded-xl text-lg border-2 border-slate-200 transition-colors">
                                Print / PDF
                            </button>
                            <button type="submit" className="flex-[2] sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-xl shadow-lg transform transition hover:scale-105 active:scale-95 text-xl">
                                Save Log
                            </button>
                         </div>
                     </div>
                 </form>
            </section>
        </div>
    );
};

export default WeeklyHistory;
