import React from 'react';
import type { Settings, User } from '../types';
import { isEntryWindowOpen } from '../utils';

interface EntryWindowBannerProps {
    settings: Settings;
    currentUser?: User | null;
}

const EntryWindowBanner: React.FC<EntryWindowBannerProps> = ({ settings, currentUser }) => {
    if (!settings.entryWindow?.enabled) {
        return null; // Don't show banner if feature is disabled
    }

    const windowStatus = isEntryWindowOpen(settings.entryWindow);
    const canOverride = currentUser?.role === 'admin' || currentUser?.role === 'finance-chair';

    // If window is open, show brief info banner
    if (windowStatus.isOpen) {
        return (
            <div className="bg-gradient-to-r from-green-100 to-emerald-100 border-l-4 border-green-600 p-3 mb-4 rounded">
                <p className="text-sm font-semibold text-green-800">
                    ✅ Entry Window OPEN: Allowed on {settings.entryWindow.days?.join(', ') || 'selected days'} from {settings.entryWindow.startTime} - {settings.entryWindow.endTime} EST
                </p>
            </div>
        );
    }

    // Window is closed
    return (
        <div className={`border-l-4 p-4 mb-4 rounded ${canOverride ? 'bg-yellow-100 border-yellow-600' : 'bg-red-100 border-red-600'}`}>
            <div className="flex items-start gap-3">
                <div className="text-2xl">{canOverride ? '⚠️' : '🔒'}</div>
                <div className="flex-1">
                    <p className={`font-bold ${canOverride ? 'text-yellow-900' : 'text-red-900'}`}>
                        {canOverride 
                            ? '⚠️ ENTRY WINDOW CLOSED - ADMIN OVERRIDE ACTIVE' 
                            : '🔒 ENTRY WINDOW CLOSED - READ-ONLY MODE'}
                    </p>
                    <p className={`text-sm mt-1 ${canOverride ? 'text-yellow-800' : 'text-red-800'}`}>
                        {windowStatus.reason}
                    </p>
                    <p className={`text-sm font-semibold mt-2 ${canOverride ? 'text-yellow-800' : 'text-red-800'}`}>
                        {windowStatus.nextOpenTime}
                    </p>
                    {canOverride && (
                        <p className="text-xs text-yellow-700 mt-2 italic">
                            💡 As an admin, you can still add/edit entries. This will be logged as an override.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EntryWindowBanner;
