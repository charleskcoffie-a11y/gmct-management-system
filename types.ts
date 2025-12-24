
export type EntryType = "tithe" | "offering" | "thanksgiving-offering" | "pledge" | "harvest-levy" | "harvest-pledge" | "harvest" | "kofi-and-ama" | "development-fund" | "other";
export type Method = "cash" | "check" | "card" | "e-transfer" | "mobile" | "other";

export interface Entry {
    id: string;
    date: string; // ISO format YYYY-MM-DD
    memberID: string;
    memberName: string;
    classNumber?: string; // Snapshot of class at time of entry
    type: EntryType;
    fund: string;
    method: Method;
    amount: number;
    note?: string;
    
    // Pledge-specific fields (only used when type="harvest-pledge")
    remaining?: number; // Unpaid balance for pledges
    groupName?: string; // Men, Women, Youth, Dayborn, Main
    
    // Audit Trail & Soft Delete
    createdBy?: string;
    updatedBy?: string;
    lastUpdated?: string; // ISO Timestamp
    deleted?: boolean;
    createdAt?: string; // ISO Timestamp (creation time)
}

export interface DevelopmentFundEntry {
    id: string;
    date: string;
    memberId: string;
    amount: number;
    description: string;
    createdBy?: string;
}

export interface HarvestEntry {
    id: string;
    date: string; // ISO format YYYY-MM-DD
    memberID: string;
    memberName: string;
    classNumber?: string;
    amount: number;
    note?: string;
    createdBy?: string;
    updatedBy?: string;
    lastUpdated?: string;
    deleted?: boolean;
    createdAt?: string;
}

export interface NoNameEntry {
    id: string;
    date: string; // ISO format YYYY-MM-DD
    amount: number;
    notes?: string;
    createdBy?: string;
    updatedAt?: string;
}

export interface Member {
    id: string; // Our app's UUID
    spId?: string; // Legacy SharePoint ID, kept for compatibility if needed
    name: string;
    classNumber?: string; // e.g. "1"
    memberNumber?: string; // e.g. "128"
    address?: string;
    email?: string;
    profession?: string; // e.g. "Retired" or free-text
    phone?: string;
    dobMonth?: number; // 1-12
    dobDay?: number;   // 1-31
    dateOfBirth?: string; // ISO date YYYY-MM-DD
    active?: boolean;
    createdAt?: string;
    devFundPledge?: boolean; // Has pledged to development fund
    devFundPledgeAmount?: number; // Amount pledged to development fund
}

export interface Settings {
    currency: string;
    maxClasses: number;
    enforceDirectory: boolean; // if true, member names must be selected from the directory
    supabaseUrl: string;
    supabaseKey: string;
    logoUrl?: string; // Base64 or URL for organization logo
    orgName?: string;
    orgAddress?: string;
    orgPhone?: string;
    orgEmail?: string;
    charityNumber?: string;
    signatureImage?: string; // Base64 or URL for authorized signature
    annualLevyAmount?: number; // Annual Harvest Levy applied per member each year
    // E-Transfer settings
    etransferNotificationEmail?: string; // mailbox that receives Interac notifications
    etransferInboundSecret?: string; // webhook secret to validate inbound provider
    etransferProvider?: 'sendgrid' | 'mailgun' | 'resend' | 'generic';
    // Class Leader Access Codes
    classAccessCodes?: Record<string, string>; // Map of class number to access code, e.g. {"1": "alpha", "2": "beta"}
}

export type UserRole = 'admin' | 'finance-chair' | 'finance-team' | 'data-entry' | 'pastor' | 'statistician' | 'class-leader';

export interface User {
    username: string;
    password?: string; // Should be hashed in a real app, but plain for this exercise
    role: UserRole;
    classLed?: string; // For class-leader role: which class they manage
    assignedClass?: string; // Alias for classLed (more semantic)
}

export type AttendanceStatus = 'present' | 'absent' | 'sick' | 'travel' | 'catechumen';

export interface MemberAttendance {
    memberId: string;
    status: AttendanceStatus;
}

export interface AttendanceRecord {
    date: string; // ISO format YYYY-MM-DD
    records: MemberAttendance[];
}

export interface VisitorRecord {
    name: string;
    from: string;
    position: string;
    reason: string;
}

export interface ServiceDonation {
    donor: string;
    amount: number;
    description: string;
}

export interface WeeklyHistoryRecord {
    id: string;
    dateOfService: string; // ISO format YYYY-MM-DD
    societyName: string;
    officiant: string;
    liturgist: string;
    serviceTypes: string[]; 
    serviceTypeOther: string;
    sermonTopic: string;
    worshipHighlights: string;
    announcementsBy: string;
    
    // Updated Attendance Breakdown
    attendance: {
        men: number;
        women: number;
        junior: number;
        children: number; // Added specific children category
        visitors: number;
        catechumens: number;
    };

    // New Structured Data
    visitorsList: VisitorRecord[];
    donationsList: ServiceDonation[];

    newMembersDetails: string;
    newMembersContact: string;
    events: string;
    observations: string;
    preparedBy: string;
}

export type Tab = 'home' | 'records' | 'development-fund' | 'harvest' | 'harvest-pledges' | 'no-name' | 'financial-control' | 'members' | 'insights' | 'reports' | 'history' | 'weekly-history' | 'upcoming-birthdays' | 'e-transfers' | 'requisitions' | 'my-approvals' | 'users' | 'settings' | 'utilities' | 'tax-receipts' | 'wesley-hall' | 'attendance' | 'assets' | 'asset-maintenance';

export type RequisitionStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'funded' | 'paid' | 'closed';
export type ApprovalDecision = 'approved' | 'rejected';

export interface RequisitionItem {
    id: string;
    requisitionId: string;
    description: string;
    qty: number;
    unitPrice: number;
    accountCode?: string;
}

export interface Requisition {
    id: string;
    requesterUsername: string;
    title: string;
    purpose?: string;
    fund?: string;
    neededBy?: string; // ISO date
    totalAmount: number;
    status: RequisitionStatus;
    createdAt?: string;
    updatedBy?: string;
    lastUpdated?: string;
    items?: RequisitionItem[];
}

export interface RequisitionApproval {
    id: string;
    requisitionId: string;
    approverUsername: string;
    decision: ApprovalDecision;
    note?: string;
    decidedAt?: string;
}

export interface RequisitionComment {
    id: string;
    requisitionId: string;
    authorUsername: string;
    body: string;
    createdAt?: string;
}

export interface ETransfer {
    id: string;
    receivedAt: string; // ISO timestamp
    amount: number;
    currency?: string;
    senderName?: string;
    senderEmail?: string;
    memo?: string;
    rawSubject?: string;
    rawText?: string;
    reconciled?: boolean;
    createdAt?: string;
}

export interface CloudState {
  ready: boolean;
  message: string;
  signedIn?: boolean;
  accessToken?: string;
  account?: any;
}

export type SyncState = 'offline' | 'syncing' | 'synced' | 'error';

export interface SyncStatus {
    state: SyncState;
    lastSynced?: Date;
    errorMessage?: string;
}

export interface MonthLock {
    month: string; // Format "YYYY-MM"
    isLocked: boolean;
    lockedBy?: string;
    lockedAt?: string;
}

export interface WesleyHallReceipt {
    id: string;
    date: string; // ISO format YYYY-MM-DD
    amount: number;
    notes?: string;
    createdBy?: string;
    updatedBy?: string;
    lastUpdated?: string; // ISO Timestamp
    deleted?: boolean;
    createdAt?: string; // ISO Timestamp
}

export type AssetCategory = 'building' | 'technology' | 'musical-instrument' | 'furniture' | 'vehicle' | 'kitchen' | 'library' | 'art' | 'tools' | 'hvac' | 'other';
export type AssetCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'needs-repair';
export type AssetStatus = 'active' | 'storage' | 'repair' | 'disposed';

export interface Asset {
    id: string;
    name: string;
    category: AssetCategory;
    description?: string;
    location?: string;
    purchaseDate?: string; // ISO format YYYY-MM-DD
    purchasePrice?: number;
    currentValue?: number;
    serialNumber?: string;
    model?: string;
    condition: AssetCondition;
    status: AssetStatus;
    assignedTo?: string; // Person or department
    warrantyExpires?: string; // ISO format YYYY-MM-DD
    insurancePolicy?: string;
    insuranceCoverage?: number;
    insuranceExpires?: string; // ISO format YYYY-MM-DD
    photoUrl?: string;
    notes?: string;
    usefulLifeYears?: number; // For depreciation
    disposalDate?: string; // ISO format YYYY-MM-DD
    disposalMethod?: string; // Sold, Donated, Discarded
    disposalValue?: number;
    disposalNotes?: string;
    createdBy?: string;
    updatedBy?: string;
    createdAt?: string; // ISO Timestamp
    updatedAt?: string; // ISO Timestamp
    deleted?: boolean;
}

export interface AssetMaintenance {
    id: string;
    assetId: string;
    maintenanceDate: string; // ISO format YYYY-MM-DD
    description: string;
    cost?: number;
    serviceProvider?: string;
    nextServiceDate?: string; // ISO format YYYY-MM-DD
    notes?: string;
    createdBy?: string;
    createdAt?: string; // ISO Timestamp
}
