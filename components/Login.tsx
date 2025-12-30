import React, { useState } from 'react';
import { ChurchIcon } from './icons';
import type { User } from '../types';

interface LoginProps {
    users: User[];
    onLogin: (username: string, password: string) => void;
    error: string | null;
}

const Login: React.FC<LoginProps> = ({ users, onLogin, error }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(username, password);
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-indigo-900 to-fuchsia-900 text-slate-100">
            <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(1200px_600px_at_-10%_-10%,rgba(99,102,241,0.25),transparent_60%),radial-gradient(800px_400px_at_120%_110%,rgba(236,72,153,0.18),transparent_55%)]"></div>
            <div className="relative w-full max-w-6xl">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sign-in Card */}
                    <div className="backdrop-blur-md bg-white/10 border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
                        <div className="px-8 pt-8 pb-4 flex items-center gap-4">
                            <div className="shrink-0">
                                <ChurchIcon />
                            </div>
                            <div>
                                <h1 className="text-2xl font-extrabold tracking-tight">GMCT Management System</h1>
                                <p className="text-sm text-indigo-100/80">Welcome back — please sign in to continue</p>
                            </div>
                        </div>
                        <div className="px-8 pb-8">
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label htmlFor="username" className="block font-semibold text-indigo-100/90">Username</label>
                                    <div className="mt-1 relative">
                                        <select
                                            id="username"
                                            name="username"
                                            required
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="appearance-none block w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-white/10 text-slate-100 placeholder-indigo-200/50 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400/60"
                                        >
                                            <option value="" disabled>Select user</option>
                                            {users.map(user => (
                                                <option key={user.username} value={user.username}>{user.username}</option>
                                            ))}
                                        </select>
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300/60 text-xs">{users.length} users</span>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="password" className="block font-semibold text-indigo-100/90">Password</label>
                                    <div className="mt-1">
                                        <input
                                            id="password"
                                            name="password"
                                            type="password"
                                            autoComplete="current-password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="block w-full px-3 py-2 rounded-lg bg-slate-950/40 border border-white/10 text-slate-100 placeholder-indigo-200/50 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400/60"
                                        />
                                    </div>
                                </div>

                                {error && <p className="text-sm text-red-300 bg-red-900/30 border border-red-400/30 rounded-lg px-3 py-2">{error}</p>}

                                <div className="pt-1">
                                    <button
                                        type="submit"
                                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 shadow-lg shadow-indigo-900/30 focus:outline-none focus:ring-2 focus:ring-white/30"
                                    >
                                        <span>Sign in</span>
                                        <span aria-hidden>→</span>
                                    </button>
                                </div>
                            </form>
                            <p className="mt-4 text-sm text-indigo-100/70">Default Admin: <span className="font-semibold">Admin</span> / <span className="font-semibold">GMCT</span></p>
                            <div className="mt-6 pt-4 border-t border-white/10 space-y-3">
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
        </div>
    );
};

export default Login;