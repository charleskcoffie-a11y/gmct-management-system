
export type EntryType = "tithe" | "offering" | "thanksgiving-offering" | "pledge" | "harvest-levy" | "harvest" | "kofi-and-ama" | "development-fund" | "other";
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
    active?: boolean;
    createdAt?: string;
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
}

export type UserRole = 'admin' | 'finance-chair' | 'finance-team' | 'data-entry' | 'pastor' | 'statistician';

export interface User {
    username: string;
    password?: string; // Should be hashed in a real app, but plain for this exercise
    role: UserRole;
    classLed?: string; // Legacy: kept for older records
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

export type Tab = 'home' | 'records' | 'development-fund' | 'harvest' | 'no-name' | 'financial-control' | 'members' | 'insights' | 'reports' | 'history' | 'users' | 'settings' | 'utilities' | 'tax-receipts';

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
