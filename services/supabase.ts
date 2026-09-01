
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Member, Entry, WeeklyHistoryRecord, User, DevelopmentFundEntry, MonthLock, WesleyHallReceipt, ParkingReceipt, ETransfer, Requisition, RequisitionItem, RequisitionApproval, Settings, OrganizationFundOrganization, OrganizationFundTransaction } from '../types';

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

const tenantGatewayRequest = async (url: string, payload: Record<string, unknown>) => {
    const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('gmct-tenant-session') : null;
    if (!token) throw new Error('Your society session has expired. Please sign in again.');
    const response = await fetch(`${url}/functions/v1/tenant-gateway/tenant-data`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Tenant data request failed.');
    return result.data;
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

const PAGE_SIZE = 1000;

const fetchAllRows = async (
    supabase: SupabaseClient,
    table: string,
    orderColumn?: string,
    ascending: boolean = true,
    societyId?: string
) => {
    const allRows: any[] = [];
    let from = 0;

    while (true) {
        let query = supabase.from(table).select('*');
        if (societyId) {
            if (societyId.toLowerCase() === 'gmct') {
                query = query.or('society_id.eq.gmct,society_id.is.null');
            } else {
                query = query.eq('society_id', societyId);
            }
        }
        query = query.range(from, from + PAGE_SIZE - 1);
        if (orderColumn) {
            query = query.order(orderColumn, { ascending });
        }
        const { data, error } = await query;
        if (error) {
            // If society_id column does not exist on table, fallback to standard query
            if (societyId && (error.message?.includes('society_id') || error.code === '42703')) {
                let fallback = supabase.from(table).select('*').range(from, from + PAGE_SIZE - 1);
                if (orderColumn) fallback = fallback.order(orderColumn, { ascending });
                const { data: fbData, error: fbErr } = await fallback;
                if (fbErr) throw fbErr;
                const rows = fbData || [];
                allRows.push(...rows);
                if (rows.length < PAGE_SIZE) break;
                from += PAGE_SIZE;
                continue;
            }
            throw error;
        }

        const rows = data || [];
        allRows.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return allRows;
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
    created_at: m.createdAt || new Date().toISOString(), // Ensure never empty
    society_id: m.societyId || 'gmct'
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
        createdAt: m.created_at,
        societyId: m.society_id || 'gmct'
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
    created_at: e.createdAt || new Date().toISOString(),
    society_id: e.societyId || 'gmct'
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
    createdAt: e.created_at,
    societyId: e.society_id || 'gmct'
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

const normalizeUserRoleFromDB = (raw: any): UserRole => {
    const role = String(raw || '').trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
    if (role === 'software-admin' || role === 'softwareadmin') return 'software-admin';
    if (role === 'admin' || role === 'administrator') return 'admin';
    if (role === 'finance-team' || role === 'financeteam' || role === 'finance') return 'finance-team';
    if (role === 'finance-chair' || role === 'financechair') return 'finance-chair';
    if (role === 'data-entry' || role === 'dataentry' || role === 'data-entry-team') return 'data-entry';
    if (role === 'pastor') return 'pastor';
    if (role === 'statistician' || role === 'statistics') return 'statistician';
    if (role === 'class-leader' || role === 'classleader' || role === 'class-lead') return 'class-leader';
    return 'admin';
};

const mapUserToDB = (u: User) => ({
    username: u.username,
    password: u.password,
    role: u.role,
    class_led: u.classLed,
    society_id: u.societyId || 'gmct'
});

const mapUserFromDB = (u: any): User => ({
    username: u.username,
    password: u.password,
    role: normalizeUserRoleFromDB(u.role),
    classLed: u.class_led,
    societyId: u.society_id || 'gmct'
});

const mapHistoryToDB = (h: WeeklyHistoryRecord) => ({
    id: h.id,
    date_of_service: h.dateOfService,
    society_name: h.societyName,
    data: h,
    society_id: h.societyId || 'gmct'
});

const mapHistoryFromDB = (h: any): WeeklyHistoryRecord => {
    if (h.data && typeof h.data === 'object') {
        return { ...h.data, id: h.id, dateOfService: h.date_of_service, societyName: h.society_name, societyId: h.society_id || h.data.societyId || 'gmct' };
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

const parseJsonText = <T>(value: any, fallback: T): T => {
    if (value == null || value === '') return fallback;
    if (typeof value === 'object') return value as T;
    if (typeof value !== 'string') return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
};

const mapSettingsToDB = (s: Settings) => ({
    id: 'app_settings', // Single row for app-wide settings
    currency: s.currency,
    max_classes: s.maxClasses,
    enforce_directory: s.enforceDirectory,
    supabase_url: s.supabaseUrl,
    supabase_key: s.supabaseKey,
    wesley_hall_monthly_target: s.wesleyHallMonthlyTarget ?? 2500,
    parking_monthly_target: s.parkingMonthlyTarget ?? 2500,
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
    requisition_approval_limits: (s as any).requisitionApprovalLimits ? JSON.stringify((s as any).requisitionApprovalLimits) : null,
    requisition_pastor_limits: (s as any).requisitionPastorLimits ? JSON.stringify((s as any).requisitionPastorLimits) : null,
    requisition_finance_approvers: (s as any).requisitionFinanceApprovers ? JSON.stringify((s as any).requisitionFinanceApprovers) : null,
    class_access_codes: s.classAccessCodes ? JSON.stringify(s.classAccessCodes) : null,
});

const mapSettingsFromDB = (s: any): Settings => {
    const requisitionApprovalLimits = parseJsonText(s.requisition_approval_limits, undefined as any);
    const requisitionPastorLimits = parseJsonText(s.requisition_pastor_limits, [] as any[]);
    const requisitionFinanceApprovers = parseJsonText(s.requisition_finance_approvers, [] as string[]);

    return ({
        currency: s.currency || 'GH₵',
        maxClasses: s.max_classes || 14,
        enforceDirectory: s.enforce_directory !== false,
        supabaseUrl: s.supabase_url || '',
        supabaseKey: s.supabase_key || '',
        wesleyHallMonthlyTarget: s.wesley_hall_monthly_target ?? 2500,
        parkingMonthlyTarget: s.parking_monthly_target ?? 2500,
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
        requisitionApprovalLimits,
        requisitionPastorLimits,
        requisitionFinanceApprovers,
        classAccessCodes: parseJsonText(s.class_access_codes, undefined as any),
    } as Settings);
};

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

export const downloadDataFromSupabase = async (url: string, key: string, societyId?: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");

    const usesTenantGateway = !!societyId && societyId.toLowerCase() !== 'gmct';
    let members: Member[] = [];
    if (usesTenantGateway) {
        const membersDB = await tenantGatewayRequest(url, { resource: 'members', operation: 'list' });
        members = (membersDB || []).map(mapMemberFromDB);
    } else {
        let memQuery = supabase.from('members').select('*');
        if (societyId) {
        if (societyId.toLowerCase() === 'gmct') {
            memQuery = memQuery.or('society_id.eq.gmct,society_id.is.null');
        } else {
            memQuery = memQuery.eq('society_id', societyId);
        }
        }
        const { data: membersDB, error: memErr } = await memQuery;
        if (memErr) throw new Error(`Fetch Members failed: ${memErr.message}`);
        members = membersDB?.map(mapMemberFromDB) || [];
    }

    let entriesDB: any[] = [];
    try {
        entriesDB = usesTenantGateway
            ? await tenantGatewayRequest(url, { resource: 'entries', operation: 'list' })
            : await fetchAllRows(supabase, 'entries', 'date', false, societyId);
    } catch (entErr: any) {
        throw new Error(`Fetch Entries failed: ${entErr.message}`);
    }
    const entries = entriesDB?.map(mapEntryFromDB) || [];

    let userQuery = supabase.from('app_users').select('*');
    if (societyId) {
        if (societyId.toLowerCase() === 'gmct') {
            userQuery = userQuery.or('society_id.eq.gmct,society_id.is.null');
        } else {
            userQuery = userQuery.eq('society_id', societyId);
        }
    }
    const { data: usersDB, error: userErr } = await userQuery;
    if (userErr && !(userErr.message?.includes('society_id') || (userErr as any).code === '42703')) {
        throw new Error(`Fetch Users failed: ${userErr.message}`);
    }
    const users = usersDB?.map(mapUserFromDB) || [];

    let history: WeeklyHistoryRecord[] = [];
    if (usesTenantGateway) {
        const historyDB = await tenantGatewayRequest(url, { resource: 'weekly_history', operation: 'list' });
        history = (historyDB || []).map(mapHistoryFromDB);
    } else {
        let histQuery = supabase.from('weekly_history').select('*');
        if (societyId) {
            histQuery = histQuery.or('society_id.eq.gmct,society_id.is.null');
        }
        const { data: historyDB, error: histErr } = await histQuery;
        if (histErr) throw new Error(`Fetch History failed: ${histErr.message}`);
        history = historyDB?.map(mapHistoryFromDB) || [];
    }
    
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
    requester_username: r.requesterUsername,
    requester_name: (r as any).requesterName || r.requesterUsername || null,
    date_created: (r as any).dateCreated || null,
    title: r.title,
    purpose: r.purpose,
    payable_to: (r as any).payableTo || null,
    organization_committee: (r as any).organizationCommittee || null,
    intended_for: (r as any).intendedFor || (r as any).requiredApproverUsername || null,
    purchase_type: (r as any).purchaseType || null,
    fund: r.fund,
    needed_by: r.neededBy || null,
    total_amount: r.totalAmount,
    status: r.status,
    source_type: (r as any).sourceType || null,
    required_approver_role: (r as any).requiredApproverRole || null,
    required_approver_username: (r as any).requiredApproverUsername || null,
    completion_attachment_url: (r as any).completionAttachmentUrl || null,
    completion_attachment_at: (r as any).completionAttachmentAt || null,
    uploaded_pdf: (r as any).uploadedPdf || null,
    receipt_attachment: (r as any).receiptAttachments || null,
    requisition_number: (r as any).requisitionNumber || null,
    updated_by: r.updatedBy || null,
    last_updated: r.lastUpdated || null,
});

const mapRequisitionFromDB = (r: any): Requisition => ({
    id: r.id,
    requesterUsername: r.requester_username,
    requesterName: r.requester_name || r.requester_username || undefined,
    dateCreated: r.date_created || undefined,
    title: r.title,
    purpose: r.purpose || undefined,
    payableTo: r.payable_to || undefined,
    organizationCommittee: r.organization_committee || undefined,
    intendedFor: r.intended_for || r.required_approver_username || undefined,
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
    uploadedPdf: parseJsonText(r.uploaded_pdf, undefined as any),
    receiptAttachments: parseJsonText(r.receipt_attachment, undefined as any),
    requisitionNumber: r.requisition_number || undefined,
    createdAt: r.created_at || undefined,
    updatedBy: r.updated_by || undefined,
    lastUpdated: r.last_updated || undefined,
} as Requisition);

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
    approver_role: (a as any).approverRole || null,
    decision: a.decision,
    note: a.note || null,
    signature_name: (a as any).signatureName || null,
    signature_at: (a as any).signatureAt || null,
    decided_at: a.decidedAt || null,
});

const mapApprovalFromDB = (a: any): RequisitionApproval => ({
    id: a.id,
    requisitionId: a.requisition_id,
    approverUsername: a.approver_username,
    approverRole: a.approver_role || undefined,
    decision: a.decision,
    note: a.note || undefined,
    signatureName: a.signature_name || undefined,
    signatureAt: a.signature_at || undefined,
    decidedAt: a.decided_at || undefined,
} as RequisitionApproval);

const mapApprovalToLegacyDB = (a: RequisitionApproval) => ({
    id: a.id,
    requisition_id: a.requisitionId,
    approver_username: a.approverUsername,
    decision: a.decision,
    note: a.note || null,
    decided_at: a.decidedAt || null,
});

const isMissingApprovalColumnError = (error: any) => {
    const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
    return /schema cache|column|could not find/i.test(text) && /approver_role|signature_name|signature_at/i.test(text);
};

// --- Organization Funds ---
const mapOrganizationFundOrganizationFromDB = (row: any): OrganizationFundOrganization => ({
    id: row.id,
    name: row.name,
    isActive: !!row.is_active,
    createdBy: row.created_by || undefined,
    updatedBy: row.updated_by || undefined,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
});

const mapOrganizationFundOrganizationToDB = (org: OrganizationFundOrganization) => ({
    id: org.id,
    name: org.name,
    is_active: org.isActive,
    created_by: org.createdBy || null,
    updated_by: org.updatedBy || null,
    created_at: org.createdAt || new Date().toISOString(),
    updated_at: org.updatedAt || new Date().toISOString(),
});

const mapOrganizationFundTransactionFromDB = (row: any): OrganizationFundTransaction => ({
    id: row.id,
    organizationId: row.organization_id,
    organizationNameSnapshot: row.organization_name_snapshot,
    type: row.tx_type,
    status: row.status,
    amount: parseFloat(row.amount || 0),
    date: row.tx_date,
    submittedBy: row.submitted_by,
    enteredBy: row.entered_by,
    note: row.note || undefined,
    approvedBy: row.approved_by || undefined,
    approverSignatureName: row.approver_signature_name || undefined,
    approvedAt: row.approved_at || undefined,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
});

const mapOrganizationFundTransactionToDB = (tx: OrganizationFundTransaction) => ({
    id: tx.id,
    organization_id: tx.organizationId,
    organization_name_snapshot: tx.organizationNameSnapshot,
    tx_type: tx.type,
    status: tx.status,
    amount: tx.amount,
    tx_date: tx.date,
    submitted_by: tx.submittedBy,
    entered_by: tx.enteredBy,
    note: tx.note || null,
    approved_by: tx.approvedBy || null,
    approver_signature_name: tx.approverSignatureName || null,
    approved_at: tx.approvedAt || null,
    created_at: tx.createdAt || new Date().toISOString(),
    updated_at: tx.updatedAt || new Date().toISOString(),
});

export const loadOrganizationFundOrganizations = async (url: string, key: string, includeInactive = false): Promise<OrganizationFundOrganization[]> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];

    let query = supabase
        .from('organization_funds_organizations')
        .select('*')
        .order('name', { ascending: true });

    if (!includeInactive) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) {
        console.warn('Failed to load organization funds organizations:', error.message);
        return [];
    }

    return (data || []).map(mapOrganizationFundOrganizationFromDB);
};

export const saveOrganizationFundOrganization = async (url: string, key: string, org: OrganizationFundOrganization) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const { error } = await supabase
        .from('organization_funds_organizations')
        .upsert([mapOrganizationFundOrganizationToDB(org)]);

    if (error) throw new Error(`Save organization failed: ${error.message}`);
    return { success: true };
};

export const setOrganizationFundOrganizationActive = async (
    url: string,
    key: string,
    organizationId: string,
    isActive: boolean,
    updatedBy?: string
) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const { error } = await supabase
        .from('organization_funds_organizations')
        .update({
            is_active: isActive,
            updated_by: updatedBy || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', organizationId);

    if (error) throw new Error(`Update organization active state failed: ${error.message}`);
    return { success: true };
};

export const loadOrganizationFundTransactions = async (url: string, key: string): Promise<OrganizationFundTransaction[]> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('organization_funds_transactions')
        .select('*')
        .order('tx_date', { ascending: false });

    if (error) {
        console.warn('Failed to load organization funds transactions:', error.message);
        return [];
    }

    return (data || []).map(mapOrganizationFundTransactionFromDB);
};

export const saveOrganizationFundTransaction = async (url: string, key: string, tx: OrganizationFundTransaction) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const { error } = await supabase
        .from('organization_funds_transactions')
        .upsert([mapOrganizationFundTransactionToDB(tx)]);

    if (error) throw new Error(`Save organization funds transaction failed: ${error.message}`);
    return { success: true };
};

export const deleteOrganizationFundTransaction = async (url: string, key: string, transactionId: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const { error } = await supabase
        .from('organization_funds_transactions')
        .delete()
        .eq('id', transactionId);

    if (error) throw new Error(`Delete organization funds transaction failed: ${error.message}`);
    return { success: true };
};

export const loadRequisitions = async (url: string, key: string, societyId?: string): Promise<Requisition[]> => {
    if (societyId && societyId.toLowerCase() !== 'gmct') {
        try {
            const data = await tenantGatewayRequest(url, { resource: 'requisitions', operation: 'list' });
            return (data || []).map(mapRequisitionFromDB);
        } catch (error: any) {
            console.warn('Failed to load tenant requisitions:', error.message || error);
            return [];
        }
    }
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    let query = supabase.from('requisitions').select('*');
    if (societyId) {
        if (societyId.toLowerCase() === 'gmct') {
            query = query.or('society_id.eq.gmct,society_id.is.null');
        } else {
            query = query.eq('society_id', societyId);
        }
    }
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
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

        const { data: approvalsData } = await supabase
            .from('requisition_approvals')
            .select('*')
            .in('requisition_id', ids)
            .order('decided_at', { ascending: false });
        const approvals = (approvalsData || []).map(mapApprovalFromDB);
        const approvalsByReq: Record<string, RequisitionApproval[]> = {};
        approvals.forEach(a => { (approvalsByReq[a.requisitionId] ||= []).push(a); });
        reqs.forEach(r => { (r as any).approvals = approvalsByReq[r.id] || []; });
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

export const decideRequisition = async (url: string, key: string, approval: RequisitionApproval, newStatus: 'approved' | 'rejected') => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const { error: insErr } = await supabase.from('requisition_approvals').insert([mapApprovalToDB(approval)]);
    if (insErr) {
        if (!isMissingApprovalColumnError(insErr)) throw new Error(insErr.message);
        const { error: legacyInsErr } = await supabase.from('requisition_approvals').insert([mapApprovalToLegacyDB(approval)]);
        if (legacyInsErr) throw new Error(legacyInsErr.message);
    }

    const { data, error: updErr } = await supabase
        .from('requisitions')
        .update({ status: newStatus, last_updated: new Date().toISOString() })
        .eq('id', approval.requisitionId)
        .select('id')
        .maybeSingle();
    if (updErr) throw new Error(updErr.message);
    if (!data) throw new Error('The requisition status was not updated. It may have been changed, deleted, or blocked by database permissions.');
};

// --- Individual Entry Operations (for multi-user real-time collaboration) ---
export const saveEntryToSupabase = async (url: string, key: string, entry: Entry) => {
    if (entry.societyId && entry.societyId.toLowerCase() !== 'gmct') {
        await tenantGatewayRequest(url, { resource: 'entries', operation: 'upsert', record: mapEntryToDB(entry) });
        return { success: true };
    }
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

export const checkEntryDuplicateInSupabase = async (url: string, key: string, entry: Entry): Promise<boolean> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return false;
    if (!entry.memberID || !entry.date || !entry.type) return false;

    const { data, error } = await supabase
        .from('entries')
        .select('id')
        .eq('member_id', entry.memberID)
        .eq('date', entry.date)
        .eq('type', entry.type)
        .or('deleted.is.null,deleted.eq.false')
        .limit(1);

    if (error) {
        console.warn('Duplicate check failed:', error.message);
        return false;
    }

    if (!data || data.length === 0) return false;
    return data.some((row: any) => row.id !== entry.id);
};

export const markEntryAsDeletedInSupabase = async (
    url: string,
    key: string,
    entryId: string,
    deletedBy: string,
    deletedReason: string
) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const { error } = await supabase
        .from('entries')
        .update({
            deleted: true,
            deleted_by: deletedBy || 'Unknown',
            deleted_reason: deletedReason || null,
            deleted_at: new Date().toISOString(),
            updated_by: deletedBy || 'Unknown',
            last_updated: new Date().toISOString(),
        })
        .eq('id', entryId);

    if (error) throw new Error(`Mark entry as deleted failed: ${error.message}`);
    return { success: true };
};

export const logEntryDeletionToSupabase = async (
    url: string,
    key: string,
    entry: Entry,
    deletedBy: string,
    deletionReason: string
) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const payload = {
        entry_id: entry.id,
        entry_type: entry.type,
        member_id: entry.memberID || null,
        member_name: entry.memberName || null,
        amount: entry.amount ?? null,
        original_date: entry.date || null,
        deletion_reason: deletionReason || 'No reason provided',
        deleted_by: deletedBy || 'Unknown',
        deleted_at: new Date().toISOString(),
        original_entry_data: entry,
    };

    const { error } = await supabase.from('entry_deletions').insert([payload]);
    if (error) throw new Error(`Log entry deletion failed: ${error.message}`);
    return { success: true };
};

export const deleteEntryFromSupabase = async (url: string, key: string, entryId: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error("Invalid Supabase configuration");
    
    const { error } = await supabase.from('entries').delete().eq('id', entryId);
    if (error) throw new Error(`Delete entry failed: ${error.message}`);
    return { success: true };
};

export const loadEntriesFromSupabase = async (url: string, key: string, societyId?: string): Promise<Entry[]> => {
    if (societyId && societyId.toLowerCase() !== 'gmct') {
        try {
            const data = await tenantGatewayRequest(url, { resource: 'entries', operation: 'list' });
            return (data || []).map(mapEntryFromDB);
        } catch (error: any) {
            console.warn('Failed to load tenant entries:', error.message || error);
            return [];
        }
    }
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    try {
        const data = await fetchAllRows(supabase, 'entries', 'date', false, societyId);
        return (data || []).map(mapEntryFromDB);
    } catch (error: any) {
        console.warn('Failed to load entries:', error.message || error);
        return [];
    }
};

export const loadMembersFromSupabase = async (url: string, key: string, societyId?: string): Promise<Member[]> => {
    if (societyId && societyId.toLowerCase() !== 'gmct') {
        try {
            const data = await tenantGatewayRequest(url, { resource: 'members', operation: 'list' });
            return (data || []).map(mapMemberFromDB);
        } catch (error: any) {
            console.warn('Failed to load tenant members:', error.message || error);
            return [];
        }
    }
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    try {
        let query = supabase.from('members').select('*');
        if (societyId) {
            if (societyId.toLowerCase() === 'gmct') {
                query = query.or('society_id.eq.gmct,society_id.is.null');
            } else {
                query = query.eq('society_id', societyId);
            }
        }
        query = query.order('name', { ascending: true });
        const { data, error } = await query;
        if (error) {
            if (societyId && (error.message?.includes('society_id') || (error as any).code === '42703')) {
                const { data: fbData } = await supabase.from('members').select('*').order('name', { ascending: true });
                return (fbData || []).map(mapMemberFromDB);
            }
            console.warn('Failed to load members:', error.message);
            return [];
        }
        return (data || []).map(mapMemberFromDB);
    } catch (error: any) {
        console.warn('Failed to load members:', error.message || error);
        return [];
    }
};

export const saveMemberToSupabase = async (url: string, key: string, member: Member) => {
    if (member.societyId && member.societyId.toLowerCase() !== 'gmct') {
        const data = await tenantGatewayRequest(url, { resource: 'members', operation: 'upsert', record: mapMemberToDB(member) });
        return { success: true, member: mapMemberFromDB(data) } as { success: true; member: Member };
    }
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
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const { error } = await supabase.from('sunday_locks').upsert([{
        date: lock.date,
        is_locked: !!lock.isLocked,
        locked_by: lock.lockedBy || null,
        locked_at: lock.lockedAt || new Date().toISOString(),
    }]);

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

export const submitRequisition = async (
    url: string,
    key: string,
    id: string,
    approverRole?: string,
    approverUsername?: string,
    requisitionNumber?: string
) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const updatePayload: any = {
        status: 'submitted',
        last_updated: new Date().toISOString(),
    };
    if (approverRole) updatePayload.required_approver_role = approverRole;
    if (approverUsername) updatePayload.required_approver_username = approverUsername;
    if (requisitionNumber) updatePayload.requisition_number = requisitionNumber;

    const { error } = await supabase.from('requisitions').update(updatePayload).eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
};

export const deleteRequisition = async (url: string, key: string, requisitionId: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const { error: itemErr } = await supabase.from('requisition_items').delete().eq('requisition_id', requisitionId);
    if (itemErr) throw new Error(itemErr.message);

    const { error } = await supabase.from('requisitions').delete().eq('id', requisitionId);
    if (error) throw new Error(error.message);
    return { success: true };
};

export const uploadRequisitionAttachment = async (
    url: string,
    key: string,
    requisitionId: string,
    file: File
): Promise<string> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${requisitionId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
        .from('requisition-attachments')
        .upload(path, file, { upsert: true });

    if (uploadError) throw new Error(`Attachment upload failed: ${uploadError.message}`);

    const { data } = supabase.storage.from('requisition-attachments').getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('Unable to resolve attachment public URL');
    return data.publicUrl;
};

export const saveRequisitionAttachment = async (
    url: string,
    key: string,
    requisitionId: string,
    attachmentUrl: string
) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const { error } = await supabase
        .from('requisitions')
        .update({ completion_attachment_url: attachmentUrl, completion_attachment_at: new Date().toISOString() })
        .eq('id', requisitionId);

    if (error) throw new Error(error.message);
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
    created_at: p.createdAt || new Date().toISOString(),
    society_id: p.societyId || 'gmct'
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
    createdAt: p.created_at,
    societyId: p.society_id || 'gmct'
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
export const loadHarvestPledgesFromSupabase = async (url: string, key: string, societyId?: string): Promise<HarvestPledge[]> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];

    let query = supabase.from('harvest_pledges').select('*');
    if (societyId) {
        if (societyId.toLowerCase() === 'gmct') {
            query = query.or('society_id.eq.gmct,society_id.is.null');
        } else {
            query = query.eq('society_id', societyId);
        }
    }
    query = query.order('date', { ascending: false });
    const { data, error } = await query;
    
    if (error) {
        if (societyId && (error.message?.includes('society_id') || (error as any).code === '42703')) {
            const { data: fbData } = await supabase.from('harvest_pledges').select('*').order('date', { ascending: false });
            return (fbData || []).map(mapHarvestPledgeFromDB);
        }
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
    notes: r.notes ?? null,
    created_by: r.createdBy ?? null,
    updated_by: r.updatedBy ?? null,
    last_updated: toTimestamp(r.lastUpdated),
    deleted: r.deleted ?? false,
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

export const updateWesleyHallReceipt = async (url: string, key: string, receipt: WesleyHallReceipt) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase
        .from('wesley_hall_receipts')
        .update({
            date: receipt.date,
            amount: receipt.amount,
            notes: receipt.notes ?? null,
            updated_by: receipt.updatedBy ?? null,
            last_updated: toTimestamp(receipt.lastUpdated),
            deleted: receipt.deleted ?? false,
        })
        .eq('id', receipt.id);
    if (error) throw new Error(`Update Wesley Hall receipt failed: ${error.message}`);
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

// --- Parking Receipts ---

const mapParkingToDB = (r: ParkingReceipt) => ({
    id: r.id,
    date: r.date,
    amount: r.amount,
    notes: r.notes ?? null,
    created_by: r.createdBy ?? null,
    updated_by: r.updatedBy ?? null,
    last_updated: toTimestamp(r.lastUpdated),
    deleted: r.deleted ?? false,
    created_at: r.createdAt || new Date().toISOString(),
});

const mapParkingFromDB = (r: any): ParkingReceipt => ({
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

export const loadParkingReceipts = async (url: string, key: string): Promise<ParkingReceipt[]> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('parking_receipts')
        .select('*')
        .order('date', { ascending: false });
    if (error) {
        console.warn('Load parking receipts failed:', error.message);
        return [];
    }
    return (data || []).map(mapParkingFromDB);
};

export const saveParkingReceipt = async (url: string, key: string, receipt: ParkingReceipt) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase
        .from('parking_receipts')
        .upsert([mapParkingToDB(receipt)]);
    if (error) throw new Error(`Save parking receipt failed: ${error.message}`);
    return { success: true };
};

export const loadSocietiesFromSupabase = async (url: string, key: string): Promise<Society[]> => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) return [];
    try {
        const { data, error } = await supabase.from('societies').select('*').order('is_primary', { ascending: false });
        if (error) {
            console.warn('Load societies failed:', error.message);
            return [];
        }
        return (data || []).map(s => ({
            id: s.id,
            name: s.name,
            shortName: s.short_name || s.name,
            societyCode: s.code,
            city: s.city,
            province: s.province,
            provinceCode: s.province_code,
            isPrimary: s.is_primary,
            address: s.address,
            phone: s.phone,
            email: s.email,
            charityNumber: s.charity_number,
            signatureImage: s.signature_image,
            logoUrl: s.logo_url,
            features: s.features || {},
            accentColor: s.accent_color || 'indigo',
            status: s.status || 'active',
            archivedAt: s.archived_at || undefined,
        }));
    } catch (e: any) {
        console.warn('Load societies error:', e.message || e);
        return [];
    }
};

export const saveSocietyFeaturesToSupabase = async (url: string, key: string, societyId: string, features: SocietyFeatures) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase
        .from('societies')
        .update({ features })
        .eq('id', societyId);
    if (error) throw new Error(`Save society features failed: ${error.message}`);
    return { success: true };
};

export const createSocietyInSupabase = async (url: string, key: string, society: Society) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase.from('societies').insert([{
        id: society.id,
        code: society.societyCode,
        name: society.name,
        short_name: society.shortName,
        city: society.city,
        province: society.province,
        province_code: society.provinceCode,
        is_primary: false,
        address: society.address || null,
        phone: society.phone || null,
        email: society.email || null,
        features: society.features,
        accent_color: society.accentColor || 'indigo',
    }]);
    if (error) throw new Error(`Create society failed: ${error.message}`);
    return { success: true };
};

export const updateParkingReceipt = async (url: string, key: string, receipt: ParkingReceipt) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase
        .from('parking_receipts')
        .update({
            date: receipt.date,
            amount: receipt.amount,
            notes: receipt.notes ?? null,
            updated_by: receipt.updatedBy ?? null,
            last_updated: toTimestamp(receipt.lastUpdated),
            deleted: receipt.deleted ?? false,
        })
        .eq('id', receipt.id);
    if (error) throw new Error(`Update parking receipt failed: ${error.message}`);
    return { success: true };
};

export const deleteParkingReceipt = async (url: string, key: string, id: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');
    const { error } = await supabase
        .from('parking_receipts')
        .delete()
        .eq('id', id);
    if (error) throw new Error(`Delete parking receipt failed: ${error.message}`);
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

export const saveWeeklyHistoryToSupabase = async (url: string, key: string, record: WeeklyHistoryRecord) => {
    if (record.societyId && record.societyId.toLowerCase() !== 'gmct') {
        await tenantGatewayRequest(url, { resource: 'weekly_history', operation: 'upsert', record: mapHistoryToDB(record) });
        return { success: true };
    }
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const { error } = await supabase.from('weekly_history').upsert([mapHistoryToDB(record)]);
    if (error) throw new Error(`Save weekly history failed: ${error.message}`);
    return { success: true };
};

export const deleteWeeklyHistoryFromSupabase = async (url: string, key: string, id: string, societyId?: string) => {
    if (societyId && societyId.toLowerCase() !== 'gmct') {
        await tenantGatewayRequest(url, { resource: 'weekly_history', operation: 'delete', recordId: id });
        return { success: true };
    }
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const { error } = await supabase.from('weekly_history').delete().eq('id', id);
    if (error) throw new Error(`Delete weekly history failed: ${error.message}`);
    return { success: true };
};

const mapClassLeaderToDB = (leader: any) => ({
    id: leader.id,
    username: leader.username,
    password: leader.password,
    class_number: leader.classNumber,
    access_code: leader.accessCode,
    full_name: leader.fullName || null,
    phone: leader.phone || null,
    email: leader.email || null,
    active: leader.active !== false,
    created_by: leader.createdBy || null,
    updated_by: leader.updatedBy || null,
    last_updated: leader.lastUpdated || new Date().toISOString(),
    created_at: leader.createdAt || new Date().toISOString(),
});

const mapClassLeaderFromDB = (leader: any) => ({
    id: leader.id,
    username: leader.username,
    password: leader.password,
    classNumber: leader.class_number,
    accessCode: leader.access_code,
    fullName: leader.full_name || undefined,
    phone: leader.phone || undefined,
    email: leader.email || undefined,
    active: leader.active !== false,
    createdBy: leader.created_by || undefined,
    updatedBy: leader.updated_by || undefined,
    lastUpdated: leader.last_updated || undefined,
    createdAt: leader.created_at || undefined,
});

export const saveClassLeaderToSupabase = async (url: string, key: string, leader: any) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const { error } = await supabase.from('class_leaders').upsert([mapClassLeaderToDB(leader)]);
    if (error) throw new Error(`Save class leader failed: ${error.message}`);
    return { success: true };
};

export const deleteClassLeaderFromSupabase = async (url: string, key: string, leaderId: string) => {
    const supabase = getSupabaseClient(url, key);
    if (!supabase) throw new Error('Invalid Supabase configuration');

    const { error } = await supabase.from('class_leaders').delete().eq('id', leaderId);
    if (error) throw new Error(`Delete class leader failed: ${error.message}`);
    return { success: true };
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
