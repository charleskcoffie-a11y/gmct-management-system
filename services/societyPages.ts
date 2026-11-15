import type { SocietyFeatures } from '../types';

export const SOCIETY_PAGE_GROUPS = [
    { label: 'Finance', pages: [
        { key: 'financialRecords', label: 'Financial records' },
        { key: 'developmentFund', label: 'Development fund' },
        { key: 'harvest', label: 'Harvest' },
        { key: 'dayBorn', label: 'Day born' },
        { key: 'noName', label: 'No-name contributions' },
        { key: 'financialControl', label: 'Financial controls and locks' },
        { key: 'taxReceipts', label: 'Tax receipts' },
        { key: 'organizationFunds', label: 'Organization funds' },
        { key: 'requisitions', label: 'Requisitions and approvals' },
        { key: 'etransfers', label: 'E-transfers' },
    ] },
    { label: 'Members', pages: [
        { key: 'memberDirectory', label: 'Member directory' },
        { key: 'attendance', label: 'Class attendance and attendance reports' },
        { key: 'upcomingBirthdays', label: 'Upcoming birthdays' },
    ] },
    { label: 'Reports', pages: [
        { key: 'financialReports', label: 'Financial reports' },
        { key: 'weeklyHistory', label: 'Weekly history' },
        { key: 'insights', label: 'Insights and charts' },
    ] },
    { label: 'Property', pages: [
        { key: 'wesleyHall', label: 'Wesley Hall' },
        { key: 'parking', label: 'Parking' },
        { key: 'assets', label: 'Asset registry' },
    ] },
] as const;

export type SocietyPageKey = typeof SOCIETY_PAGE_GROUPS[number]['pages'][number]['key'];
const PAGE_KEYS = SOCIETY_PAGE_GROUPS.flatMap(group => group.pages.map(page => page.key));

const PAGE_FEATURES: Record<string, SocietyPageKey> = {
    records: 'financialRecords', members: 'memberDirectory', attendance: 'attendance',
    'reports-bible-class': 'attendance', 'bible-class-attendance': 'attendance',
    'development-fund': 'developmentFund', harvest: 'harvest', 'harvest-pledges': 'harvest',
    'day-born': 'dayBorn', 'no-name': 'noName', 'financial-control': 'financialControl',
    'wesley-hall': 'wesleyHall', parking: 'parking', 'tax-receipts': 'taxReceipts',
    'organization-funds': 'organizationFunds', requisitions: 'requisitions', 'my-approvals': 'requisitions',
    insights: 'insights', reports: 'financialReports', history: 'financialReports',
    'reports-weekly': 'weeklyHistory', 'weekly-history': 'weeklyHistory',
    'reports-birthdays': 'upcomingBirthdays', 'upcoming-birthdays': 'upcomingBirthdays',
    'reports-etransfers': 'etransfers', 'e-transfers': 'etransfers', assets: 'assets',
};

export function societyPageEnabled(features: SocietyFeatures, key: SocietyPageKey, isPrimary = false): boolean {
    const saved = features[key];
    if (typeof saved === 'boolean') return saved;
    if (key === 'attendance' || key === 'developmentFund' || key === 'wesleyHall' || key === 'parking') return isPrimary;
    return true;
}

export function isSocietyPageEnabled(page: string, features: SocietyFeatures, isPrimary = false): boolean {
    const key = PAGE_FEATURES[page];
    return !key || societyPageEnabled(features, key, isPrimary);
}

export function normalizedSocietyPages(features: SocietyFeatures, isPrimary = false): SocietyFeatures {
    const next = { ...features };
    for (const key of PAGE_KEYS) next[key] = societyPageEnabled(features, key, isPrimary);
    return next;
}

export function societyPagePreset(features: SocietyFeatures, preset: 'basic' | 'all'): SocietyFeatures {
    const basic = new Set<SocietyPageKey>(['financialRecords', 'memberDirectory', 'financialReports', 'weeklyHistory', 'taxReceipts']);
    const next = { ...features };
    for (const key of PAGE_KEYS) next[key] = preset === 'all' || basic.has(key);
    return next;
}
