
// utils.ts
import { v4 as uuidv4 } from 'uuid';
import type { Entry, EntryType, Member, Method, User, UserRole, AttendanceStatus, Settings, WeeklyHistoryRecord, DevelopmentFundEntry, MonthLock, NoNameEntry, HarvestEntry } from './types';
import { DEFAULT_CURRENCY, DEFAULT_MAX_CLASSES, SUPABASE_URL, SUPABASE_KEY } from './constants';

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

    // Helper to parse a date string into month/day (no year)
    const parseDob = (val: any): { month?: number; day?: number } => {
        const s = sanitizeString(val);
        if (!s) return {};
        // Try formats: MM-DD, M/D, Month Day
        const mdMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
        if (mdMatch) {
            const m = parseInt(mdMatch[1], 10);
            const d = parseInt(mdMatch[2], 10);
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { month: m, day: d };
        }
        // Month name and day, e.g., "March 5"
        const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
        const parts = s.toLowerCase().split(/[ ,]+/);
        const mi = months.indexOf(parts[0]);
        if (mi >= 0) {
            const dayNum = parseInt(parts[1], 10);
            if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) return { month: mi + 1, day: dayNum };
        }
        return {};
    };

    const member: Member = {
        id: sanitizeString(findVal(['id', 'uuid'])) || uuidv4(),
        spId: sanitizeString(findVal(['spId', 'legacyId'])),
        name: sanitizeString(findVal(['name', 'fullName', 'member name'])) || "Unnamed Member",
        classNumber: sanitizeString(findVal(['classNumber', 'class', 'class #', 'classNo'])),
        memberNumber: sanitizeString(findVal(['memberNumber', 'member #', 'number', 'memberId', 'memberNo'])),
        address: sanitizeString(findVal(['address', 'member address', 'home address', 'street', 'mailing address'])),
        city: sanitizeString(findVal(['city', 'town'])),
        province: sanitizeString(findVal(['province', 'state', 'region'])),
        email: sanitizeString(findVal(['email', 'e-mail'])),
        profession: sanitizeString(findVal(['profession', 'occupation'])),
        phone: sanitizeString(findVal(['phone', 'phoneNumber', 'telephone', 'mobile'])),
        dayBorn: sanitizeString(findVal(['dayBorn', 'day_born', 'dayOfWeekBorn'])),
        active: typeof findVal(['active', 'isActive', 'status']) === 'boolean'
            ? (findVal(['active', 'isActive', 'status']) as boolean)
            : true,
        // Ensure createdAt is never empty string
        createdAt: sanitizeString(findVal(['createdAt', 'created_at'])) || new Date().toISOString(),
        // Development fund pledge fields
        devFundPledge: typeof findVal(['devFundPledge', 'dev_fund_pledge', 'developmentFundPledge']) === 'boolean'
            ? (findVal(['devFundPledge', 'dev_fund_pledge', 'developmentFundPledge']) as boolean)
            : false,
        devFundPledgeAmount: (() => {
            const val = findVal(['devFundPledgeAmount', 'dev_fund_pledge_amount', 'developmentFundPledgeAmount']);
            const num = parseFloat(val);
            return !isNaN(num) && num >= 0 ? num : 0;
        })()
    };

    // Populate DOB from separate fields or combined text
    const dobMonthRaw = findVal(['dobMonth','dob_month','birthdayMonth','birthMonth']);
    const dobDayRaw = findVal(['dobDay','dob_day','birthdayDay','birthDay']);
    const dobCombined = findVal(['dob','dateOfBirth','date_of_birth','birthday']);
    let monthNum: number | undefined;
    let dayNum: number | undefined;
    let dateOfBirthIso: string | undefined;
    if (typeof dobMonthRaw !== 'undefined' && typeof dobDayRaw !== 'undefined') {
        const m = parseInt(dobMonthRaw, 10);
        const d = parseInt(dobDayRaw, 10);
        if (m >= 1 && m <= 12) monthNum = m;
        if (d >= 1 && d <= 31) dayNum = d;
    } else if (dobCombined) {
        const parsed = parseDob(dobCombined);
        monthNum = parsed.month;
        dayNum = parsed.day;

        // If the provided value has a year, persist full ISO date
        const dobStr = sanitizeString(dobCombined);
        if (dobStr && /\d{4}/.test(dobStr)) {
            const parsedDate = new Date(dobStr);
            if (!isNaN(parsedDate.getTime())) {
                dateOfBirthIso = parsedDate.toISOString().slice(0, 10);
            }
        }
    }

    if (monthNum) member.dobMonth = monthNum;
    if (dayNum) member.dobDay = dayNum;
    if (dateOfBirthIso) member.dateOfBirth = dateOfBirthIso;

    return member;
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
        currency: sanitizeString(raw.currency) || DEFAULT_CURRENCY,
        maxClasses: typeof raw.maxClasses === 'number' && raw.maxClasses > 0 ? raw.maxClasses : DEFAULT_MAX_CLASSES,
        enforceDirectory: typeof raw.enforceDirectory === 'boolean' ? raw.enforceDirectory : true,
        supabaseUrl: sanitizeString(raw.supabaseUrl) || SUPABASE_URL,
        supabaseKey: sanitizeString(raw.supabaseKey) || SUPABASE_KEY,
        logoUrl: raw.logoUrl ? sanitizeString(raw.logoUrl) : undefined,
        orgName: sanitizeString(raw.orgName),
        orgAddress: sanitizeString(raw.orgAddress),
        orgPhone: sanitizeString(raw.orgPhone),
        orgEmail: sanitizeString(raw.orgEmail),
        charityNumber: sanitizeString(raw.charityNumber),
        signatureImage: raw.signatureImage ? sanitizeString(raw.signatureImage) : undefined,
        annualLevyAmount: typeof raw.annualLevyAmount === 'number' && !isNaN(raw.annualLevyAmount) ? raw.annualLevyAmount : 0,
        etransferNotificationEmail: sanitizeString(raw.etransferNotificationEmail),
        etransferInboundSecret: sanitizeString(raw.etransferInboundSecret),
        etransferProvider: sanitizeString(raw.etransferProvider) as any,
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
        'kofi-ama': 'day-born',
        'kofiandama': 'day-born',
    };

    const validTypes: EntryType[] = [
        'tithe',
        'offering',
        'thanksgiving-offering',
        'pledge',
        'harvest-levy',
        'day-born',
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
