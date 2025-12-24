
// components/MemberModal.tsx
import React, { useState, useEffect } from 'react';
import type { Member } from '../types';
import { sanitizeMember, sanitizeString } from '../utils';

interface MemberModalProps {
    member: Member | null;
    onSave: (member: Member) => void;
    onClose: () => void;
    allowedFields?: Array<'name' | 'email' | 'phone' | 'address'>;
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
                    {/* Header with gradient */}
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-6 flex-shrink-0">
                        <h2 className="text-2xl font-bold text-white">{allowedFields && allowedFields.length > 0 ? '✏️ Edit Contact Information' : (member ? '✏️ Edit Member' : '➕ Add New Member')}</h2>
                        <p className="text-indigo-100 text-sm mt-1">{allowedFields && allowedFields.length > 0 ? 'Update name, email, phone, and address' : 'Update member information and preferences'}</p>
                    </div>
                    {/* Content with improved spacing */}
                    <div className="p-8 space-y-6 overflow-y-auto" style={{maxHeight: 'calc(90vh - 180px)'}}>
                        <div>
                            <label htmlFor="id" className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">System ID</label>
                            <input
                                id="id"
                                name="id"
                                type="text"
                                value={formData.id}
                                disabled
                                className="w-full bg-gray-100 border border-gray-300 rounded-lg py-2.5 px-4 text-sm text-gray-500 cursor-not-allowed transition"
                            />
                        </div>
                        <div>
                            <label htmlFor="name" className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Full Name *</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                disabled={!canEdit('name')}
                                className={`w-full border-2 rounded-lg py-2.5 px-4 text-sm outline-none transition ${canEdit('name') ? 'border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100' : 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'}`}
                            />
                        </div>

                        {/* Personal Info Section */}
                        {!allowedFields && (<div className="pt-2">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="text-indigo-600">👤</span> Personal Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="classNumber" className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Class</label>
                                    <input
                                        id="classNumber"
                                        name="classNumber"
                                        type="text"
                                        placeholder="e.g. 1"
                                        value={formData.classNumber || ''}
                                        onChange={handleChange}
                                        className="w-full border-2 border-gray-200 rounded-lg py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="memberNumber" className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Member #</label>
                                    <input
                                        id="memberNumber"
                                        name="memberNumber"
                                        type="text"
                                        placeholder="e.g. 128"
                                        value={formData.memberNumber || ''}
                                        onChange={handleChange}
                                        className="w-full border-2 border-gray-200 rounded-lg py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                                    />
                                </div>
                            </div>
                        </div>)}

                        {/* Birth Date Section */}
                        {!allowedFields && (<div className="pt-2">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="text-indigo-600">📅</span> Date of Birth
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="dobMonth" className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Birth Month</label>
                                    <select
                                        id="dobMonth"
                                        name="dobMonth"
                                        value={formData.dobMonth || ''}
                                        onChange={handleChange}
                                        className="w-full border-2 border-gray-200 rounded-lg py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
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
                                    <label htmlFor="dobDay" className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Birth Day</label>
                                    <input
                                        id="dobDay"
                                        name="dobDay"
                                        type="number"
                                        min={1}
                                        max={31}
                                        placeholder="e.g. 15"
                                        value={formData.dobDay || ''}
                                        onChange={handleChange}
                                        className="w-full border-2 border-gray-200 rounded-lg py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">We store month and day only</p>
                        </div>)}

                        {/* Contact Information Section */}
                        <div className="pt-2">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="text-indigo-600">📞</span> Contact Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="email" className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Email</label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="example@domain.com"
                                        value={formData.email || ''}
                                        onChange={handleChange}
                                        disabled={!canEdit('email')}
                                        className={`w-full border-2 rounded-lg py-2.5 px-4 text-sm outline-none transition ${canEdit('email') ? 'border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100' : 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'}`}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="phone" className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Phone Number</label>
                                    <input
                                        id="phone"
                                        name="phone"
                                        type="tel"
                                        placeholder="(555) 123-4567"
                                        value={formData.phone || ''}
                                        onChange={handleChange}
                                        disabled={!canEdit('phone')}
                                        className={`w-full border-2 rounded-lg py-2.5 px-4 text-sm outline-none transition ${canEdit('phone') ? 'border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100' : 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'}`}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Other Information Section */}
                        <div className="pt-2">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="text-indigo-600">ℹ️</span> Additional Information
                            </h3>
                            <div>
                                <label htmlFor="profession" className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Profession</label>
                                <div className="flex gap-2">
                                    <input
                                        id="profession"
                                        name="profession"
                                        type="text"
                                        placeholder="e.g. Teacher"
                                        value={formData.profession || ''}
                                        onChange={handleChange}
                                        className="flex-1 border-2 border-gray-200 rounded-lg py-2.5 px-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, profession: 'Retired' }))}
                                        className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition duration-200 text-sm"
                                        title="Quick set to Retired"
                                    >
                                        Retired
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4">
                                <label htmlFor="address" className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Address</label>
                                <input
                                    id="address"
                                    name="address"
                                    type="text"
                                    placeholder="Street, City, Province, Postal Code"
                                    value={formData.address || ''}
                                    onChange={handleChange}
                                    disabled={!canEdit('address')}
                                    className={`w-full border-2 rounded-lg py-2.5 px-4 text-sm outline-none transition ${canEdit('address') ? 'border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100' : 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'}`}
                                />
                            </div>
                        </div>

                        {/* Status Section */}
                        {!allowedFields && (<div className="pt-4">
                            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-5 border-2 border-indigo-200">
                                <label htmlFor="active" className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        id="active"
                                        name="active"
                                        type="checkbox"
                                        checked={formData.active ?? true}
                                        onChange={handleChange}
                                        className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span className="font-semibold text-gray-900">Active Member</span>
                                </label>
                                <p className="text-xs text-gray-600 mt-2 ml-8">Uncheck to mark this member as inactive</p>
                            </div>
                        </div>)}

                        {/* Development Fund Section */}
                        {!allowedFields && (<div className="pt-2">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border-2 border-blue-200">
                                <label htmlFor="devFundPledge" className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        id="devFundPledge"
                                        name="devFundPledge"
                                        type="checkbox"
                                        checked={formData.devFundPledge ?? false}
                                        onChange={handleChange}
                                        className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span className="font-semibold text-gray-900">💙 Development Fund Pledge</span>
                                </label>
                                <p className="text-xs text-gray-600 mt-2 ml-8">Check if member has pledged to the development fund</p>
                                {formData.devFundPledge && (
                                    <div className="mt-4 ml-8 p-4 bg-white rounded-lg border border-blue-200">
                                        <label htmlFor="devFundPledgeAmount" className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Pledge Amount ($)</label>
                                        <input
                                            id="devFundPledgeAmount"
                                            name="devFundPledgeAmount"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={formData.devFundPledgeAmount || ''}
                                            onChange={handleChange}
                                            className="w-full border-2 border-blue-300 rounded-lg py-2.5 px-4 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition font-semibold"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>)}
                    </div>
                    {/* Footer with gradient buttons */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-4 flex justify-end gap-3 flex-shrink-0 border-t border-gray-200">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-6 py-2.5 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold rounded-lg transition duration-200 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold rounded-lg transition duration-200 shadow-lg hover:shadow-xl"
                        >
                            Save Member
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MemberModal;
