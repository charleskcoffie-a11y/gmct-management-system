
// components/MemberModal.tsx
import React, { useState, useEffect } from 'react';
import type { Member } from '../types';
import { sanitizeMember, sanitizeString } from '../utils';

interface MemberModalProps {
    member: Member | null;
    onSave: (member: Member) => void;
    onClose: () => void;
}

const MemberModal: React.FC<MemberModalProps> = ({ member, onSave, onClose }) => {
    const [formData, setFormData] = useState<Member>(member || sanitizeMember({}));

    useEffect(() => {
        // When the 'member' prop changes, we must reset the form's state.
        if (member) {
            setFormData(member);
        } else {
            setFormData(sanitizeMember({}));
        }
    }, [member]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(sanitizeMember(formData));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b">
                        <h2 className="text-xl font-bold text-gray-800">{member ? 'Edit Member' : 'Add New Member'}</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label htmlFor="id" className="block font-medium text-gray-700">System ID</label>
                            <input
                                id="id"
                                name="id"
                                type="text"
                                value={formData.id}
                                disabled
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-gray-100 cursor-not-allowed text-xs text-gray-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="name" className="block font-medium text-gray-700">Full Name</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="classNumber" className="block font-medium text-gray-700">Class (Group)</label>
                                <input
                                    id="classNumber"
                                    name="classNumber"
                                    type="text"
                                    placeholder="e.g. 1"
                                    value={formData.classNumber || ''}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="memberNumber" className="block font-medium text-gray-700">Member #</label>
                                <input
                                    id="memberNumber"
                                    name="memberNumber"
                                    type="text"
                                    placeholder="e.g. 128"
                                    value={formData.memberNumber || ''}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="dobMonth" className="block font-medium text-gray-700">Birth Month</label>
                                <select
                                    id="dobMonth"
                                    name="dobMonth"
                                    value={formData.dobMonth || ''}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                                <label htmlFor="dobDay" className="block font-medium text-gray-700">Birth Day</label>
                                <input
                                    id="dobDay"
                                    name="dobDay"
                                    type="number"
                                    min={1}
                                    max={31}
                                    placeholder="e.g. 15"
                                    value={formData.dobDay || ''}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">We store month and day only.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="email" className="block font-medium text-gray-700">Email</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="example@domain.com"
                                    value={formData.email || ''}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="phone" className="block font-medium text-gray-700">Phone Number</label>
                                <input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    placeholder="e.g. (555) 123-4567"
                                    value={formData.phone || ''}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="profession" className="block font-medium text-gray-700">Profession</label>
                            <div className="flex gap-2">
                                <input
                                    id="profession"
                                    name="profession"
                                    type="text"
                                    placeholder="e.g. Teacher"
                                    value={formData.profession || ''}
                                    onChange={handleChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, profession: 'Retired' }))}
                                    className="mt-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-3 rounded-md"
                                    title="Quick set to Retired"
                                >
                                    Retired
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">You can enter any profession or click Retired.</p>
                        </div>
                        <div>
                            <label htmlFor="address" className="block font-medium text-gray-700">Address</label>
                            <input
                                id="address"
                                name="address"
                                type="text"
                                placeholder="Street, City, Province, Postal Code"
                                value={formData.address || ''}
                                onChange={handleChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <label htmlFor="active" className="flex items-center gap-3 cursor-pointer">
                                <input
                                    id="active"
                                    name="active"
                                    type="checkbox"
                                    checked={formData.active ?? true}
                                    onChange={handleChange}
                                    className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <span className="font-bold text-gray-800">Active Member</span>
                            </label>
                            <p className="text-xs text-gray-500 mt-1">Uncheck to mark this member as inactive.</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <label htmlFor="devFundPledge" className="flex items-center gap-3 cursor-pointer">
                                <input
                                    id="devFundPledge"
                                    name="devFundPledge"
                                    type="checkbox"
                                    checked={formData.devFundPledge ?? false}
                                    onChange={handleChange}
                                    className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="font-bold text-gray-800">Development Fund Pledge</span>
                            </label>
                            <p className="text-xs text-gray-500 mt-1">Check if member has pledged to the development fund.</p>
                            {formData.devFundPledge && (
                                <div className="mt-3">
                                    <label htmlFor="devFundPledgeAmount" className="block font-medium text-gray-700 mb-1">Pledge Amount</label>
                                    <input
                                        id="devFundPledgeAmount"
                                        name="devFundPledgeAmount"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={formData.devFundPledgeAmount || ''}
                                        onChange={handleChange}
                                        className="block w-full border border-blue-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-b-lg flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancel</button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">Save Member</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MemberModal;
