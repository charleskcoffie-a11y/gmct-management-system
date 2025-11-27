import React, { useState } from 'react';
import { ChurchIcon } from './icons';

interface LoginProps {
    onLogin: (username: string, password: string) => void;
    error: string | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, error }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(username, password);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full mx-auto">
                <div className="flex justify-center mb-6">
                    <div className="flex items-center gap-4 text-slate-800">
                         <ChurchIcon />
                        <div>
                            <h1 className="text-2xl font-bold">GMCT Management System</h1>
                            <p className="text-base text-slate-500">Please sign in to continue</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200/80">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="username" className="block font-medium text-slate-700">Username</label>
                            <div className="mt-1">
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block font-medium text-slate-700">Password</label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-base"
                                />
                            </div>
                        </div>
                        
                        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                        <div>
                            <button
                                type="submit"
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Sign in
                            </button>
                        </div>
                    </form>
                </div>
                 <p className="mt-4 text-center text-base text-slate-400">Default Admin: Admin / GMCT</p>
            </div>
        </div>
    );
};

export default Login;