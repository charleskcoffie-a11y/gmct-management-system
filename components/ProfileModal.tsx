import React, { useState, useEffect } from 'react';
import type { User } from '../types';

interface ProfileModalProps {
    currentUser: User;
    note: string;
    onSaveNote: (note: string) => void;
    onChangePassword: () => void;
    onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ currentUser, note, onSaveNote, onChangePassword, onClose }) => {
    const [draftNote, setDraftNote] = useState(note || '');
    const [savedAt, setSavedAt] = useState<string | null>(null);

    useEffect(() => {
        setDraftNote(note || '');
    }, [note]);

    const handleSaveNote = () => {
        onSaveNote(draftNote.trim());
        setSavedAt(new Date().toLocaleString());
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-white/10">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-indigo-200/80 font-semibold">Profile</p>
                        <h3 className="text-2xl font-bold">{currentUser.username}</h3>
                        <p className="text-sm text-slate-300/80">Role: {currentUser.role.replace(/-/g, ' ')}</p>
                    </div>
                    <button aria-label="Close" onClick={onClose} className="text-slate-300 hover:text-white text-xl">×</button>
                </div>

                <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold">Private Notes</h4>
                            {savedAt && <span className="text-xs text-slate-400">Saved {savedAt}</span>}
                        </div>
                        <textarea
                            value={draftNote}
                            onChange={(e) => setDraftNote(e.target.value)}
                            rows={5}
                            maxLength={800}
                            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400/60"
                            placeholder="Add notes visible only to you on this device"
                        />
                        <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>{draftNote.length}/800</span>
                            <button
                                type="button"
                                onClick={handleSaveNote}
                                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold shadow hover:from-indigo-400 hover:to-fuchsia-400"
                            >
                                Save Notes
                            </button>
                        </div>
                        <p className="text-xs text-amber-200/80 bg-amber-900/20 border border-amber-500/30 rounded-lg px-3 py-2">
                            Notes are stored locally in this browser for quick reference.
                        </p>
                    </div>

                    <div className="lg:col-span-2 space-y-3">
                        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                            <h4 className="text-lg font-semibold mb-2">Password</h4>
                            <p className="text-sm text-slate-300/80 mb-3">Update your password. This updates the same user record used by Admin.</p>
                            <button
                                type="button"
                                onClick={onChangePassword}
                                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow hover:from-emerald-400 hover:to-teal-400"
                            >
                                Change Password
                            </button>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                            <h4 className="text-lg font-semibold mb-1">Details</h4>
                            <ul className="text-sm text-slate-300/80 space-y-1">
                                <li><span className="font-semibold text-indigo-100">User:</span> {currentUser.username}</li>
                                <li><span className="font-semibold text-indigo-100">Role:</span> {currentUser.role.replace(/-/g, ' ')}</li>
                                {currentUser.classLed && <li><span className="font-semibold text-indigo-100">Class:</span> {currentUser.classLed}</li>}
                                {currentUser.assignedClass && !currentUser.classLed && <li><span className="font-semibold text-indigo-100">Class:</span> {currentUser.assignedClass}</li>}
                            </ul>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-2.5 rounded-lg border border-white/20 text-slate-100 hover:bg-white/5"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
