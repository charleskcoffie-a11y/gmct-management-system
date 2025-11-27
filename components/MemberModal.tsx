
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
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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
