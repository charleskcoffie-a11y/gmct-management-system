
import { useState, useEffect, useRef } from 'react';
import type { Settings, Entry, Member, AttendanceRecord, WeeklyHistoryRecord, User, SyncStatus, DevelopmentFundEntry } from '../types';
import { uploadDataToSupabase, downloadDataFromSupabase } from '../services/supabase';
import { mergeUnique } from '../utils';

// Helper to check if Supabase is configured
const isConfigured = (settings: Settings) => {
    return !!settings.supabaseUrl && settings.supabaseUrl.trim() !== '' && !!settings.supabaseKey && settings.supabaseKey.trim() !== '';
};

export function useSupabaseAutoSync(
    settings: Settings,
    data: {
        entries: Entry[];
        members: Member[];
        attendance: AttendanceRecord[];
        history: WeeklyHistoryRecord[];
        users: User[];
        developmentFund: DevelopmentFundEntry[];
    },
    // Setters are required to update local state after a pull
    setters?: {
        setEntries: (d: Entry[]) => void;
        setMembers: (d: Member[]) => void;
        setAttendance: (d: AttendanceRecord[]) => void;
        setHistory: (d: WeeklyHistoryRecord[]) => void;
        setUsers: (d: User[]) => void;
        setDevelopmentFund: (d: DevelopmentFundEntry[]) => void;
    }
): SyncStatus {
    // Initialize state based on whether credentials exist
    const [status, setStatus] = useState<SyncStatus>(() => ({
        state: isConfigured(settings) ? 'synced' : 'offline',
        lastSynced: isConfigured(settings) ? new Date() : undefined
    }));
    
    const isFirstMount = useRef(true);
    const hasInitialPulled = useRef(false);
    const timeoutRef = useRef<any>(null);

    // We only want to auto-sync if data changes.
    const dataDependency = JSON.stringify({
        eLen: data.entries.length,
        mLen: data.members.length,
        hLen: data.history.length,
        aLen: data.attendance.length,
        uLen: data.users.length,
        dLen: data.developmentFund.length,
        lastEntry: data.entries.length > 0 ? data.entries[data.entries.length - 1] : null,
        lastHist: data.history.length > 0 ? data.history[data.history.length - 1] : null,
        lastDev: data.developmentFund.length > 0 ? data.developmentFund[data.developmentFund.length - 1] : null,
    });

    // 1. Initial Pull on Mount (Smart Merge)
    useEffect(() => {
        const performInitialPull = async () => {
            if (!isConfigured(settings) || !setters) return;
            if (hasInitialPulled.current) return;

            setStatus({ state: 'syncing' });
            try {
                // Fetch Cloud Data
                const cloudData = await downloadDataFromSupabase(settings.supabaseUrl, settings.supabaseKey);

                // Merge Logic: Combine Cloud + Local
                // We trust Cloud data for collisions, but keep Local data if it's new (offline created)
                const mergedEntries = mergeUnique(data.entries, cloudData.entries);
                const mergedMembers = mergeUnique(data.members, cloudData.members);
                const mergedHistory = mergeUnique(data.history, cloudData.history);
                const mergedUsers = mergeUnique(data.users, cloudData.users, 'username');
                const mergedDevFund = mergeUnique(data.developmentFund, cloudData.developmentFund);
                
                // Attendance is array of objects with composite keys, simpler to just prefer cloud for now
                const mergedAttendance = cloudData.attendance.length > 0 ? cloudData.attendance : data.attendance;

                // Update UI with merged data
                setters.setEntries(mergedEntries);
                setters.setMembers(mergedMembers);
                setters.setHistory(mergedHistory);
                setters.setUsers(mergedUsers);
                setters.setAttendance(mergedAttendance);
                setters.setDevelopmentFund(mergedDevFund);

                hasInitialPulled.current = true;
                setStatus({ state: 'synced', lastSynced: new Date() });
            } catch (e: any) {
                console.error("Initial Sync Failed:", e);
                // Even if pull fails, we might want to let the user work offline.
                setStatus({ state: 'error', errorMessage: "Initial Pull Failed: " + e.message });
            }
        };

        if (isConfigured(settings)) {
            performInitialPull();
        }
    }, [settings.supabaseUrl, settings.supabaseKey]); // Run when settings (keys) change or mount


    // 2. Auto-Upload on Data Change
    useEffect(() => {
        // Skip sync on initial load or if we haven't done the initial pull yet (to prevent overwriting cloud with stale local)
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }

        // Safety: Don't push if we are configured but haven't successfully pulled yet. 
        // This prevents "I opened app offline, now I'm online, I push old data" scenario.
        if (isConfigured(settings) && !hasInitialPulled.current) {
            return;
        }

        if (!isConfigured(settings)) {
            setStatus({ state: 'offline' });
            return;
        }

        // Debounce logic
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setStatus(prev => ({ ...prev, state: 'syncing' }));

        timeoutRef.current = setTimeout(async () => {
            try {
                await uploadDataToSupabase(settings.supabaseUrl, settings.supabaseKey, data);
                setStatus({ state: 'synced', lastSynced: new Date() });
            } catch (error: any) {
                console.error("Auto-sync failed:", error);
                setStatus({ state: 'error', errorMessage: error.message || "Unknown sync error" });
            }
        }, 2000);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [dataDependency, settings.supabaseUrl, settings.supabaseKey]);

    return status;
}