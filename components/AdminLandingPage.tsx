import React from 'react';
import type { Tab, User } from '../types';
import { capitalize } from '../utils';

interface AdminLandingPageProps {
    onNavigate: (tab: Tab) => void;
    currentUser: User;
}

const InfoCard: React.FC<{ title: string, description: string, onClick: () => void }> = ({ title, description, onClick }) => (
    <button
        onClick={onClick}
        className="p-6 border border-slate-200 rounded-lg text-left w-full transition-all duration-200 hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
        <h3 className="font-semibold text-lg text-slate-800">{title}</h3>
        <p className="mt-2 text-base text-slate-500">{description}</p>
    </button>
);


const AdminLandingPage: React.FC<AdminLandingPageProps> = ({ onNavigate, currentUser }) => {
    return (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200/80">
            <h2 className="text-3xl font-bold text-slate-800">Welcome, {capitalize(currentUser.role)}</h2>
            <p className="mt-2 text-slate-600">This is your central hub for managing the church's records and operations. Click a card to get started.</p>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoCard 
                    title="Financial Records"
                    description="View, add, and manage all tithes, offerings, and other financial contributions. Export data for reporting."
                    onClick={() => onNavigate('records')}
                />
                <InfoCard 
                    title="Member Directory"
                    description="Maintain an up-to-date directory of all church members. Track giving and attendance history for each member."
                    onClick={() => onNavigate('members')}
                />
                <InfoCard 
                    title="Attendance Reporting"
                    description="Monitor attendance for all classes. View detailed reports for specific dates or individual members."
                    onClick={() => onNavigate('admin-attendance')}
                />
                 <InfoCard 
                    title="Weekly History"
                    description="Log and review weekly service history, including attendance, sermon topics, and special events."
                    onClick={() => onNavigate('history')}
                />
                <InfoCard 
                    title="User Management"
                    description="Create and manage user accounts for finance staff and class leaders, assigning appropriate permissions."
                    onClick={() => onNavigate('users')}
                />
                <InfoCard 
                    title="Settings & Cloud Sync"
                    description="Configure application settings and use OneDrive to securely back up and restore your data across devices."
                    onClick={() => onNavigate('settings')}
                />
            </div>
        </div>
    );
};

export default AdminLandingPage;