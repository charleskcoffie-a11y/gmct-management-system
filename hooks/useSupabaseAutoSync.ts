
import { useState, useEffect, useRef } from 'react';
import type { Settings, Entry, Member, WeeklyHistoryRecord, User, SyncStatus, DevelopmentFundEntry, MonthLock, SundayLock, ClassLeader } from '../types';
import { downloadDataFromSupabase } from '../services/supabase';

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
        sundayLocks?: SundayLock[];
        classLeaders?: ClassLeader[];
    },
    // Setters are required to update local state after a pull
    setters?: {
        setEntries: (d: Entry[]) => void;
        setMembers: (d: Member[]) => void;
        setHistory: (d: WeeklyHistoryRecord[]) => void;
        setUsers: (d: User[]) => void;
        setMonthLocks?: (d: MonthLock[]) => void;
        setSundayLocks?: (d: SundayLock[]) => void;
        setSettings?: (d: Settings) => void;
        setClassLeaders?: (d: ClassLeader[]) => void;
    },
    societyId?: string
): SyncStatus {
    // Initialize state based on whether credentials exist
    const [status, setStatus] = useState<SyncStatus>(() => ({
        // Start in syncing state when configured so UI does not render stale local values first.
        state: isConfigured(settings) ? 'syncing' : 'offline',
        lastSynced: undefined
    }));
    
    const isFirstMount = useRef(true);
    const hasInitialPulled = useRef(false);
    const currentSocietyRef = useRef<string | undefined>(societyId);

    // Reset initial pulled flag when society changes so it fetches fresh data for the newly selected society
    if (currentSocietyRef.current !== societyId) {
        currentSocietyRef.current = societyId;
        hasInitialPulled.current = false;
    }

    // 1. Initial Pull on Mount or Society Change (Smart Merge)
    useEffect(() => {
        const performInitialPull = async () => {
            if (!isConfigured(settings) || !setters) return;
            if (hasInitialPulled.current) return;

            setStatus({ state: 'syncing' });
            try {
                const cloudData = await downloadDataFromSupabase(settings.supabaseUrl, settings.supabaseKey, societyId);
                const cloudSettings = cloudData.settings
                    ? {
                        ...cloudData.settings,
                        // Never overwrite secrets pulled from local configuration
                        supabaseUrl: settings.supabaseUrl,
                        supabaseKey: settings.supabaseKey,
                        etransferInboundSecret: settings.etransferInboundSecret,
                    }
                    : settings;

                // Trust cloud data as source of truth (multi-user); ignore local cache to avoid confusion
                const cloudEntries = cloudData.entries || [];
                const cloudMembers = cloudData.members || [];
                const cloudHistory = cloudData.history || [];
                const cloudUsers = cloudData.users || [];
                const usersToApply = cloudUsers.length > 0 ? cloudUsers : data.users;
                const cloudLocks = cloudData.monthLocks || [];
                const cloudSundayLocks = cloudData.sundayLocks || [];
                const cloudClassLeaders = cloudData.classLeaders || [];
                // Update UI with cloud data only
                setters.setEntries(cloudEntries);
                setters.setMembers(cloudMembers);
                setters.setHistory(cloudHistory);
                setters.setUsers(usersToApply);
                setters.setMonthLocks?.(cloudLocks);
                setters.setSundayLocks?.(cloudSundayLocks);
                setters.setClassLeaders?.(cloudClassLeaders);
                if (setters.setSettings) setters.setSettings(cloudSettings);
                hasInitialPulled.current = true;
                setStatus({ state: 'synced', lastSynced: new Date() });
            } catch (e: any) {
                console.error("Initial Sync Failed:", e);
                // Even if pull fails, we might want to let the user work offline.
                hasInitialPulled.current = true;
                setStatus({ state: 'error', errorMessage: "Initial Pull Failed: " + e.message });
            }
        };

        if (isConfigured(settings)) {
            performInitialPull();
        }
    }, [settings.supabaseUrl, settings.supabaseKey, societyId]); // Run when settings or society changes

    // 1.5 Periodic Pull for Multi-User Updates (every 30 seconds)
    useEffect(() => {
        const interval = setInterval(async () => {
            if (!setters) return;
            try {
                const cloudData = await downloadDataFromSupabase(settings.supabaseUrl, settings.supabaseKey, societyId);
                const cloudEntries = cloudData.entries || [];
                const cloudMembers = cloudData.members || [];
                const cloudHistory = cloudData.history || [];
                const cloudUsers = cloudData.users || [];
                const usersToApply = cloudUsers.length > 0 ? cloudUsers : data.users;
                const cloudClassLeaders = cloudData.classLeaders || [];

                // For multi-user, always trust the database as source of truth
                setters.setEntries(cloudEntries);
                setters.setMembers(cloudMembers);
                setters.setHistory(cloudHistory);
                setters.setUsers(usersToApply);
                setters.setMonthLocks?.(cloudData.monthLocks || []);
                setters.setClassLeaders?.(cloudClassLeaders);
                if (setters.setSettings) {
                    const cloudSettings = cloudData.settings
                        ? {
                            ...cloudData.settings,
                            supabaseUrl: settings.supabaseUrl,
                            supabaseKey: settings.supabaseKey,
                            etransferInboundSecret: settings.etransferInboundSecret,
                        }
                        : settings;
                    setters.setSettings(cloudSettings);
                }
                setStatus({ state: 'synced', lastSynced: new Date() });
            } catch (e: any) {
                console.error("Periodic sync failed:", e);
            }
        }, 30000); // Pull every 30 seconds

        return () => clearInterval(interval);
    }, [settings.supabaseUrl, settings.supabaseKey, societyId]);


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