
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Member, Entry, WeeklyHistoryRecord, User, DevelopmentFundEntry, MonthLock } from '../types';

// --- Singleton Client Helper ---
let supabaseInstance: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';

export const getSupabaseClient = (url: string, key: string): SupabaseClient | null => {
    if (!url || !key) return null;
    
    // Return existing instance if credentials haven't changed
    if (supabaseInstance && url === currentUrl && key === currentKey) {
        return supabaseInstance;
    }

    try {
        supabaseInstance = createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
            }
        });
        currentUrl = url;
        currentKey = key;
        return supabaseInstance;
    } catch (e) {
        console.error("Invalid Supabase URL/Key", e);
        return null;
    }
};

// --- Connection Test ---
export const testSupabaseConnection = async (url: string, key: string) => {
    try {
        if (!url || !key) {
             return { success: false, message: "URL and Key are required." };
        }
        
        // Add a timeout promise to prevent hanging
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Connection timed out. Check your internet.")), 5000)
        );

        const connectionPromise = async () => {
             // Create a temp client for testing to avoid resetting the singleton unnecessarily
             const supabase = createClient(url, key);
             const { error } = await supabase.from('members').select('*', { count: 'exact', head: true });
             
             if (error) {
                 if (error.code === 'PGRST204') {
                      return { success: true, message: "Connected! (Note: 'members' table missing)" };
                 }
                  throw error;
             }
             return { success: true, message: "Connection successful!" };
        };

        return await Promise.race([connectionPromise(), timeout]) as { success: boolean, message: string };

    } catch (e: any) {
        return { success: false, message: `Connection failed: ${e.message || 'Unknown error'}` };
    }
};

// --- Data Mapping Helpers ---

// Helper to handle empty strings for dates/timestamps
const toTimestamp = (dateStr?: string) => {
    if (!dateStr || dateStr.trim() === '') return null;
    return dateStr;
};

const mapMemberToDB = (m: Member) => ({
    id: m.id,
    name: m.name,
    class_number: m.classNumber,
    member_number: m.memberNumber,
    address: m.address,
    active: typeof m.active === 'boolean' ? m.active : true,
    created_at: m.createdAt || new Date().toISOString() // Ensure never empty
});

const mapMemberFromDB = (m: any): Member => ({
    id: m.id,
    name: m.name,
    classNumber: m.class_number,
    memberNumber: m.member_number,
    address: m.address,
    active: typeof m.active === 'boolean' ? m.active : true,
    createdAt: m.created_at
});

const mapEntryToDB = (e: Entry) => ({
    id: e.id,
    date: e.date,
    member_id: e.memberID,
    member_name: e.memberName,
    type: e.type,
    fund: e.fund,
    method: e.method,
    amount: e.amount,
    note: e.note,
    class_number: e.classNumber,
    created_by: e.createdBy,
    updated_by: e.updatedBy,
    last_updated: toTimestamp(e.lastUpdated), // Handle empty string
    deleted: e.deleted,
    created_at: e.createdAt || new Date().toISOString()
});

const mapEntryFromDB = (e: any): Entry => ({
    id: e.id,
    date: e.date,
    memberID: e.member_id,
    memberName: e.member_name,
    type: e.type,
    fund: e.fund,
    method: e.method,
    amount: parseFloat(e.amount),
    note: e.note,
    classNumber: e.class_number,
    createdBy: e.created_by,
    updatedBy: e.updated_by,
    lastUpdated: e.last_updated,
    deleted: e.deleted,
    createdAt: e.created_at
});

const mapDevFundToDB = (d: DevelopmentFundEntry) => ({
    id: d.id,
    date: d.date,
    member_id: d.memberId,
    amount: d.amount,
    description: d.description,
    created_by: d.createdBy
});

const mapDevFundFromDB = (d: any): DevelopmentFundEntry => ({
    id: d.id,
    date: d.date,
    memberId: d.member_id,
    amount: parseFloat(d.amount),
    description: d.description,
    createdBy: d.created_by
});

const mapUserToDB = (u: User) => ({
    username: u.username,
    password: u.password,
    role: u.role,
    class_led: u.classLed
});

const mapUserFromDB = (u: any): User => ({
    username: u.username,
    password: u.password,
    role: u.role,
    classLed: u.class_led
});

const mapHistoryToDB = (h: WeeklyHistoryRecord) => ({
    id: h.id,
    date_of_service: h.dateOfService,
    society_name: h.societyName,
    data: h 
});

const mapHistoryFromDB = (h: any): WeeklyHistoryRecord => {
    if (h.data && typeof h.data === 'object') {
        return { ...h.data, id: h.id, dateOfService: h.date_of_service, societyName: h.society_name };
    }
    return h; 
};

const mapLockToDB = (l: MonthLock) => ({
    month: l.month,
    is_locked: l.isLocked,
    locked_by: l.lockedBy,
    locked_at: toTimestamp(l.lockedAt)
});

const mapLockFromDB = (l: any): MonthLock => ({
    month: l.month,
    isLocked: l.is_locked,
    lockedBy: l.locked_by,
    lockedAt: l.locked_at
});

// --- Sync Functions ---

export const uploadDataToSupabase = async (
    url: string, 
    key: string, 
    data: { 
        members: Member[], 
        entries: Entry[], 
        attendance: AttendanceRecord[], 
        history: WeeklyHistoryRecord[], 
        users: User[],
        monthLocks?: MonthLock[]
    }
) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    if (data.users.length > 0) {
        const { error } = await supabase.from('app_users').upsert(data.users.map(mapUserToDB));
        if (error) throw new Error(`Users upload failed: ${error.message}`);
    }

    if (data.members.length > 0) {
        const { error } = await supabase.from('members').upsert(data.members.map(mapMemberToDB));
        if (error) throw new Error(`Members upload failed: ${error.message}`);
    }

    if (data.entries.length > 0) {
        try {
            const { error } = await supabase.from('entries').upsert(data.entries.map(mapEntryToDB));
            if (error) throw new Error(`Entries upload failed: ${error.message}`);
        } catch (e: any) {
            console.error("Entry upload error details:", e);
            throw e;
        }
    }

    if (data.history.length > 0) {
        const { error } = await supabase.from('weekly_history').upsert(data.history.map(mapHistoryToDB));
        if (error) throw new Error(`History upload failed: ${error.message}`);
    }
    
    if (data.monthLocks && data.monthLocks.length > 0) {
        const { error } = await supabase.from('month_locks').upsert(data.monthLocks.map(mapLockToDB));
        if (error) console.warn(`Month Locks upload warning: ${error.message}`);
    }



    return { success: true };
};

export const downloadDataFromSupabase = async (url: string, key: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const { data: membersDB, error: memErr } = await supabase.from('members').select('*');
    if (memErr) throw new Error(`Fetch Members failed: ${memErr.message}`);
    const members = membersDB?.map(mapMemberFromDB) || [];

    const { data: entriesDB, error: entErr } = await supabase.from('entries').select('*');
    if (entErr) throw new Error(`Fetch Entries failed: ${entErr.message}`);
    const entries = entriesDB?.map(mapEntryFromDB) || [];

    const { data: usersDB, error: userErr } = await supabase.from('app_users').select('*');
    if (userErr) throw new Error(`Fetch Users failed: ${userErr.message}`);
    const users = usersDB?.map(mapUserFromDB) || [];

    const { data: historyDB, error: histErr } = await supabase.from('weekly_history').select('*');
    if (histErr) throw new Error(`Fetch History failed: ${histErr.message}`);
    const history = historyDB?.map(mapHistoryFromDB) || [];
    
    let monthLocks: MonthLock[] = [];
    try {
        const { data: locksDB } = await supabase.from('month_locks').select('*');
        if (locksDB) monthLocks = locksDB.map(mapLockFromDB);
    } catch (e) {
        console.log("Month locks table may not exist yet.");
    }

    return {
        members,
        entries,
        users,
        history,
        monthLocks
    };
};

// --- Individual Entry Operations (for multi-user real-time collaboration) ---
export const saveEntryToSupabase = async (url: string, key: string, entry: Entry) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");
    
    const { error } = await supabase.from('entries').upsert([mapEntryToDB(entry)]);
    if (error) throw new Error(`Save entry failed: ${error.message}`);
    return { success: true };
};

export const deleteEntryFromSupabase = async (url: string, key: string, entryId: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");
    
    const { error } = await supabase.from('entries').delete().eq('id', entryId);
    if (error) throw new Error(`Delete entry failed: ${error.message}`);
    return { success: true };
};

export const saveMemberToSupabase = async (url: string, key: string, member: Member) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");
    
    const { error } = await supabase.from('members').upsert([mapMemberToDB(member)]);
    if (error) throw new Error(`Save member failed: ${error.message}`);
    return { success: true };
};

export const saveMonthLockToSupabase = async (url: string, key: string, lock: MonthLock) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const { error } = await supabase.from('month_locks').upsert([mapLockToDB(lock)]);
    if (error) throw new Error(`Save month lock failed: ${error.message}`);
    return { success: true };
};

// --- Individual User Operations ---
export const saveUserToSupabase = async (url: string, key: string, user: User, originalUsername?: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const { error } = await supabase.from('app_users').upsert([mapUserToDB(user)]);
    if (error) throw new Error(`Save user failed: ${error.message}`);

    if (originalUsername && originalUsername.toLowerCase() !== user.username.toLowerCase()) {
        const { error: delErr } = await supabase.from('app_users').delete().eq('username', originalUsername);
        if (delErr) throw new Error(`Cleanup old username failed: ${delErr.message}`);
    }
    return { success: true };
};

export const deleteUserFromSupabase = async (url: string, key: string, username: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const { error } = await supabase.from('app_users').delete().eq('username', username);
    if (error) throw new Error(`Delete user failed: ${error.message}`);
    return { success: true };
};

// --- Individual Member Delete ---
export const deleteMemberFromSupabase = async (url: string, key: string, memberId: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const { error } = await supabase.from('members').delete().eq('id', memberId);
    if (error) throw new Error(`Delete member failed: ${error.message}`);
    return { success: true };
};
