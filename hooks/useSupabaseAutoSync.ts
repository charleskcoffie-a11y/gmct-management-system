
import { useState, useEffect, useRef } from 'react';
import type { Settings, Entry, Member, WeeklyHistoryRecord, User, SyncStatus, DevelopmentFundEntry, MonthLock } from '../types';
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
        history: WeeklyHistoryRecord[];
        users: User[];
        monthLocks?: MonthLock[];
    },
    // Setters are required to update local state after a pull
    setters?: {
        setEntries: (d: Entry[]) => void;
        setMembers: (d: Member[]) => void;

        setHistory: (d: WeeklyHistoryRecord[]) => void;
        setUsers: (d: User[]) => void;
        setMonthLocks?: (d: MonthLock[]) => void;
        setSettings?: (d: Settings) => void;
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

        uLen: data.users.length,
        lLen: data.monthLocks?.length || 0,
        lastEntry: data.entries.length > 0 ? data.entries[data.entries.length - 1] : null,
        lastHist: data.history.length > 0 ? data.history[data.history.length - 1] : null,
        lastLock: data.monthLocks && data.monthLocks.length > 0 ? data.monthLocks[data.monthLocks.length - 1] : null,
        settingsHash: settings.classAccessCodes ? JSON.stringify(settings.classAccessCodes) : '',
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
                const mergedLocks = mergeUnique(data.monthLocks || [], cloudData.monthLocks || [], 'month');
                
                // For settings, prefer cloud settings if they exist (to sync class codes etc)
                const mergedSettings = cloudData.settings || settings;

                // Update UI with merged data
                setters.setEntries(mergedEntries);
                setters.setMembers(mergedMembers);
                setters.setHistory(mergedHistory);
                setters.setUsers(mergedUsers);
                setters.setMonthLocks?.(mergedLocks);
                if (cloudData.settings && setters.setSettings) {
                    setters.setSettings(mergedSettings);
                }


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

    // 1.5 Periodic Pull for Multi-User Updates (every 30 seconds)
    useEffect(() => {
        if (!isConfigured(settings) || !setters) return;
        if (!hasInitialPulled.current) return;

        const interval = setInterval(async () => {
            try {
                const cloudData = await downloadDataFromSupabase(settings.supabaseUrl, settings.supabaseKey);
                // For multi-user, always trust the database as source of truth
                setters.setEntries(cloudData.entries);
                setters.setMembers(cloudData.members);
                setters.setHistory(cloudData.history);
                setters.setUsers(cloudData.users);
                setters.setMonthLocks?.(cloudData.monthLocks || []);
                if (cloudData.settings && setters.setSettings) {
                    setters.setSettings(cloudData.settings);
                }
                setStatus({ state: 'synced', lastSynced: new Date() });
            } catch (e: any) {
                console.error("Periodic sync failed:", e);
            }
        }, 30000); // Pull every 30 seconds

        return () => clearInterval(interval);
    }, [settings.supabaseUrl, settings.supabaseKey]);


    // 2. Auto-Upload on Data Change (DISABLED for multi-user mode)
    // Individual operations now save directly to database via saveEntryToSupabase()
    // This prevents overwriting database with stale localStorage data
    /*
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

    */

    return status;
}