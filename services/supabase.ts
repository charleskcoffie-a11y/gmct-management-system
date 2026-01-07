
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Member, Entry, WeeklyHistoryRecord, User, DevelopmentFundEntry, MonthLock, WesleyHallReceipt, ETransfer, Requisition, RequisitionItem, RequisitionApproval, Settings, ClassLeader } from '../types';

// --- Singleton Client Helper ---
let supabaseInstance: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';

// Wrap async work with a short timeout so UI is not blocked by slow networks
const withTimeout = async <T>(label: string, promise: Promise<T>, ms = 8000): Promise<T> => {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} request timed out after ${ms}ms`)), ms));
    return Promise.race([promise, timeout]);
};

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
    city: m.city || null,
    province: m.province || null,
    email: m.email,
    profession: m.profession,
    phone: m.phone,
    dob_month: typeof m.dobMonth === 'number' ? m.dobMonth : null,
    dob_day: typeof m.dobDay === 'number' ? m.dobDay : null,
    date_of_birth: m.dateOfBirth || null,
    day_born: m.dayBorn || null,
    dev_fund_pledge: m.devFundPledge || false,
    dev_fund_pledge_amount: typeof m.devFundPledgeAmount === 'number' ? m.devFundPledgeAmount : null,
    active: typeof m.active === 'boolean' ? m.active : true,
    created_at: m.createdAt || new Date().toISOString() // Ensure never empty
});

const mapMemberFromDB = (m: any): Member => {
    const parseNum = (val: any) => {
        const n = typeof val === 'number' ? val : parseInt(val, 10);
        return Number.isFinite(n) ? n : undefined;
    };

    return {
        id: m.id,
        name: m.name,
        classNumber: m.class_number,
        memberNumber: m.member_number,
        address: m.address,
        city: m.city || undefined,
        province: m.province || undefined,
        email: m.email,
        profession: m.profession,
        phone: m.phone,
        dobMonth: parseNum(m.dob_month),
        dobDay: parseNum(m.dob_day),
        dateOfBirth: m.date_of_birth || undefined,
        dayBorn: m.day_born || undefined,
        devFundPledge: m.dev_fund_pledge || false,
        devFundPledgeAmount: typeof m.dev_fund_pledge_amount === 'number' ? m.dev_fund_pledge_amount : undefined,
        active: typeof m.active === 'boolean' ? m.active : true,
        createdAt: m.created_at
    };
};

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
    remaining: e.remaining,
    group_name: e.groupName,
    created_by: e.createdBy,
    updated_by: e.updatedBy,
    last_updated: toTimestamp(e.lastUpdated),
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
    remaining: e.remaining ? parseFloat(e.remaining) : undefined,
    groupName: e.group_name,
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

const mapClassLeaderToDB = (cl: ClassLeader) => ({
    id: cl.id,
    username: cl.username,
    password: cl.password,
    class_number: cl.classNumber,
    access_code: cl.accessCode,
    full_name: cl.fullName || null,
    phone: cl.phone || null,
    email: cl.email || null,
    active: cl.active,
    created_by: cl.createdBy || null,
    updated_by: cl.updatedBy || null,
    last_updated: cl.lastUpdated || null,
});

const mapClassLeaderFromDB = (cl: any): ClassLeader => ({
    id: cl.id,
    username: cl.username,
    password: cl.password,
    classNumber: cl.class_number,
    accessCode: cl.access_code,
    fullName: cl.full_name || undefined,
    phone: cl.phone || undefined,
    email: cl.email || undefined,
    active: cl.active ?? true,
    createdBy: cl.created_by || undefined,
    updatedBy: cl.updated_by || undefined,
    lastUpdated: cl.last_updated || undefined,
    createdAt: cl.created_at || undefined,
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

const mapSettingsToDB = (s: Settings) => ({
    id: 'app_settings', // Single row for app-wide settings
    currency: s.currency,
    max_classes: s.maxClasses,
    enforce_directory: s.enforceDirectory,
    supabase_url: s.supabaseUrl,
    logo_url: s.logoUrl,
    org_name: s.orgName,
    org_address: s.orgAddress,
    org_phone: s.orgPhone,
    org_email: s.orgEmail,
    charity_number: s.charityNumber,
    signature_image: s.signatureImage,
    annual_levy_amount: s.annualLevyAmount,
    etransfer_notification_email: s.etransferNotificationEmail,
    etransfer_provider: s.etransferProvider,
    class_access_codes: s.classAccessCodes ? JSON.stringify(s.classAccessCodes) : null,
});

const mapSettingsFromDB = (s: any): Settings => ({
    currency: s.currency || 'GH₵',
    maxClasses: s.max_classes || 14,
    enforceDirectory: s.enforce_directory !== false,
    supabaseUrl: s.supabase_url || '',
    supabaseKey: '', // never pull keys from database
    logoUrl: s.logo_url,
    orgName: s.org_name,
    orgAddress: s.org_address,
    orgPhone: s.org_phone,
    orgEmail: s.org_email,
    charityNumber: s.charity_number,
    signatureImage: s.signature_image,
    annualLevyAmount: s.annual_levy_amount,
    etransferNotificationEmail: s.etransfer_notification_email,
    etransferInboundSecret: undefined, // never pull secrets from database
    etransferProvider: s.etransfer_provider,
    classAccessCodes: s.class_access_codes ? JSON.parse(s.class_access_codes) : undefined,
});

// --- Sync Functions ---

export const uploadDataToSupabase = async (
    url: string, 
    key: string, 
    data: { 
        members: Member[], 
        entries: Entry[], 
        history: WeeklyHistoryRecord[], 
        users: User[],
        monthLocks?: MonthLock[],
        settings?: Settings
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

    if (data.settings) {
        try {
            const { error } = await supabase.from('app_settings').upsert([mapSettingsToDB(data.settings)]);
            if (error) console.warn(`Settings upload warning: ${error.message}`);
        } catch (e) {
            console.warn('Settings table may not exist yet.');
        }
    }

    return { success: true };
};

export const downloadDataFromSupabase = async (url: string, key: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const [members, entries, users, history, monthLocks, settings, classLeaders] = await Promise.all([
        withTimeout('members fetch', (async () => {
            const { data, error } = await supabase.from('members').select('*');
            if (error) throw new Error(`Fetch Members failed: ${error.message}`);
            return data?.map(mapMemberFromDB) || [];
        })()),
        withTimeout('entries fetch', (async () => {
            const { data, error } = await supabase.from('entries').select('*');
            if (error) throw new Error(`Fetch Entries failed: ${error.message}`);
            return data?.map(mapEntryFromDB) || [];
        })()),
        withTimeout('users fetch', (async () => {
            const { data, error } = await supabase.from('app_users').select('*');
            if (error) throw new Error(`Fetch Users failed: ${error.message}`);
            return data?.map(mapUserFromDB) || [];
        })()),
        withTimeout('history fetch', (async () => {
            const { data, error } = await supabase.from('weekly_history').select('*');
            if (error) throw new Error(`Fetch History failed: ${error.message}`);
            return data?.map(mapHistoryFromDB) || [];
        })()),
        withTimeout('month locks fetch', (async () => {
            try {
                const { data } = await supabase.from('month_locks').select('*');
                return data ? data.map(mapLockFromDB) : [];
            } catch (e) {
                console.log("Month locks table may not exist yet.");
                return [] as MonthLock[];
            }
        })()),
        withTimeout('settings fetch', (async () => {
            try {
                const { data } = await supabase.from('app_settings').select('*').eq('id', 'app_settings').single();
                return data ? mapSettingsFromDB(data) : undefined;
            } catch (e) {
                console.log("Settings table may not exist yet.");
                return undefined as Settings | undefined;
            }
        })()),
        withTimeout('class_leaders fetch', (async () => {
            try {
                const { data } = await supabase.from('class_leaders').select('*').eq('active', true);
                return data ? data.map(mapClassLeaderFromDB) : [];
            } catch (e) {
                console.log("Class leaders table may not exist yet.");
                return [] as ClassLeader[];
            }
        })())
    ]);

    return { members, entries, users, history, monthLocks, settings, classLeaders };
};

// --- E-Transfers ---
const mapETransferFromDB = (r: any): ETransfer => ({
    id: r.id,
    receivedAt: r.received_at,
    amount: parseFloat(r.amount),
    currency: r.currency || undefined,
    senderName: r.sender_name || undefined,
    senderEmail: r.sender_email || undefined,
    memo: r.memo || undefined,
    rawSubject: r.raw_subject || undefined,
    rawText: r.raw_text || undefined,
    reconciled: !!r.reconciled,
    createdAt: r.created_at || undefined,
});

export const loadETransfersFromSupabase = async (url: string, key: string): Promise<ETransfer[]> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    const { data, error } = await supabase.from('etransfers').select('*').order('received_at', { ascending: false });
    if (error) {
        console.warn('Failed to load etransfers:', error.message);
        return [];
    }
    return (data || []).map(mapETransferFromDB);
};

export const markETransferReconciled = async (url: string, key: string, id: string, reconciled: boolean) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase.from('etransfers').update({ reconciled }).eq('id', id);
    if (error) throw new Error(error.message);
};

// --- Requisitions ---
const mapRequisitionToDB = (r: Requisition) => ({
    id: r.id,
    requester_username: r.requesterUsername,
    title: r.title,
    purpose: r.purpose,
    fund: r.fund,
    needed_by: r.neededBy || null,
    total_amount: r.totalAmount,
    status: r.status,
    updated_by: r.updatedBy || null,
    last_updated: r.lastUpdated || null,
});

const mapRequisitionFromDB = (r: any): Requisition => ({
    id: r.id,
    requesterUsername: r.requester_username,
    title: r.title,
    purpose: r.purpose || undefined,
    fund: r.fund || undefined,
    neededBy: r.needed_by || undefined,
    totalAmount: parseFloat(r.total_amount || 0),
    status: r.status,
    createdAt: r.created_at || undefined,
    updatedBy: r.updated_by || undefined,
    lastUpdated: r.last_updated || undefined,
});

const mapReqItemToDB = (i: RequisitionItem) => ({
    id: i.id,
    requisition_id: i.requisitionId,
    description: i.description,
    qty: i.qty,
    unit_price: i.unitPrice,
    account_code: i.accountCode || null,
});

const mapReqItemFromDB = (i: any): RequisitionItem => ({
    id: i.id,
    requisitionId: i.requisition_id,
    description: i.description,
    qty: parseFloat(i.qty || 0),
    unitPrice: parseFloat(i.unit_price || 0),
    accountCode: i.account_code || undefined,
});

const mapApprovalToDB = (a: RequisitionApproval) => ({
    id: a.id,
    requisition_id: a.requisitionId,
    approver_username: a.approverUsername,
    decision: a.decision,
    note: a.note || null,
    decided_at: a.decidedAt || null,
});

const mapApprovalFromDB = (a: any): RequisitionApproval => ({
    id: a.id,
    requisitionId: a.requisition_id,
    approverUsername: a.approver_username,
    decision: a.decision,
    note: a.note || undefined,
    decidedAt: a.decided_at || undefined,
});

export const loadRequisitions = async (url: string, key: string): Promise<Requisition[]> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    const { data, error } = await supabase.from('requisitions').select('*').order('created_at', { ascending: false });
    if (error) {
        console.warn('Failed to load requisitions:', error.message);
        return [];
    }
    const reqs = (data || []).map(mapRequisitionFromDB);
    // Attach items
    const ids = reqs.map(r => r.id);
    if (ids.length > 0) {
        const { data: itemsData } = await supabase.from('requisition_items').select('*').in('requisition_id', ids);
        const items = (itemsData || []).map(mapReqItemFromDB);
        const byReq: Record<string, RequisitionItem[]> = {};
        items.forEach(i => { (byReq[i.requisitionId] ||= []).push(i); });
        reqs.forEach(r => { r.items = byReq[r.id] || []; });
    }
    return reqs;
};

export const saveRequisition = async (url: string, key: string, req: Requisition) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase.from('requisitions').upsert([mapRequisitionToDB(req)]);
    if (error) throw new Error(error.message);
    if (req.items && req.items.length > 0) {
        // Upsert items
        const { error: itemErr } = await supabase.from('requisition_items').upsert(req.items.map(mapReqItemToDB));
        if (itemErr) throw new Error(itemErr.message);
    }
};

export const submitRequisition = async (url: string, key: string, id: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase.from('requisitions').update({ status: 'submitted', last_updated: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
};

export const decideRequisition = async (url: string, key: string, approval: RequisitionApproval, newStatus: 'approved' | 'rejected') => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error: insErr } = await supabase.from('requisition_approvals').insert([mapApprovalToDB(approval)]);
    if (insErr) throw new Error(insErr.message);
    const { error: updErr } = await supabase.from('requisitions').update({ status: newStatus, last_updated: new Date().toISOString() }).eq('id', approval.requisitionId);
    if (updErr) throw new Error(updErr.message);
};

// --- Individual Entry Operations (for multi-user real-time collaboration) ---
export const saveEntryToSupabase = async (url: string, key: string, entry: Entry) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");
    
    const { error } = await supabase.from('entries').upsert([mapEntryToDB(entry)]);
    if (error) throw new Error(`Save entry failed: ${error.message}`);

    // For harvest levy payments, reduce the member's annual levy remaining for that year
    try {
        if (entry.type === 'harvest-levy' && entry.memberID && entry.date) {
            const year = new Date(entry.date).getUTCFullYear();
            const { data: levyRows } = await supabase
                .from('member_levies')
                .select('id, remaining')
                .eq('member_id', entry.memberID)
                .eq('year', year)
                .limit(1);
            if (levyRows && levyRows.length > 0) {
                const currentRemaining = parseFloat(levyRows[0].remaining || 0);
                const newRemaining = Math.max(currentRemaining - entry.amount, 0);
                await supabase
                    .from('member_levies')
                    .update({ remaining: newRemaining })
                    .eq('id', levyRows[0].id);
            }
        }
    } catch (e) {
        console.warn('Levy reduction failed or table not present:', e);
    }
    return { success: true };
};

export const deleteEntryFromSupabase = async (url: string, key: string, entryId: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");
    
    const { error } = await supabase.from('entries').delete().eq('id', entryId);
    if (error) throw new Error(`Delete entry failed: ${error.message}`);
    return { success: true };
};

export const loadEntriesFromSupabase = async (url: string, key: string): Promise<Entry[]> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    const { data, error } = await supabase.from('entries').select('*').order('date', { ascending: false });
    if (error) {
        console.warn('Failed to load entries:', error.message);
        return [];
    }
    return (data || []).map(mapEntryFromDB);
};

export const loadMembersFromSupabase = async (url: string, key: string): Promise<Member[]> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    const { data, error } = await supabase.from('members').select('*').order('name', { ascending: true });
    if (error) {
        console.warn('Failed to load members:', error.message);
        return [];
    }
    return (data || []).map(mapMemberFromDB);
};

export const saveMemberToSupabase = async (url: string, key: string, member: Member) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");
    
    const memberData = mapMemberToDB(member);
    const isNewMember = !member.id || member.id.includes('temp');
    
    // Explicitly upsert on primary key 'id' and return updated row for verification
    const { data, error } = await supabase
        .from('members')
        .upsert([memberData], { onConflict: 'id' })
        .select('*')
        .eq('id', member.id)
        .limit(1);
    
    if (error) {
        throw new Error(`Save member failed: ${error.message}`);
    }
    
    const savedMember = data && data[0] ? mapMemberFromDB(data[0]) : member;
    
    // If this is a new member and they're active, create a levy record for current year
    if (isNewMember && member.active !== false) {
        try {
            const currentYear = new Date().getUTCFullYear();
            const levyAmount = await loadAnnualLevyAmount(url, key);
            
            if (levyAmount > 0) {
                const newLevy: MemberLevy = {
                    id: `${savedMember.id}-${currentYear}`,
                    memberID: savedMember.id,
                    year: currentYear,
                    baseAmount: levyAmount,
                    carryOver: 0,
                    remaining: levyAmount,
                    classNumber: savedMember.classNumber,
                };
                await upsertMemberLevies(url, key, [newLevy]);
            }
        } catch (levyError) {
            console.warn('Failed to create levy for new member:', levyError);
            // Don't fail the member save if levy creation fails
        }
    }
    
    // Return the updated member from database
    return { success: true, member: savedMember } as { success: true; member: Member };
};

export const saveMonthLockToSupabase = async (url: string, key: string, lock: MonthLock) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const { error } = await supabase.from('month_locks').upsert([mapLockToDB(lock)]);
    if (error) throw new Error(`Save month lock failed: ${error.message}`);
    return { success: true };
};

export const saveSettingsToSupabase = async (url: string, key: string, settings: Settings) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const { error } = await supabase.from('app_settings').upsert([mapSettingsToDB(settings)]);
    if (error) throw new Error(`Save settings failed: ${error.message}`);
    return { success: true };
};

// --- Individual User Operations ---
export const saveUserToSupabase = async (url: string, key: string, user: User, originalUsername?: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    // Hard guard: never allow editing or recreating the default Admin user
    const isOriginalAdmin = !!originalUsername && originalUsername.toLowerCase() === 'admin';
    const isTargetAdmin = user.username.toLowerCase() === 'admin';
    if (isOriginalAdmin || (!originalUsername && isTargetAdmin)) {
        throw new Error('Admin user cannot be edited or recreated');
    }

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

    // Hard guard: never allow deleting Admin user
    if (username.toLowerCase() === 'admin') {
        throw new Error('Admin user cannot be deleted');
    }

    const { error } = await supabase.from('app_users').delete().eq('username', username);
    if (error) throw new Error(`Delete user failed: ${error.message}`);
    return { success: true };
};

// --- Class Leader CRUD ---
export const saveClassLeaderToSupabase = async (url: string, key: string, classLeader: ClassLeader) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const dbData = mapClassLeaderToDB(classLeader);
    
    if (classLeader.id) {
        // Update existing
        const { error } = await supabase.from('class_leaders').update(dbData).eq('id', classLeader.id);
        if (error) throw new Error(`Update class leader failed: ${error.message}`);
    } else {
        // Insert new
        const { error } = await supabase.from('class_leaders').insert([dbData]);
        if (error) throw new Error(`Insert class leader failed: ${error.message}`);
    }
    
    return { success: true };
};

export const deleteClassLeaderFromSupabase = async (url: string, key: string, id: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const { error } = await supabase.from('class_leaders').delete().eq('id', id);
    if (error) throw new Error(`Delete class leader failed: ${error.message}`);
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

// --- Harvest Pledge Functions ---
interface HarvestPledgeDB {
    id: string;
    member_id: string;
    member_name: string;
    class_number: string;
    group_name?: string;
    date: string;
    amount: number;
    remaining: number;
    category: string;
    note?: string;
    created_by?: string;
    updated_by?: string;
    last_updated?: string;
    deleted?: boolean;
    created_at: string;
}

export interface HarvestPledge {
    id: string;
    memberID: string;
    memberName: string;
    classNumber: string;
    groupName?: string;
    date: string;
    amount: number;
    remaining: number;
    category: string;
    note?: string;
    createdBy?: string;
    updatedBy?: string;
    lastUpdated?: string;
    deleted?: boolean;
    createdAt: string;
}

const mapHarvestPledgeToDB = (p: HarvestPledge): HarvestPledgeDB => ({
    id: p.id,
    member_id: p.memberID,
    member_name: p.memberName,
    class_number: p.classNumber,
    group_name: p.groupName,
    date: p.date,
    amount: p.amount,
    remaining: p.remaining,
    category: p.category,
    note: p.note,
    created_by: p.createdBy,
    updated_by: p.updatedBy,
    last_updated: toTimestamp(p.lastUpdated),
    deleted: p.deleted,
    created_at: p.createdAt || new Date().toISOString()
});

const mapHarvestPledgeFromDB = (p: any): HarvestPledge => ({
    id: p.id,
    memberID: p.member_id,
    memberName: p.member_name,
    classNumber: p.class_number,
    groupName: p.group_name,
    date: p.date,
    amount: parseFloat(p.amount),
    remaining: parseFloat(p.remaining),
    category: p.category,
    note: p.note,
    createdBy: p.created_by,
    updatedBy: p.updated_by,
    lastUpdated: p.last_updated,
    deleted: p.deleted,
    createdAt: p.created_at
});

// Save single harvest pledge to Supabase
export const saveHarvestPledgeToSupabase = async (url: string, key: string, pledge: HarvestPledge) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const { error } = await supabase
        .from('harvest_pledges')
        .upsert([mapHarvestPledgeToDB(pledge)]);
    
    if (error) throw new Error(`Save harvest pledge failed: ${error.message}`);
    return { success: true };
};

// Save harvest pledge payment
export const saveHarvestPledgePayment = async (
    url: string, 
    key: string, 
    pledgeId: string, 
    paymentEntryId: string,
    amount: number,
    paymentDate: string,
    paidBy?: string
) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const { error } = await supabase
        .from('harvest_pledge_payments')
        .insert([{
            pledge_id: pledgeId,
            payment_entry_id: paymentEntryId,
            payment_date: paymentDate,
            amount: amount,
            paid_by: paidBy,
            created_at: new Date().toISOString()
        }]);
    
    if (error) throw new Error(`Save harvest pledge payment failed: ${error.message}`);
    return { success: true };
};

// Load all harvest pledges from Supabase
export const loadHarvestPledgesFromSupabase = async (url: string, key: string): Promise<HarvestPledge[]> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('harvest_pledges')
        .select('*')
        .order('date', { ascending: false });
    
    if (error) {
        console.error("Load harvest pledges failed:", error.message);
        return [];
    }
    
    return (data || []).map(mapHarvestPledgeFromDB);
};

// --- Member Levy (Annual Harvest Levy) ---

interface MemberLevyDB {
    id: string;
    member_id: string;
    year: number;
    base_amount: number; // annual levy amount for the year
    carry_over: number;  // unpaid from previous year
    remaining: number;   // base_amount + carry_over - payments
    class_number?: string;
    group_name?: string;
    created_at: string;
}

export interface MemberLevy {
    id: string;
    memberID: string;
    year: number;
    baseAmount: number;
    carryOver: number;
    remaining: number;
    classNumber?: string;
    groupName?: string;
    createdAt?: string;
}

const mapMemberLevyToDB = (l: MemberLevy): MemberLevyDB => ({
    id: l.id,
    member_id: l.memberID,
    year: l.year,
    base_amount: l.baseAmount,
    carry_over: l.carryOver,
    remaining: l.remaining,
    class_number: l.classNumber,
    group_name: l.groupName,
    created_at: l.createdAt || new Date().toISOString(),
});

const mapMemberLevyFromDB = (l: any): MemberLevy => ({
    id: l.id,
    memberID: l.member_id,
    year: l.year,
    baseAmount: parseFloat(l.base_amount),
    carryOver: parseFloat(l.carry_over || 0),
    remaining: parseFloat(l.remaining),
    classNumber: l.class_number,
    groupName: l.group_name,
    createdAt: l.created_at,
});

export const loadMemberLeviesForYear = async (url: string, key: string, year: number): Promise<MemberLevy[]> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('member_levies')
        .select('*')
        .eq('year', year);
    if (error) {
        console.warn('Load member levies failed:', error.message);
        return [];
    }
    return (data || []).map(mapMemberLevyFromDB);
};

export const upsertMemberLevies = async (url: string, key: string, levies: MemberLevy[]): Promise<{ success: boolean }> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    if (!levies || levies.length === 0) return { success: true };
    const { error } = await supabase
        .from('member_levies')
        .upsert(levies.map(mapMemberLevyToDB));
    if (error) throw new Error(`Upsert member levies failed: ${error.message}`);
    return { success: true };
};

export const generateMemberLeviesForYear = async (
    url: string,
    key: string,
    year: number,
    annualAmount: number
): Promise<{ success: boolean; created: number; updated: number }> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    if (!annualAmount || annualAmount <= 0) throw new Error('Annual levy amount must be greater than 0');

    // Load active members
    const { data: membersDB, error: memErr } = await supabase
        .from('members')
        .select('id, class_number, active');
    if (memErr) throw new Error(`Fetch members failed: ${memErr.message}`);
    const activeMembers = (membersDB || []).filter((m: any) => m.active !== false);

    // Load previous year levies
    const { data: prevLeviesDB } = await supabase
        .from('member_levies')
        .select('member_id, remaining')
        .eq('year', year - 1);
    const prevRemaining = new Map<string, number>();
    (prevLeviesDB || []).forEach((l: any) => prevRemaining.set(l.member_id, parseFloat(l.remaining || 0)));

    // Load existing current year levies to detect updates
    const { data: currLeviesDB } = await supabase
        .from('member_levies')
        .select('member_id')
        .eq('year', year);
    const existingSet = new Set<string>((currLeviesDB || []).map((l: any) => l.member_id));

    const levies: MemberLevy[] = activeMembers.map((m: any) => {
        const carry = prevRemaining.get(m.id) || 0;
        const total = annualAmount + carry;
        return {
            id: `${m.id}-${year}`,
            memberID: m.id,
            year,
            baseAmount: annualAmount,
            carryOver: carry,
            remaining: total,
            classNumber: m.class_number,
        };
    });

    await upsertMemberLevies(url, key, levies);
    const created = levies.filter(l => !existingSet.has(l.memberID)).length;
    const updated = levies.length - created;
    return { success: true, created, updated };
};

// --- Wesley Hall Receipts ---

const mapWesleyHallToDB = (r: WesleyHallReceipt) => ({
    id: r.id,
    date: r.date,
    amount: r.amount,
    notes: r.notes,
    created_by: r.createdBy,
    updated_by: r.updatedBy,
    last_updated: toTimestamp(r.lastUpdated),
    deleted: r.deleted,
    created_at: r.createdAt || new Date().toISOString(),
});

const mapWesleyHallFromDB = (r: any): WesleyHallReceipt => ({
    id: r.id,
    date: r.date,
    amount: parseFloat(r.amount),
    notes: r.notes,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    lastUpdated: r.last_updated,
    deleted: r.deleted,
    createdAt: r.created_at,
});

export const loadWesleyHallReceipts = async (url: string, key: string): Promise<WesleyHallReceipt[]> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('wesley_hall_receipts')
        .select('*')
        .order('date', { ascending: false });
    if (error) {
        console.warn('Load Wesley Hall receipts failed:', error.message);
        return [];
    }
    return (data || []).map(mapWesleyHallFromDB);
};

export const saveWesleyHallReceipt = async (url: string, key: string, receipt: WesleyHallReceipt) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase
        .from('wesley_hall_receipts')
        .upsert([mapWesleyHallToDB(receipt)]);
    if (error) throw new Error(`Save Wesley Hall receipt failed: ${error.message}`);
    return { success: true };
};

export const deleteWesleyHallReceipt = async (url: string, key: string, id: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase
        .from('wesley_hall_receipts')
        .delete()
        .eq('id', id);
    if (error) throw new Error(`Delete Wesley Hall receipt failed: ${error.message}`);
    return { success: true };
};

// --- Attendance Functions ---
export const loadAttendanceForDate = async (url: string, key: string, date: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', date);
    if (error) {
        console.warn('Load attendance failed:', error.message);
        return [];
    }
    return data || [];
};

export const saveAttendanceToSupabase = async (
    url: string,
    key: string,
    records: Array<{ date: string; member_id: string; status: string }>
) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'date,member_id' });
    if (error) throw new Error(`Save attendance failed: ${error.message}`);
    return { success: true };
};

export const loadAttendanceReport = async (url: string, key: string, startDate: string, endDate: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });
    if (error) {
        console.warn('Load attendance report failed:', error.message);
        return [];
    }
    return data || [];
};

// --- Asset Management Functions ---
const mapAssetToDB = (asset: any) => ({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    description: asset.description,
    location: asset.location,
    purchase_date: asset.purchaseDate,
    purchase_price: asset.purchasePrice,
    current_value: asset.currentValue,
    serial_number: asset.serialNumber,
    model: asset.model,
    condition: asset.condition,
    status: asset.status,
    assigned_to: asset.assignedTo,
    warranty_expires: asset.warrantyExpires,
    insurance_policy: asset.insurancePolicy,
    insurance_coverage: asset.insuranceCoverage,
    insurance_expires: asset.insuranceExpires,
    photo_url: asset.photoUrl,
    notes: asset.notes,
    useful_life_years: asset.usefulLifeYears,
    disposal_date: asset.disposalDate,
    disposal_method: asset.disposalMethod,
    disposal_value: asset.disposalValue,
    disposal_notes: asset.disposalNotes,
    created_by: asset.createdBy,
    updated_by: asset.updatedBy,
    created_at: asset.createdAt,
    updated_at: asset.updatedAt,
    deleted: asset.deleted || false,
});

const mapAssetFromDB = (row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    location: row.location,
    purchaseDate: row.purchase_date,
    purchasePrice: row.purchase_price,
    currentValue: row.current_value,
    serialNumber: row.serial_number,
    model: row.model,
    condition: row.condition,
    status: row.status,
    assignedTo: row.assigned_to,
    warrantyExpires: row.warranty_expires,
    insurancePolicy: row.insurance_policy,
    insuranceCoverage: row.insurance_coverage,
    insuranceExpires: row.insurance_expires,
    photoUrl: row.photo_url,
    notes: row.notes,
    usefulLifeYears: row.useful_life_years,
    disposalDate: row.disposal_date,
    disposalMethod: row.disposal_method,
    disposalValue: row.disposal_value,
    disposalNotes: row.disposal_notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted || false,
});

export const loadAssetsFromSupabase = async (url: string, key: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('name', { ascending: true });
    if (error) {
        console.warn('Load assets failed:', error.message);
        return [];
    }
    return (data || []).map(mapAssetFromDB);
};

export const saveAssetToSupabase = async (url: string, key: string, asset: any) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase
        .from('assets')
        .upsert([mapAssetToDB(asset)]);
    if (error) throw new Error(`Save asset failed: ${error.message}`);
    return { success: true };
};

export const deleteAssetFromSupabase = async (url: string, key: string, id: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    // Soft delete
    const { error } = await supabase
        .from('assets')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw new Error(`Delete asset failed: ${error.message}`);
    return { success: true };
};

// --- Asset Maintenance Functions ---
const mapMaintenanceToDB = (maintenance: any) => ({
    id: maintenance.id,
    asset_id: maintenance.assetId,
    maintenance_date: maintenance.maintenanceDate,
    description: maintenance.description,
    cost: maintenance.cost,
    service_provider: maintenance.serviceProvider,
    next_service_date: maintenance.nextServiceDate,
    notes: maintenance.notes,
    created_by: maintenance.createdBy,
    created_at: maintenance.createdAt,
});

const mapMaintenanceFromDB = (row: any) => ({
    id: row.id,
    assetId: row.asset_id,
    maintenanceDate: row.maintenance_date,
    description: row.description,
    cost: row.cost,
    serviceProvider: row.service_provider,
    nextServiceDate: row.next_service_date,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
});

export const loadAssetMaintenanceFromSupabase = async (url: string, key: string, assetId?: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    let query = supabase.from('asset_maintenance').select('*');
    if (assetId) query = query.eq('asset_id', assetId);
    query = query.order('maintenance_date', { ascending: false });
    const { data, error } = await query;
    if (error) {
        console.warn('Load asset maintenance failed:', error.message);
        return [];
    }
    return (data || []).map(mapMaintenanceFromDB);
};

export const saveAssetMaintenanceToSupabase = async (url: string, key: string, maintenance: any) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase
        .from('asset_maintenance')
        .upsert([mapMaintenanceToDB(maintenance)]);
    if (error) throw new Error(`Save asset maintenance failed: ${error.message}`);
    return { success: true };
};

// --- Utilities ---

export const loadUtilityValue = async (url: string, key: string, utilityKey: string): Promise<string | null> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('utilities')
        .select('value')
        .eq('key', utilityKey)
        .single();
    if (error) {
        console.warn(`Load utility ${utilityKey} failed:`, error.message);
        return null;
    }
    return data?.value || null;
};

export const saveUtilityValue = async (
    url: string,
    key: string,
    utilityKey: string,
    value: string,
    description?: string,
    updatedBy?: string
) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase
        .from('utilities')
        .upsert([{
            key: utilityKey,
            value,
            description: description || null,
            updated_by: updatedBy || null,
            updated_at: new Date().toISOString(),
        }]);
    if (error) throw new Error(`Save utility ${utilityKey} failed: ${error.message}`);
    return { success: true };
};

export const loadAnnualLevyAmount = async (url: string, key: string): Promise<number> => {
    const value = await loadUtilityValue(url, key, 'annual_levy_amount');
    return value ? parseFloat(value) || 0 : 0;
};

export const saveAnnualLevyAmount = async (
    url: string,
    key: string,
    amount: number,
    updatedBy?: string
) => {
    return saveUtilityValue(
        url,
        key,
        'annual_levy_amount',
        amount.toString(),
        'Annual harvest levy amount per member',
        updatedBy
    );
};
