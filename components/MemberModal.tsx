
// components/MemberModal.tsx
import React, { useState, useEffect } from 'react';
import type { Member } from '../types';
import { sanitizeMember, sanitizeString } from '../utils';

interface MemberModalProps {
    member: Member | null;
    onSave: (member: Member) => void;
    onClose: () => void;
    allowedFields?: Array<'name' | 'email' | 'phone' | 'address' | 'dateOfBirth' | 'dayBorn'>;
}

const MemberModal: React.FC<MemberModalProps> = ({ member, onSave, onClose, allowedFields }) => {
    const [formData, setFormData] = useState<Member>(member || sanitizeMember({}));

    useEffect(() => {
        // When the 'member' prop changes, we must reset the form's state.
        if (member) {
            setFormData(member);
        } else {
            setFormData(sanitizeMember({}));
        }
    }, [member]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = 'checked' in e.target ? e.target.checked : undefined;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(sanitizeMember(formData));
    };

    const canEdit = (field: 'name' | 'email' | 'phone' | 'address') => {
        if (!allowedFields || allowedFields.length === 0) return true;
        return allowedFields.includes(field);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 overflow-hidden backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-gray-100">
                <form onSubmit={handleSubmit} className="flex flex-col max-h-[92vh]">
                    {/* Header with gradient */}
                    <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-600 px-8 py-7 flex-shrink-0 rounded-t-3xl">
                        <div className="flex items-center gap-3">
                            <div className="text-3xl">{allowedFields && allowedFields.length > 0 ? '📝' : (member ? '✏️' : '➕')}</div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">{allowedFields && allowedFields.length > 0 ? 'Edit Contact Info' : (member ? 'Edit Member' : 'Add New Member')}</h2>
                                <p className="text-indigo-100 text-sm mt-0.5">{allowedFields && allowedFields.length > 0 ? 'Update your contact details' : 'Complete member profile'}</p>
                            </div>
                        </div>
                    </div>
                    {/* Content with improved spacing */}
                    <div className="p-8 space-y-7 overflow-y-auto" style={{maxHeight: 'calc(92vh - 180px)'}}>
                        <div>
                            <label htmlFor="id" className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2.5">System ID</label>
                            <input
                                id="id"
                                name="id"
                                type="text"
                                value={formData.id}
                                disabled
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm text-gray-500 cursor-not-allowed transition font-mono"
                            />
                        </div>
                        <div>
                            <label htmlFor="name" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Full Name *</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                disabled={!canEdit('name')}
                                className={`w-full border-2 rounded-xl py-3 px-4 text-sm outline-none transition ${canEdit('name') ? 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 bg-white' : 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'}`}
                            />
                        </div>

                        {/* Personal Info Section */}
                        {!allowedFields && (<div className="pt-2">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="text-lg">👤</span> Personal Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="classNumber" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Class</label>
                                    <input
                                        id="classNumber"
                                        name="classNumber"
                                        type="text"
                                        placeholder="e.g. 1"
                                        value={formData.classNumber || ''}
                                        onChange={handleChange}
                                        className="w-full border-2 border-gray-300 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition bg-white"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="memberNumber" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Member #</label>
                                    <input
                                        id="memberNumber"
                                        name="memberNumber"
                                        type="text"
                                        placeholder="e.g. 128"
                                        value={formData.memberNumber || ''}
                                        onChange={handleChange}
                                        className="w-full border-2 border-gray-300 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition bg-white"
                                    />
                                </div>
                            </div>
                        </div>)}

                        {/* Birth Date Section */}
                        {(!allowedFields || canEdit('dateOfBirth') || canEdit('dayBorn')) && (<div className="pt-2">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="text-lg">🎂</span> Date of Birth
                            </h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label htmlFor="dobMonth" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Birth Month</label>
                                    <select
                                        id="dobMonth"
                                        name="dobMonth"
                                        value={formData.dobMonth || ''}
                                        onChange={handleChange}
                                        className="w-full border-2 border-gray-300 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition bg-white"
                                    >
                                        <option value="">Select month</option>
                                        <option value={1}>January</option>
                                        <option value={2}>February</option>
                                        <option value={3}>March</option>
                                        <option value={4}>April</option>
                                        <option value={5}>May</option>
                                        <option value={6}>June</option>
                                        <option value={7}>July</option>
                                        <option value={8}>August</option>
                                        <option value={9}>September</option>
                                        <option value={10}>October</option>
                                        <option value={11}>November</option>
                                        <option value={12}>December</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="dobDay" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Birth Day</label>
                                    <input
                                        id="dobDay"
                                        name="dobDay"
                                        type="number"
                                        min={1}
                                        max={31}
                                        placeholder="1-31"
                                        value={formData.dobDay || ''}
                                        onChange={handleChange}
                                        className="w-full border-2 border-gray-300 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition bg-white"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="dayBorn" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Day Born</label>
                                    <select
                                        id="dayBorn"
                                        name="dayBorn"
                                        value={formData.dayBorn || ''}
                                        onChange={handleChange}
                                        className="w-full border-2 border-gray-300 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition bg-white"
                                    >
                                        <option value="">Select day</option>
                                        <option value="Sunday">Sunday</option>
                                        <option value="Monday">Monday</option>
                                        <option value="Tuesday">Tuesday</option>
                                        <option value="Wednesday">Wednesday</option>
                                        <option value="Thursday">Thursday</option>
                                        <option value="Friday">Friday</option>
                                        <option value="Saturday">Saturday</option>
                                    </select>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-3 ml-1">📌 We store month and day only (privacy-friendly)</p>
                        </div>)}

                        {/* Contact Information Section */}
                        <div className="pt-2">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="text-lg">📞</span> Contact Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="email" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Email</label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="name@domain.com"
                                        value={formData.email || ''}
                                        onChange={handleChange}
                                        disabled={!canEdit('email')}
                                        className={`w-full border-2 rounded-xl py-3 px-4 text-sm outline-none transition ${canEdit('email') ? 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 bg-white' : 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'}`}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="phone" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Phone Number</label>
                                    <input
                                        id="phone"
                                        name="phone"
                                        type="tel"
                                        placeholder="(555) 123-4567"
                                        value={formData.phone || ''}
                                        onChange={handleChange}
                                        disabled={!canEdit('phone')}
                                        className={`w-full border-2 rounded-xl py-3 px-4 text-sm outline-none transition ${canEdit('phone') ? 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 bg-white' : 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'}`}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Other Information Section */}
                        <div className="pt-2">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="text-lg">ℹ️</span> Additional Information
                            </h3>
                            <div>
                                <label htmlFor="profession" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Profession</label>
                                <div className="flex gap-3">
                                    <input
                                        id="profession"
                                        name="profession"
                                        type="text"
                                        placeholder="e.g. Teacher"
                                        value={formData.profession || ''}
                                        onChange={handleChange}
                                        className="flex-1 border-2 border-gray-300 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition bg-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, profession: 'Retired' }))}
                                        className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-xl transition duration-200 text-sm whitespace-nowrap"
                                        title="Quick set to Retired"
                                    >
                                        Retired
                                    </button>
                                </div>
                            </div>
                            <div className="mt-5">
                                <label htmlFor="address" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Address</label>
                                <input
                                    id="address"
                                    name="address"
                                    type="text"
                                    placeholder="Street Address"
                                    value={formData.address || ''}
                                    onChange={handleChange}
                                    disabled={!canEdit('address')}
                                    className={`w-full border-2 rounded-xl py-3 px-4 text-sm outline-none transition ${canEdit('address') ? 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 bg-white' : 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'}`}
                                />
                            </div>
                            <div className="mt-5 grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="city" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">City</label>
                                    <input
                                        id="city"
                                        name="city"
                                        type="text"
                                        placeholder="e.g. Toronto"
                                        value={formData.city || ''}
                                        onChange={handleChange}
                                        className="w-full border-2 border-gray-300 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition bg-white"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="province" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">Province</label>
                                    <input
                                        id="province"
                                        name="province"
                                        type="text"
                                        placeholder="e.g. Ontario"
                                        value={formData.province || ''}
                                        onChange={handleChange}
                                        className="w-full border-2 border-gray-300 rounded-xl py-3 px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition bg-white"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Status Section */}
                        {!allowedFields && (<div className="pt-2">
                            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-5 border-2 border-indigo-200 shadow-sm">
                                <label htmlFor="active" className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        id="active"
                                        name="active"
                                        type="checkbox"
                                        checked={formData.active ?? true}
                                        onChange={handleChange}
                                        className="h-5 w-5 text-indigo-600 border-gray-300 rounded-lg focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                                    />
                                    <span className="font-bold text-gray-900">Active Member</span>
                                </label>
                                <p className="text-xs text-gray-600 mt-2 ml-8">Uncheck to mark this member as inactive</p>
                            </div>
                        </div>)}

                        {/* Development Fund Section */}
                        {!allowedFields && (<div className="pt-2">
                            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border-2 border-blue-200 shadow-sm">
                                <label htmlFor="devFundPledge" className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        id="devFundPledge"
                                        name="devFundPledge"
                                        type="checkbox"
                                        checked={formData.devFundPledge ?? false}
                                        onChange={handleChange}
                                        className="h-5 w-5 text-blue-600 border-gray-300 rounded-lg focus:ring-blue-500 cursor-pointer accent-blue-600"
                                    />
                                    <span className="font-bold text-gray-900">💙 Development Fund Pledge</span>
                                </label>
                                <p className="text-xs text-gray-600 mt-2 ml-8">Check if member has pledged to the development fund</p>
                                {formData.devFundPledge && (
                                    <div className="mt-4 ml-8 p-5 bg-white rounded-xl border-2 border-blue-200 shadow-sm">
                                        <label htmlFor="devFundPledgeAmount" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Pledge Amount ($)</label>
                                        <input
                                            id="devFundPledgeAmount"
                                            name="devFundPledgeAmount"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={formData.devFundPledgeAmount || ''}
                                            onChange={handleChange}
                                            className="w-full border-2 border-blue-300 rounded-xl py-3 px-4 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition font-semibold"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>)}
                    </div>
                    {/* Footer with gradient buttons */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-5 flex justify-end gap-3 flex-shrink-0 border-t border-gray-200 rounded-b-3xl">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-6 py-3 bg-white border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition duration-200 text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold rounded-xl transition duration-200 shadow-lg hover:shadow-xl text-sm"
                        >
                            ✓ Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MemberModal;
