
// utils.ts
import { v4 as uuidv4 } from 'uuid';
import type { Entry, EntryType, Member, Method, User, UserRole, AttendanceStatus, Settings, WeeklyHistoryRecord, DevelopmentFundEntry, MonthLock, NoNameEntry, HarvestEntry } from './types';

// --- String & Sanitization ---

export function sanitizeString(input: any): string {
    if (typeof input === 'string') {
        return input.trim();
    }
    return '';
}

export function capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}


// --- Data Type Sanitizers ---

export function sanitizeEntry(raw: any): Entry {
    const parsedDate = new Date(raw.date);
    const date = (raw.date && !isNaN(parsedDate.getTime()))
        ? parsedDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    
    return {
        id: sanitizeString(raw.id) || uuidv4(),
        date: date,
        memberID: sanitizeString(raw.memberID),
        memberName: sanitizeString(raw.memberName),
        classNumber: sanitizeString(raw.classNumber),
        type: raw.type ? sanitizeEntryType(raw.type) : 'tithe',
        fund: sanitizeString(raw.fund) || "General",
        method: sanitizeMethod(raw.method),
        amount: isNaN(parseFloat(raw.amount)) ? 0 : parseFloat(raw.amount),
        note: sanitizeString(raw.note),
        createdBy: sanitizeString(raw.createdBy),
        updatedBy: sanitizeString(raw.updatedBy),
        // Important: Return undefined or valid string, never empty string for optional date fields
        lastUpdated: sanitizeString(raw.lastUpdated) || undefined, 
        deleted: !!raw.deleted,
        createdAt: sanitizeString(raw.createdAt) || new Date().toISOString()
    };
}

export function sanitizeDevelopmentFundEntry(raw: any): DevelopmentFundEntry {
    const parsedDate = new Date(raw.date);
    const date = (raw.date && !isNaN(parsedDate.getTime()))
        ? parsedDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    
    return {
        id: sanitizeString(raw.id) || uuidv4(),
        date: date,
        memberId: sanitizeString(raw.memberId),
        amount: isNaN(parseFloat(raw.amount)) ? 0 : parseFloat(raw.amount),
        description: sanitizeString(raw.description),
        createdBy: sanitizeString(raw.createdBy),
    };
}

export function sanitizeNoNameEntry(raw: any): NoNameEntry {
    const parsedDate = new Date(raw.date);
    const date = (raw.date && !isNaN(parsedDate.getTime()))
        ? parsedDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    
    return {
        id: sanitizeString(raw.id) || uuidv4(),
        date: date,
        amount: isNaN(parseFloat(raw.amount)) ? 0 : parseFloat(raw.amount),
        notes: sanitizeString(raw.notes),
        createdBy: sanitizeString(raw.createdBy),
        updatedAt: sanitizeString(raw.updatedAt) || new Date().toISOString(),
    };
}

export function sanitizeHarvestEntry(raw: any): HarvestEntry {
    const parsedDate = new Date(raw.date);
    const date = (raw.date && !isNaN(parsedDate.getTime()))
        ? parsedDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    
    return {
        id: sanitizeString(raw.id) || uuidv4(),
        date: date,
        memberID: sanitizeString(raw.memberID),
        memberName: sanitizeString(raw.memberName),
        classNumber: sanitizeString(raw.classNumber),
        amount: isNaN(parseFloat(raw.amount)) ? 0 : parseFloat(raw.amount),
        note: sanitizeString(raw.note),
        createdBy: sanitizeString(raw.createdBy),
        updatedBy: sanitizeString(raw.updatedBy),
        lastUpdated: sanitizeString(raw.lastUpdated),
        deleted: typeof raw.deleted === 'boolean' ? raw.deleted : false,
        createdAt: sanitizeString(raw.createdAt),
    };
}

export function sanitizeMember(raw: any): Member {
    // Helper to find value by checking multiple possible keys (case-insensitive)
    const findVal = (keys: string[]) => {
        const lowerKeys = keys.map(k => k.toLowerCase());
        const foundKey = Object.keys(raw).find(k => lowerKeys.includes(k.toLowerCase()));
        return foundKey ? raw[foundKey] : undefined;
    };

    return {
        id: sanitizeString(findVal(['id', 'uuid'])) || uuidv4(),
        spId: sanitizeString(findVal(['spId', 'legacyId'])),
        name: sanitizeString(findVal(['name', 'fullName', 'member name'])) || "Unnamed Member",
        classNumber: sanitizeString(findVal(['classNumber', 'class', 'class #', 'classNo'])),
        memberNumber: sanitizeString(findVal(['memberNumber', 'member #', 'number', 'memberId', 'memberNo'])),
        // Ensure createdAt is never empty string
        createdAt: sanitizeString(findVal(['createdAt', 'created_at'])) || new Date().toISOString()
    };
}

export function sanitizeUser(raw: any): User {
    return {
        username: sanitizeString(raw.username) || "InvalidUser",
        password: sanitizeString(raw.password), // Note: Password should be handled securely
        role: sanitizeUserRole(raw.role),
        classLed: sanitizeString(raw.classLed),
    };
}

export function sanitizeSettings(raw: any): Settings {
    return {
        currency: sanitizeString(raw.currency) || 'USD',
        maxClasses: typeof raw.maxClasses === 'number' && raw.maxClasses > 0 ? raw.maxClasses : 10,
        enforceDirectory: typeof raw.enforceDirectory === 'boolean' ? raw.enforceDirectory : true,
        supabaseUrl: sanitizeString(raw.supabaseUrl),
        supabaseKey: sanitizeString(raw.supabaseKey),
        logoUrl: raw.logoUrl ? sanitizeString(raw.logoUrl) : undefined,
        orgName: sanitizeString(raw.orgName),
        orgAddress: sanitizeString(raw.orgAddress),
        orgPhone: sanitizeString(raw.orgPhone),
        orgEmail: sanitizeString(raw.orgEmail),
        charityNumber: sanitizeString(raw.charityNumber),
        signatureImage: raw.signatureImage ? sanitizeString(raw.signatureImage) : undefined,
    }
}

export function sanitizeWeeklyHistoryRecord(raw: any): WeeklyHistoryRecord {
    const attendance = raw.attendance && typeof raw.attendance === 'object' ? raw.attendance : {};
    
    const parsedDate = new Date(raw.dateOfService);
    const dateOfService = (raw.dateOfService && !isNaN(parsedDate.getTime()))
        ? parsedDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    
    return {
        id: sanitizeString(raw.id) || uuidv4(),
        dateOfService: dateOfService,
        societyName: sanitizeString(raw.societyName),
        officiant: sanitizeString(raw.officiant),
        liturgist: sanitizeString(raw.liturgist),
        serviceTypes: Array.isArray(raw.serviceTypes) ? raw.serviceTypes.map(sanitizeString) : [],
        serviceTypeOther: sanitizeString(raw.serviceTypeOther),
        sermonTopic: sanitizeString(raw.sermonTopic),
        worshipHighlights: sanitizeString(raw.worshipHighlights),
        announcementsBy: sanitizeString(raw.announcementsBy),
        attendance: {
            men: isNaN(parseInt(attendance.men, 10)) ? 0 : parseInt(attendance.men, 10),
            women: isNaN(parseInt(attendance.women, 10)) ? 0 : parseInt(attendance.women, 10),
            junior: isNaN(parseInt(attendance.junior, 10)) ? 0 : parseInt(attendance.junior, 10),
            children: isNaN(parseInt(attendance.children, 10)) ? 0 : parseInt(attendance.children, 10),
            visitors: isNaN(parseInt(attendance.visitors, 10)) ? 0 : parseInt(attendance.visitors, 10),
            catechumens: isNaN(parseInt(attendance.catechumens, 10)) ? 0 : parseInt(attendance.catechumens, 10),
        },
        visitorsList: Array.isArray(raw.visitorsList) ? raw.visitorsList.map((v: any) => ({
            name: sanitizeString(v.name),
            from: sanitizeString(v.from),
            position: sanitizeString(v.position),
            reason: sanitizeString(v.reason)
        })) : [],
        donationsList: Array.isArray(raw.donationsList) ? raw.donationsList.map((d: any) => ({
            donor: sanitizeString(d.donor),
            amount: isNaN(parseFloat(d.amount)) ? 0 : parseFloat(d.amount),
            description: sanitizeString(d.description)
        })) : [],
        newMembersDetails: sanitizeString(raw.newMembersDetails),
        newMembersContact: sanitizeString(raw.newMembersContact),
        events: sanitizeString(raw.events),
        observations: sanitizeString(raw.observations),
        preparedBy: sanitizeString(raw.preparedBy),
    };
}

// --- Enum Sanitizers ---

export function sanitizeEntryType(type: any): EntryType {
    const raw = sanitizeString(type).toLowerCase().trim();

    const normalized = raw
        .replace(/\s+/g, '-')      // spaces to hyphen
        .replace(/_+/g, '-')        // underscores to hyphen
        .replace(/-{2,}/g, '-')     // collapse multiple hyphens
        .replace(/[^a-z-]/g, '');   // remove unexpected chars

    // Map common aliases to canonical values
    const aliasMap: Record<string, EntryType> = {
        'first-fruit': 'thanksgiving-offering',
        'firstfruit': 'thanksgiving-offering',
        'first-fruits': 'thanksgiving-offering',
        'thanks': 'thanksgiving-offering',
        'thanksgiving': 'thanksgiving-offering',
        'tithes': 'tithe',
        'development': 'development-fund',
        'developmentfund': 'development-fund',
        'harvest': 'harvest-levy',
        'harvestlevy': 'harvest-levy',
        'harvest-levy': 'harvest-levy',
        'pledges': 'pledge',
        'kofi-ama': 'kofi-and-ama',
        'kofiandama': 'kofi-and-ama',
    };

    const validTypes: EntryType[] = [
        'tithe',
        'offering',
        'thanksgiving-offering',
        'pledge',
        'harvest-levy',
        'kofi-and-ama',
        'development-fund',
        'other'
    ];

    if (aliasMap[normalized]) return aliasMap[normalized];
    return (validTypes as string[]).includes(normalized) ? normalized as EntryType : 'other';
}

export function sanitizeMethod(method: any): Method {
    const validMethods: Method[] = ["cash", "check", "card", "e-transfer", "mobile", "other"];
    return validMethods.includes(method) ? method : "cash";
}

export function sanitizeUserRole(role: any): UserRole {
    const validRoles: UserRole[] = ['admin', 'finance-chair', 'finance-team', 'data-entry', 'pastor', 'statistician'];
    // Backward compatibility map
    if (role === 'finance') return 'finance-team';
    return validRoles.includes(role) ? role : 'finance-team';
}

export function sanitizeAttendanceStatus(status: any): AttendanceStatus {
    const validStatuses: AttendanceStatus[] = ['present', 'absent', 'sick', 'travel', 'catechumen'];
    return validStatuses.includes(status) ? status : 'absent';
}


// --- CSV Handling ---

export function fromCsv(csvText: string): any[] {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const obj: { [key: string]: any } = {};
        for (let j = 0; j < headers.length; j++) {
            let val = values[j] || '';
            // Simple quote stripping
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
            }
            obj[headers[j]] = val.trim();
        }
        rows.push(obj);
    }
    return rows;
}

export function toCsv(data: any[]): string {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header];
                const strValue = (value === null || value === undefined) ? '' : String(value);
                // Handle commas within values by wrapping in quotes
                return strValue.includes(',') || strValue.includes('\n') ? `"${strValue}"` : strValue;
            }).join(',')
        )
    ];
    return csvRows.join('\n');
}

// --- Formatting ---

export function formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount);
}

// --- Data Merging Helper ---
export function mergeUnique<T>(local: T[], cloud: T[], key: keyof T = 'id' as keyof T): T[] {
    const merged = new Map<any, T>();

    // 1. Add all Cloud items (Source of Truth)
    cloud.forEach(item => merged.set(item[key], item));

    // 2. Add Local items ONLY if they don't exist in Cloud
    // This assumes that if it's in local but not cloud, it's a new item created offline.
    local.forEach(item => {
        if (!merged.has(item[key])) {
            merged.set(item[key], item);
        }
    });

    return Array.from(merged.values());
}

// --- Logic Helpers ---

export function isMonthLocked(dateStr: string, locks: MonthLock[]): boolean {
    if (!dateStr || !locks) return false;
    // dateStr is usually YYYY-MM-DD
    const monthKey = dateStr.substring(0, 7); // "YYYY-MM"
    const lock = locks.find(l => l.month === monthKey);
    return lock ? lock.isLocked : false;
}

export function calculateInsights(entries: Entry[]) {
    // Basic AI-style summary logic
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthKey = lastMonthDate.toISOString().substring(0, 7);

    const currentMonthTotal = entries
        .filter(e => !e.deleted && e.date.startsWith(currentMonthKey))
        .reduce((sum, e) => sum + e.amount, 0);

    const lastMonthTotal = entries
        .filter(e => !e.deleted && e.date.startsWith(lastMonthKey))
        .reduce((sum, e) => sum + e.amount, 0);

    let comparisonText = "No data for comparison";
    let trend: 'up' | 'down' | 'flat' = 'flat';

    if (lastMonthTotal > 0) {
        const diff = currentMonthTotal - lastMonthTotal;
        const percent = (diff / lastMonthTotal) * 100;
        trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
        comparisonText = `${Math.abs(percent).toFixed(1)}% ${trend === 'up' ? 'increase' : 'decrease'} from last month`;
    }

    return {
        currentMonthTotal,
        comparisonText,
        trend
    };
}
