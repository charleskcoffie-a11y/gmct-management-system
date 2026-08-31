import React, { useMemo, useState } from 'react';
import { ChurchIcon, AdminIcon, FinanceIcon, DataEntryIcon, ClassLeaderIcon, PastorIcon, StatisticianIcon } from './icons';
import type { User, UserRole, Settings, Society } from '../types';

type LoginRequest = { username: string; password?: string; skipPassword?: boolean; role?: UserRole };

interface LoginProps {
    users: User[];
    onLogin: (request: LoginRequest) => void;
    error: string | null;
    settings: Settings;
    selectedSociety?: Society;
    onChangeSociety?: () => void;
}

const roleLabels: Record<UserRole, string> = {
    admin: 'Administrator',
    'finance-chair': 'Finance Chair',
    'finance-team': 'Finance Team',
    'data-entry': 'Data Entry',
    pastor: 'Pastor',
    statistician: 'Statistician',
    'class-leader': 'Class Leader',
};

const roleNotes: Partial<Record<UserRole, string>> = {
    'finance-team': 'Select finance team member to continue',
    'finance-chair': 'Finance leadership access',
    'data-entry': 'Auto-login enabled',
    'class-leader': 'Sign in with your class leader account',
};

const financeRoles: UserRole[] = ['finance-team'];

const hiddenRoles: UserRole[] = ['finance-chair'];

// Keep primary login categories visible even if cloud user sync is incomplete.
const defaultVisibleRoles: UserRole[] = ['admin', 'finance-team', 'data-entry', 'pastor', 'class-leader'];

const fallbackUsers: User[] = [
    { username: 'Admin', password: 'GMCT', role: 'admin' },
    { username: 'FinanceTeam', password: 'GMCT', role: 'finance-team' },
    { username: 'Pastor', password: 'GMCT', role: 'pastor' },
    { username: 'DataEntry', password: 'GMCT', role: 'data-entry' },
    { username: 'ClassLeader', role: 'class-leader' },
];

// Map roles to their icons and colors
const roleIconMap: Record<UserRole, { icon: React.ReactNode; color: string; bgColor: string }> = {
    admin: {
        icon: <AdminIcon />,
        color: 'text-purple-400',
        bgColor: 'bg-purple-900/30',
    },
    'finance-chair': {
        icon: <FinanceIcon />,
        color: 'text-amber-400',
        bgColor: 'bg-amber-900/30',
    },
    'finance-team': {
        icon: <FinanceIcon />,
        color: 'text-amber-400',
        bgColor: 'bg-amber-900/30',
    },
    'data-entry': {
        icon: <DataEntryIcon />,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-900/30',
    },
    pastor: {
        icon: <PastorIcon />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-900/30',
    },
    statistician: {
        icon: <StatisticianIcon />,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-900/30',
    },
    'class-leader': {
        icon: <ClassLeaderIcon />,
        color: 'text-pink-400',
        bgColor: 'bg-pink-900/30',
    },
};

const Login: React.FC<LoginProps> = ({ users, onLogin, error, settings, selectedSociety, onChangeSociety }) => {
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [password, setPassword] = useState('');
    const [showUserModal, setShowUserModal] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const societyName = selectedSociety?.name || 'GMCT Management System';
    const societyLocation = selectedSociety ? `${selectedSociety.city}, ${selectedSociety.province}` : 'Toronto, ON';

    // Keep emergency local users available when cloud users are empty/restricted.
    const userOptions: User[] = useMemo(() => {
        const merged = [...users];
        for (const fallback of fallbackUsers) {
            const exists = merged.some(u => u.username.toLowerCase() === fallback.username.toLowerCase());
            if (!exists) merged.push(fallback);
        }
        return merged;
    }, [users]);

    const roles = useMemo(() => {
        const fromUsers = userOptions.map(u => u.role);
        const merged = Array.from(new Set([...defaultVisibleRoles, ...fromUsers]));
        return merged.filter(r => !hiddenRoles.includes(r));
    }, [userOptions]);

    const getUsersForRole = (role: UserRole | null) => {
        if (!role) return [];
        // When finance-team is selected, show both finance-team and finance-chair users
        if (role === 'finance-team') return userOptions.filter(u => u.role === 'finance-team' || u.role === 'finance-chair');
        return userOptions.filter(u => u.role === role);
    };

    const handleRoleSelect = (role: UserRole) => {
        setSelectedRole(role);
        setPassword('');
        setLocalError(null);

        if (role === 'data-entry') {
            const dataEntryUser = getUsersForRole(role)[0];
            if (!dataEntryUser) {
                setLocalError('No Data Entry user configured. Contact Admin.');
                return;
            }
            onLogin({ username: dataEntryUser.username, password: dataEntryUser.password, skipPassword: true, role });
            return;
        }

        // For class leaders, show username/password form like other roles
        const roleUsers = getUsersForRole(role);
        if (roleUsers.length === 0) {
            setLocalError(`No ${roleLabels[role]} user configured. Contact Admin.`);
            return;
        }
        setSelectedUser(roleUsers[0]?.username || '');
        setShowUserModal(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRole) {
            setLocalError('Select a role to continue.');
            return;
        }
        if (!selectedUser) {
            setLocalError('Choose a user for this role.');
            return;
        }
        setLocalError(null);
        onLogin({ username: selectedUser, password, role: selectedRole });
    };

    const displayedError = localError || error;

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-indigo-900 to-fuchsia-900 text-slate-100">
            <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(1200px_600px_at_-10%_-10%,rgba(99,102,241,0.25),transparent_60%),radial-gradient(800px_400px_at_120%_110%,rgba(236,72,153,0.18),transparent_55%)]"></div>
            <div className="relative w-full max-w-6xl">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sign-in Card */}
                    <div className="backdrop-blur-md bg-white/10 border border-white/10 shadow-2xl rounded-2xl overflow-hidden relative">
                        {/* Society Switcher Top Bar */}
                        {onChangeSociety && (
                            <div className="px-8 pt-6 pb-0 flex items-center justify-between text-xs border-b border-white/5 pb-3">
                                <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
                                    <span>🇨🇦</span> Canada Mission
                                </span>
                                <button
                                    type="button"
                                    onClick={onChangeSociety}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 transition-colors"
                                >
                                    <span>←</span>
                                    <span>Switch Society</span>
                                </button>
                            </div>
                        )}

                        <div className="px-8 pt-6 pb-4 flex items-center gap-4">
                            <div className="shrink-0">
                                <ChurchIcon />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl font-extrabold tracking-tight text-white">{societyName}</h1>
                                </div>
                                <p className="text-sm text-indigo-100/80">
                                    {societyLocation} {selectedSociety?.societyCode && `• [${selectedSociety.societyCode}]`} — Choose your role to continue
                                </p>
                            </div>
                        </div>
                        <div className="px-8 pb-8 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {roles.map(role => {
                                    const { icon, color, bgColor } = roleIconMap[role];
                                    return (
                                        <button
                                            key={role}
                                            type="button"
                                            onClick={() => handleRoleSelect(role)}
                                            className={`text-left w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 shadow hover:border-indigo-300/50 hover:bg-slate-900/60 transition focus:outline-none focus:ring-2 focus:ring-indigo-400/60 ${selectedRole === role ? 'border-indigo-300 bg-slate-900/70' : ''}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className={`flex-shrink-0 p-2 rounded-lg ${bgColor} ${color}`}>
                                                        {icon}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-indigo-50">{roleLabels[role]}</p>
                                                        <p className="text-xs text-indigo-100/70">{roleNotes[role] || 'Sign in with your account'}</p>
                                                    </div>
                                                </div>
                                                {role === 'data-entry' && (
                                                    <span className="text-[10px] uppercase font-bold text-emerald-200 bg-emerald-600/30 px-2 py-1 rounded-full">Auto</span>
                                                )}
                                                {financeRoles.includes(role) && (
                                                    <span className="text-[10px] uppercase font-bold text-amber-200 bg-amber-600/30 px-2 py-1 rounded-full">Finance</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {displayedError && (
                                <p className="text-sm text-red-300 bg-red-900/30 border border-red-400/30 rounded-lg px-3 py-2">{displayedError}</p>
                            )}

                            <p className="text-sm text-indigo-100/70">Default Admin: <span className="font-semibold">Admin</span> / <span className="font-semibold">GMCT</span></p>
                            <div className="pt-4 border-t border-white/10 space-y-3">
                                <div>
                                    <p className="text-xs font-semibold text-indigo-100 mb-2">Security Tips</p>
                                    <ul className="text-xs text-indigo-100/70 space-y-1">
                                        <li>• Never share your password with anyone</li>
                                        <li>• Use a strong, unique password</li>
                                        <li>• Always log out when finished</li>
                                        <li>• Keep your browser updated</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-indigo-100 mb-1">Session Info</p>
                                    <p className="text-xs text-indigo-100/70">Sessions automatically expire after 15 minutes of inactivity. You will be logged out and prompted to sign back in.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Insights Card */}
                    <div className="backdrop-blur-md bg-white/5 border border-white/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
                        <div className="px-8 pt-8 pb-4">
                            <h2 className="text-xl font-extrabold tracking-tight">Features</h2>
                            <p className="text-indigo-100/80 text-sm">Complete list of capabilities.</p>
                        </div>
                        <div className="px-8 pb-6 space-y-2 overflow-y-auto max-h-96">
                            <div className="text-sm text-indigo-100/90 space-y-2">
                                <p className="font-semibold text-indigo-100">Financial Management</p>
                                <ul className="text-xs text-indigo-100/80 space-y-1 ml-3">
                                    <li>• Record tithes, offerings, and donations</li>
                                    <li>• Track pledges and pledge payments</li>
                                    <li>• Manage e-transfers and fund tracking</li>
                                    <li>• Anonymous donations (No Name)</li>
                                    <li>• Development fund contributions</li>
                                    <li>• Harvest pledges and payments</li>
                                    <li>• Tax receipts generation</li>
                                </ul>

                                <p className="font-semibold text-indigo-100 pt-2">Member Management</p>
                                <ul className="text-xs text-indigo-100/80 space-y-1 ml-3">
                                    <li>• Full member profiles with contact info</li>
                                    <li>• Member email and phone directory</li>
                                    <li>• Date of birth tracking</li>
                                    <li>• Profession and occupation records</li>
                                    <li>• Member status (active/inactive)</li>
                                    <li>• Upcoming birthdays view</li>
                                </ul>

                                <p className="font-semibold text-indigo-100 pt-2">Attendance & Insights</p>
                                <ul className="text-xs text-indigo-100/80 space-y-1 ml-3">
                                    <li>• Weekly attendance tracking</li>
                                    <li>• Class and service attendance</li>
                                    <li>• Attendance reports and history</li>
                                    <li>• Financial insights and trends</li>
                                    <li>• Scoped summaries by role</li>
                                </ul>

                                <p className="font-semibold text-indigo-100 pt-2">Data & Administration</p>
                                <ul className="text-xs text-indigo-100/80 space-y-1 ml-3">
                                    <li>• CSV export and bulk operations</li>
                                    <li>• Automated weekly backups</li>
                                    <li>• Role-based access control</li>
                                    <li>• User management and permissions</li>
                                    <li>• Requisitions and approvals</li>
                                </ul>
                            </div>
                        </div>
                        <div className="px-8 pb-8 space-y-3 border-t border-white/10 pt-4">
                            <div>
                                <p className="text-sm font-semibold text-indigo-100 mb-2">Need Help?</p>
                                <ul className="text-xs text-indigo-100/80 space-y-1 ml-3">
                                    <li>• Press <span className="font-mono bg-white/10 px-1 rounded">?</span> for keyboard shortcuts</li>
                                    <li>• Email: <a href="mailto:charleskcoffie@gmail.com" className="text-indigo-300 hover:text-indigo-200 underline">charleskcoffie@gmail.com</a></li>
                                    <li>• Contact your Admin for access issues</li>
                                    <li>• Use the Help icon in the dashboard menu</li>
                                </ul>
                            </div>
                            <p className="text-[11px] text-indigo-100/70">Access is role-based. Contact an Admin if you need help with your role.</p>
                            <div className="text-[11px] text-indigo-100/70">By signing in, you agree to handle member data responsibly.</div>
                        </div>
                    </div>
                </div>
            </div>

            {showUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl bg-slate-900 shadow-2xl border border-white/10 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                {selectedRole && (
                                    <div className={`flex-shrink-0 p-3 rounded-lg ${roleIconMap[selectedRole].bgColor} ${roleIconMap[selectedRole].color}`}>
                                        {roleIconMap[selectedRole].icon}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-lg font-bold text-white">{selectedRole ? roleLabels[selectedRole] : 'Sign in'}</h3>
                                    <p className="text-sm text-slate-300">Enter your credentials</p>
                                </div>
                            </div>
                            <button onClick={() => setShowUserModal(false)} className="text-slate-300 hover:text-white" aria-label="Close">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-indigo-100/90 mb-1">User</label>
                                <select
                                    value={selectedUser}
                                    onChange={(e) => setSelectedUser(e.target.value)}
                                    className="block w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400/60"
                                >
                                    <option value="" disabled>Select user</option>
                                    {getUsersForRole(selectedRole).map(user => (
                                        <option key={user.username} value={user.username}>{user.username}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-indigo-100/90 mb-1">Password / Access Code</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400/60"
                                    autoFocus
                                />
                            </div>

                            {displayedError && (
                                <p className="text-sm text-red-300 bg-red-900/30 border border-red-400/30 rounded-lg px-3 py-2">{displayedError}</p>
                            )}

                            <div className="flex justify-end gap-3 pt-1">
                                <button type="button" onClick={() => { setShowUserModal(false); setPassword(''); }} className="px-4 py-2 rounded-lg border border-white/10 text-slate-100 hover:bg-slate-800">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold shadow">Continue</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;