import React, { useState, useEffect } from 'react';

interface KeyboardShortcutsProps {
    onNavigate: (page: string) => void;
}

const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({ onNavigate }) => {
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            // Ctrl/Cmd + ? to show help
            if ((e.ctrlKey || e.metaKey) && e.key === '?') {
                e.preventDefault();
                setShowHelp(!showHelp);
            }

            // Ctrl/Cmd + D for Dashboard
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                onNavigate('dashboard');
            }

            // Ctrl/Cmd + M for Members
            if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
                e.preventDefault();
                onNavigate('members');
            }

            // Ctrl/Cmd + A for Attendance
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                onNavigate('attendance');
            }

            // Ctrl/Cmd + F for Financial Records
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                onNavigate('records');
            }

            // Ctrl/Cmd + I for Insights
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                onNavigate('insights');
            }

            // Escape to close help
            if (e.key === 'Escape') {
                setShowHelp(false);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [showHelp, onNavigate]);

    if (!showHelp) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 flex justify-between items-center">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m6 2a2 2 0 11-4 0 2 2 0 014 0zm0 0h.01M6 20v-2a2 2 0 012-2h4a2 2 0 012 2v2M6 20H4a2 2 0 01-2-2v-6a2 2 0 012-2h12a2 2 0 012 2v6a2 2 0 01-2 2h-2" />
                        </svg>
                        Keyboard Shortcuts
                    </h2>
                    <button 
                        onClick={() => setShowHelp(false)}
                        className="text-white hover:bg-white/20 p-2 rounded-lg transition"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <h3 className="font-bold text-slate-800 text-lg">Navigation</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Dashboard</span>
                                    <kbd className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-sm font-mono">Ctrl+D</kbd>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Members</span>
                                    <kbd className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-sm font-mono">Ctrl+M</kbd>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Attendance</span>
                                    <kbd className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-sm font-mono">Ctrl+A</kbd>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Financial Records</span>
                                    <kbd className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-sm font-mono">Ctrl+F</kbd>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Insights & Reports</span>
                                    <kbd className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-sm font-mono">Ctrl+I</kbd>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="font-bold text-slate-800 text-lg">General</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Show Help</span>
                                    <kbd className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-sm font-mono">Ctrl+?</kbd>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Close Dialog</span>
                                    <kbd className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-sm font-mono">Esc</kbd>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Print Chart</span>
                                    <kbd className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-sm font-mono">Ctrl+P</kbd>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                        <p className="text-sm text-blue-800">
                            <strong>💡 Tip:</strong> Use <kbd className="px-1 py-0.5 bg-blue-200 rounded text-xs font-mono">Ctrl</kbd> on Windows or <kbd className="px-1 py-0.5 bg-blue-200 rounded text-xs font-mono">Cmd</kbd> on Mac with the letter keys for quick navigation.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-100 border-t border-slate-200 p-4 flex justify-end">
                    <button 
                        onClick={() => setShowHelp(false)}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcuts;
