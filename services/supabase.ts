
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Member, Entry, WeeklyHistoryRecord, User, DevelopmentFundEntry, MonthLock, WesleyHallReceipt, ETransfer, Requisition, RequisitionItem, RequisitionApproval, Settings } from '../types';

// --- Singleton Client Helper ---
let supabaseInstance: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';

export const getSupabaseClient = (url: string, key: string): SupabaseClient | null => {
    if (!url || !key) return null;
    if (!/^https?:\/\//i.test(url)) return null;
    
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
        if (!url || !key || !/^https?:\/\//i.test(url)) {
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mapEntryToDB = (e: Entry) => ({
    id: e.id,
    date: e.date,
    member_id: e.memberID && UUID_REGEX.test(e.memberID) ? e.memberID : null,
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
    supabase_key: s.supabaseKey,
    logo_url: s.logoUrl,
    org_name: s.orgName,
    org_address: s.orgAddress,
    org_phone: s.orgPhone,
    org_email: s.orgEmail,
    charity_number: s.charityNumber,
    signature_image: s.signatureImage,
    annual_levy_amount: s.annualLevyAmount,
    etransfer_notification_email: s.etransferNotificationEmail,
    etransfer_inbound_secret: s.etransferInboundSecret,
    etransfer_provider: s.etransferProvider,
    class_access_codes: s.classAccessCodes ? JSON.stringify(s.classAccessCodes) : null,
    requisition_approval_limits: s.requisitionApprovalLimits ? JSON.stringify(s.requisitionApprovalLimits) : null,
    requisition_pastor_limits: s.requisitionPastorLimits ? JSON.stringify(s.requisitionPastorLimits) : null,
    requisition_finance_approvers: s.requisitionFinanceApprovers ? JSON.stringify(s.requisitionFinanceApprovers) : null,
});

const normalizeApprovalLimits = (raw: any) => {
    if (!raw || typeof raw !== 'object') return undefined;
    const financeTeam = raw.financeTeam ?? raw.steward ?? raw.finance;
    return {
        pastor: raw.pastor,
        financeTeam
    };
};

const mapSettingsFromDB = (s: any): Settings => ({
    currency: s.currency || 'GH₵',
    maxClasses: s.max_classes || 14,
    enforceDirectory: s.enforce_directory !== false,
    supabaseUrl: s.supabase_url || '',
    supabaseKey: s.supabase_key || '',
    logoUrl: s.logo_url,
    orgName: s.org_name,
    orgAddress: s.org_address,
    orgPhone: s.org_phone,
    orgEmail: s.org_email,
    charityNumber: s.charity_number,
    signatureImage: s.signature_image,
    annualLevyAmount: s.annual_levy_amount,
    etransferNotificationEmail: s.etransfer_notification_email,
    etransferInboundSecret: s.etransfer_inbound_secret,
    etransferProvider: s.etransfer_provider,
    classAccessCodes: s.class_access_codes ? JSON.parse(s.class_access_codes) : undefined,
    requisitionApprovalLimits: s.requisition_approval_limits ? normalizeApprovalLimits(JSON.parse(s.requisition_approval_limits)) : undefined,
    requisitionPastorLimits: s.requisition_pastor_limits ? JSON.parse(s.requisition_pastor_limits) : undefined,
    requisitionFinanceApprovers: s.requisition_finance_approvers ? JSON.parse(s.requisition_finance_approvers) : undefined,
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

    let settings: Settings | undefined;
    try {
        const { data: settingsDB } = await supabase.from('app_settings').select('*').eq('id', 'app_settings').single();
        if (settingsDB) settings = mapSettingsFromDB(settingsDB);
    } catch (e) {
        console.log("Settings table may not exist yet.");
    }

    return {
        members,
        entries,
        users,
        history,
        monthLocks,
        settings
    };
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
    requisition_number: r.requisitionNumber || null,
    requester_username: r.requesterUsername,
    requester_name: r.requesterName,
    date_created: r.dateCreated || null,
    title: r.title,
    purpose: r.purpose,
    payable_to: r.payableTo || null,
    organization_committee: r.organizationCommittee || null,
    intended_for: r.intendedFor,
    purchase_type: r.purchaseType,
    fund: r.fund,
    needed_by: r.neededBy || null,
    total_amount: r.totalAmount,
    status: r.status,
    source_type: r.sourceType || null,
    required_approver_role: r.requiredApproverRole || null,
    required_approver_username: r.requiredApproverUsername || null,
    completion_attachment_url: r.completionAttachmentUrl || null,
    completion_attachment_at: r.completionAttachmentAt || null,
    uploaded_pdf: r.uploadedPdf || null,
    receipt_attachment: r.receiptAttachments || null,
    updated_by: r.updatedBy || null,
    last_updated: r.lastUpdated || null,
});

const normalizeReceiptAttachment = (raw: any) => {
    if (!raw) return undefined;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') return [parsed];
            return undefined;
        } catch {
            return undefined;
        }
    }
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') return [raw];
    return undefined;
};

const mapRequisitionFromDB = (r: any): Requisition => ({
    id: r.id,
    requisitionNumber: r.requisition_number || undefined,
    requesterUsername: r.requester_username,
    requesterName: r.requester_name || r.requester_username,
    dateCreated: r.date_created || undefined,
    title: r.title,
    purpose: r.purpose || undefined,
    payableTo: r.payable_to || undefined,
    organizationCommittee: r.organization_committee || undefined,
    intendedFor: r.intended_for || undefined,
    purchaseType: r.purchase_type || undefined,
    fund: r.fund || undefined,
    neededBy: r.needed_by || undefined,
    totalAmount: parseFloat(r.total_amount || 0),
    status: r.status,
    sourceType: r.source_type || undefined,
    requiredApproverRole: r.required_approver_role || undefined,
    requiredApproverUsername: r.required_approver_username || undefined,
    completionAttachmentUrl: r.completion_attachment_url || undefined,
    completionAttachmentAt: r.completion_attachment_at || undefined,
    uploadedPdf: r.uploaded_pdf || undefined,
    receiptAttachments: normalizeReceiptAttachment(r.receipt_attachment),
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
    approver_role: a.approverRole || null,
    decision: a.decision,
    note: a.note || null,
    signature_name: a.signatureName,
    signature_at: a.signatureAt || null,
    decided_at: a.decidedAt || null,
});

const mapApprovalFromDB = (a: any): RequisitionApproval => ({
    id: a.id,
    requisitionId: a.requisition_id,
    approverUsername: a.approver_username,
    approverRole: a.approver_role || undefined,
    decision: a.decision,
    note: a.note || undefined,
    signatureName: a.signature_name || '',
    signatureAt: a.signature_at || undefined,
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
    if (ids.length > 0) {
        const { data: approvalsData } = await supabase.from('requisition_approvals').select('*').in('requisition_id', ids).order('decided_at', { ascending: false });
        const approvals = (approvalsData || []).map(mapApprovalFromDB);
        const byReq: Record<string, RequisitionApproval[]> = {};
        approvals.forEach(a => { (byReq[a.requisitionId] ||= []).push(a); });
        reqs.forEach(r => { r.approvals = byReq[r.id] || []; });
    }
    return reqs;
};

export const saveRequisition = async (url: string, key: string, req: Requisition) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase.from('requisitions').upsert([mapRequisitionToDB(req)]);
    if (error) throw new Error(error.message);
    const items = req.items || [];

    const { error: deleteErr } = await supabase
        .from('requisition_items')
        .delete()
        .eq('requisition_id', req.id);
    if (deleteErr) throw new Error(deleteErr.message);

    if (items.length > 0) {
        const { error: itemErr } = await supabase.from('requisition_items').upsert(items.map(mapReqItemToDB));
        if (itemErr) throw new Error(itemErr.message);
    }
};

export const deleteRequisition = async (url: string, key: string, id: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase.from('requisitions').delete().eq('id', id);
    if (error) throw new Error(error.message);
};

export const submitRequisition = async (url: string, key: string, id: string, requiredApproverRole?: string, requiredApproverUsername?: string, requisitionNumber?: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase.from('requisitions')
        .update({
            status: 'submitted',
            required_approver_role: requiredApproverRole || null,
            required_approver_username: requiredApproverUsername || null,
            requisition_number: requisitionNumber || null,
            last_updated: new Date().toISOString()
        })
        .eq('id', id);
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

export const uploadRequisitionAttachment = async (url: string, key: string, requisitionId: string, file: File) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${requisitionId}/completion-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('requisition-attachments').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('requisition-attachments').getPublicUrl(path);
    return data.publicUrl;
};

export const saveRequisitionAttachment = async (url: string, key: string, requisitionId: string, attachmentUrl: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase.from('requisitions')
        .update({ completion_attachment_url: attachmentUrl, completion_attachment_at: new Date().toISOString(), last_updated: new Date().toISOString() })
        .eq('id', requisitionId);
    if (error) throw new Error(error.message);
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

export const saveSundayLockToSupabase = async (url: string, key: string, lock: any) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const lockData = {
        id: lock.id,
        date: lock.date,
        locked: lock.locked,
        locked_by: lock.lockedBy,
        locked_at: lock.lockedAt,
    };

    const { error } = await supabase.from('sunday_locks').upsert([lockData]);
    if (error) throw new Error(`Save Sunday lock failed: ${error.message}`);
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
export const deleteMemberFromSupabase = async (
    url: string,
    key: string,
    memberId: string
): Promise<{ success: true; mode: 'deleted' | 'deactivated' }> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const { error: pledgeDeleteError } = await supabase
        .from('harvest_pledges')
        .delete()
        .eq('member_id', memberId);

    if (pledgeDeleteError && pledgeDeleteError.code !== '42P01') {
        throw new Error(`Delete member failed while removing linked harvest pledges: ${pledgeDeleteError.message}`);
    }

    const { error: levyDeleteError } = await supabase
        .from('member_levies')
        .delete()
        .eq('member_id', memberId);

    if (levyDeleteError && levyDeleteError.code !== '42P01') {
        throw new Error(`Delete member failed while removing linked levies: ${levyDeleteError.message}`);
    }

    const { error } = await supabase.from('members').delete().eq('id', memberId);
    if (!error) return { success: true, mode: 'deleted' };

    const isFkConflict =
        error.code === '23503' ||
        /foreign key|constraint|still referenced|violates/i.test(`${error.message || ''} ${error.details || ''}`);

    if (!isFkConflict) {
        throw new Error(`Delete member failed: ${error.message}`);
    }

    const { error: deactivateError } = await supabase
        .from('members')
        .update({ active: false, last_updated: new Date().toISOString() })
        .eq('id', memberId);

    if (deactivateError) {
        throw new Error(
            `Delete member blocked by linked records, and fallback deactivation failed: ${deactivateError.message}`
        );
    }

    return { success: true, mode: 'deactivated' };
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

    const basePayload = {
        pledge_id: pledgeId,
        payment_date: paymentDate,
        amount: amount,
        paid_by: paidBy,
        created_at: new Date().toISOString()
    };

    let { error } = await supabase
        .from('harvest_pledge_payments')
        .insert([{ ...basePayload, entry_id: paymentEntryId }]);

    if (error && /entry_id/i.test(error.message) && /column/i.test(error.message)) {
        const retry = await supabase
            .from('harvest_pledge_payments')
            .insert([{ ...basePayload, payment_entry_id: paymentEntryId }]);
        error = retry.error;
    }

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
type AttendanceMemberRow = {
    id: string;
    class_number: string;
    attendance_date: string;
    service_type: 'sunday' | 'bible-study';
    member_id: string;
    member_name?: string;
    status: string;
};

type AttendanceSaveRow = {
    date: string;
    member_id: string;
    status: string;
    service_type?: 'sunday' | 'bible-study';
    class_number?: string;
};

export const loadAttendanceForDate = async (
    url: string,
    key: string,
    date: string,
    serviceType: 'sunday' | 'bible-study' = 'sunday'
) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('attendance')
        .select(`
            id,
            class_number,
            attendance_date,
            service_type,
            deleted,
            member_attendance (
                member_id,
                member_name,
                class_number,
                status
            )
        `)
        .eq('attendance_date', date)
        .eq('service_type', serviceType)
        .eq('deleted', false);
    if (error) {
        console.warn('Load attendance failed:', error.message);
        return [];
    }

    return (data || []).flatMap((session: any) =>
        (session.member_attendance || []).map((member: any) => ({
            id: session.id,
            class_number: member.class_number || session.class_number,
            attendance_date: session.attendance_date,
            service_type: session.service_type,
            member_id: member.member_id,
            member_name: member.member_name,
            status: member.status,
        }))
    ) as AttendanceMemberRow[];
};

export const saveAttendanceToSupabase = async (
    url: string,
    key: string,
    records: AttendanceSaveRow[]
) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    if (records.length === 0) return { success: true };

    const groupedRecords = records.reduce((groups, record) => {
        const attendanceDate = record.date;
        const classNumber = record.class_number?.trim();
        const serviceType = record.service_type || 'sunday';

        if (!attendanceDate || !classNumber) {
            throw new Error('Attendance records require date and class_number');
        }

        const groupKey = `${classNumber}::${attendanceDate}::${serviceType}`;
        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                attendanceDate,
                classNumber,
                serviceType,
                records: [] as AttendanceSaveRow[],
            });
        }

        groups.get(groupKey)!.records.push(record);
        return groups;
    }, new Map<string, { attendanceDate: string; classNumber: string; serviceType: 'sunday' | 'bible-study'; records: AttendanceSaveRow[] }>());

    for (const group of groupedRecords.values()) {
        const memberIds = group.records.map(record => record.member_id);
        const { data: members, error: membersError } = await supabase
            .from('members')
            .select('id, name, class_number')
            .in('id', memberIds);

        if (membersError) {
            throw new Error(`Load members for attendance failed: ${membersError.message}`);
        }

        const memberMap = new Map((members || []).map((member: any) => [member.id, member]));
        const presentCount = group.records.filter(record => record.status === 'present').length;
        const absentCount = group.records.filter(record => record.status === 'absent').length;

        const { data: attendanceSession, error: attendanceError } = await supabase
            .from('attendance')
            .upsert({
                class_number: group.classNumber,
                attendance_date: group.attendanceDate,
                service_type: group.serviceType,
                total_members_present: presentCount,
                total_members_absent: absentCount,
                deleted: false,
                last_updated: new Date().toISOString(),
            }, { onConflict: 'class_number,attendance_date,service_type' })
            .select('id, class_number, attendance_date, service_type')
            .single();

        if (attendanceError || !attendanceSession) {
            throw new Error(`Save attendance failed: ${attendanceError?.message || 'Unable to create attendance session'}`);
        }

        const { error: deleteError } = await supabase
            .from('member_attendance')
            .delete()
            .eq('attendance_id', attendanceSession.id);

        if (deleteError) {
            throw new Error(`Clear existing attendance details failed: ${deleteError.message}`);
        }

        const memberAttendanceRows = group.records.map(record => {
            const member = memberMap.get(record.member_id);
            return {
                attendance_id: attendanceSession.id,
                member_id: record.member_id,
                member_name: member?.name || 'Unknown Member',
                class_number: record.class_number || member?.class_number || group.classNumber,
                status: record.status,
                last_updated: new Date().toISOString(),
            };
        });

        const { error: detailError } = await supabase
            .from('member_attendance')
            .insert(memberAttendanceRows);

        if (detailError) {
            throw new Error(`Save member attendance failed: ${detailError.message}`);
        }
    }

    return { success: true };
};

export const loadAttendanceReport = async (url: string, key: string, startDate: string, endDate: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('attendance')
        .select(`
            id,
            class_number,
            attendance_date,
            service_type,
            deleted,
            member_attendance (
                member_id,
                member_name,
                class_number,
                status
            )
        `)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .eq('deleted', false)
        .order('attendance_date', { ascending: false });
    if (error) {
        console.warn('Load attendance report failed:', error.message);
        return [];
    }

    return (data || []).flatMap((session: any) =>
        (session.member_attendance || []).map((member: any) => ({
            id: session.id,
            class_number: member.class_number || session.class_number,
            attendance_date: session.attendance_date,
            service_type: session.service_type,
            member_id: member.member_id,
            member_name: member.member_name,
            status: member.status,
        }))
    ) as AttendanceMemberRow[];
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

// Class Leader Management
export const saveClassLeaderToSupabase = async (url: string, key: string, leader: any) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    
    const leaderData = {
        id: leader.id,
        username: leader.username,
        password: leader.password,
        class_number: leader.classNumber,
        access_code: leader.accessCode,
        full_name: leader.fullName,
        phone: leader.phone,
        email: leader.email,
        active: leader.active,
        created_by: leader.createdBy,
        updated_by: leader.updatedBy,
        last_updated: leader.lastUpdated,
    };
    
    const { error } = await supabase
        .from('class_leaders')
        .upsert([leaderData]);
    
    if (error) throw new Error(`Save class leader failed: ${error.message}`);
    return { success: true };
};

export const deleteClassLeaderFromSupabase = async (url: string, key: string, leaderId: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    
    const { error } = await supabase
        .from('class_leaders')
        .delete()
        .eq('id', leaderId);
    
    if (error) throw new Error(`Delete class leader failed: ${error.message}`);
    return { success: true };
};

// Entry Deletion Logging
export const logEntryDeletionToSupabase = async (
    url: string,
    key: string,
    entry: any,
    deletedBy: string,
    reason?: string
) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const normalizedMemberId = entry?.memberID && UUID_REGEX.test(entry.memberID) ? entry.memberID : null;
    const normalizedReason = (reason || '').trim() || 'No reason provided';
    const normalizedDeletedBy = (deletedBy || '').trim() || 'Unknown';

    // Primary audit table used by the SQL migration/docs.
    const auditLogEntry = {
        entry_id: entry.id,
        entry_type: entry.type,
        member_id: normalizedMemberId,
        member_name: entry.memberName || null,
        amount: entry.type === 'count' ? null : entry.amount,
        original_date: entry.date,
        deletion_reason: normalizedReason,
        deleted_by: normalizedDeletedBy,
        deleted_at: new Date().toISOString(),
        original_entry_data: entry,
    };

    const { error: auditError } = await supabase
        .from('entry_deletions')
        .insert([auditLogEntry]);

    if (!auditError) return { success: true };

    // Backward compatibility fallback for deployments still using `deletion_log`.
    const legacyLogEntry = {
        entry_id: entry.id,
        entry_type: entry.type,
        member_id: normalizedMemberId,
        member_name: entry.memberName || null,
        amount: entry.type === 'count' ? null : entry.amount,
        count_value: entry.type === 'count' ? entry.amount : null,
        fund: entry.fund,
        method: entry.method,
        date: entry.date,
        note: entry.note,
        deleted_by: normalizedDeletedBy,
        deleted_at: new Date().toISOString(),
        deletion_reason: normalizedReason,
    };

    const { error: legacyError } = await supabase
        .from('deletion_log')
        .insert([legacyLogEntry]);

    if (legacyError) {
        throw new Error(`Log entry deletion failed: ${legacyError.message}`);
    }
    return { success: true };
};

export const markEntryAsDeletedInSupabase = async (
    url: string,
    key: string,
    entryId: string,
    deletedBy?: string,
    deleteReason?: string
) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const updates: any = {
        deleted: true,
        deleted_at: new Date().toISOString(),
    };

    if (deletedBy) updates.deleted_by = deletedBy;
    if (deleteReason) updates.deleted_reason = deleteReason;

    const { error } = await supabase
        .from('entries')
        .update(updates)
        .eq('id', entryId);
    
    if (error) throw new Error(`Mark entry as deleted failed: ${error.message}`);
    return { success: true };
};

// Weekly History Management
export const saveWeeklyHistoryToSupabase = async (url: string, key: string, record: any) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    
    const { error } = await supabase
        .from('weekly_history')
        .upsert([mapHistoryToDB(record)]);
    
    if (error) throw new Error(`Save weekly history failed: ${error.message}`);
    return { success: true };
};

export const deleteWeeklyHistoryFromSupabase = async (url: string, key: string, historyId: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    
    const { error } = await supabase
        .from('weekly_history')
        .delete()
        .eq('id', historyId);
    
    if (error) throw new Error(`Delete weekly history failed: ${error.message}`);
    return { success: true };
};
