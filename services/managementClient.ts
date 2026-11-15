import type { SupabaseClient } from '@supabase/supabase-js';
import type { User, UserRole } from '../types';

let societyId = 'gmct';
export const getManagementSociety = () => societyId;
export function setManagementSociety(value: string) {
    if (/^[a-z0-9-]+$/.test(value)) societyId = value;
}

export const managementFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('x-cmms-society', societyId);
    return fetch(input, { ...init, headers });
};

export function installManagementDataAdapter(client: SupabaseClient) {
    const from = client.from.bind(client);
    client.from = ((table: string) => {
        if (!/^[a-z_]+$/.test(table)) throw new Error('Invalid management table.');
        const relation = table === 'attendance' ? 'attendance_marks' : table;
        const query = from(`cmms_${relation}`);
        return new Proxy(query, {
            get(target, property) {
                if (property === 'insert') return (values: any, options: any) => {
                    const scope = (row: any) => table === 'societies' ? row : { ...row, society_id: societyId };
                    return target.insert(Array.isArray(values) ? values.map(scope) : scope(values), options);
                };
                if (property === 'upsert') return (values: unknown) => {
                    let singular = false;
                    const filters: Array<(row: any) => boolean> = [];
                    let maxRows: number | undefined;
                    const run = async () => {
                        const response = await client.rpc('cmms_upsert_records', { target_table: relation, records: values });
                        if (response.error || !Array.isArray(response.data)) return response;
                        // These modifiers shape only returned rows; the RPC enforces society access for every write.
                        let rows = response.data.filter(row => filters.every(matches => matches(row)));
                        if (maxRows !== undefined) rows = rows.slice(0, maxRows);
                        return { ...response, data: singular ? rows[0] ?? null : rows };
                    };
                    const operation: any = {
                        select: () => operation,
                        eq: (column: string, value: unknown) => { filters.push(row => row[column] === value); return operation; },
                        limit: (count: number) => { maxRows = Math.max(0, Math.floor(count)); return operation; },
                        single: () => { singular = true; return operation; },
                        maybeSingle: () => { singular = true; return operation; },
                        then: (resolve: any, reject: any) => run().then(resolve, reject),
                    };
                    return operation;
                };
                const value = Reflect.get(target, property);
                return typeof value === 'function' ? value.bind(target) : value;
            },
        });
    }) as typeof client.from;
}

export interface ManagementAccess {
    user_id: string;
    society_id: string;
    email: string;
    full_name?: string;
    role: UserRole;
    class_number?: string;
    active: boolean;
}

export async function loadManagementAccess(client: SupabaseClient): Promise<ManagementAccess[]> {
    const { data, error } = await client.from('user_access').select('*').order('email');
    if (error) throw error;
    return data || [];
}

export async function managementSessionUser(client: SupabaseClient, selectedSocietyId: string): Promise<User | null> {
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;
    const memberships = await loadManagementAccess(client);
    const access = memberships.find(a => a.user_id === user.id && a.active && a.society_id === selectedSocietyId)
        || memberships.find(a => a.user_id === user.id && a.active && a.role === 'software-admin');
    if (!access) return null;
    return { username: access.email, role: access.role === 'software-admin' ? 'admin' : access.role, managementRole: access.role, societyId: selectedSocietyId,
        assignedClass: access.class_number, classLed: access.class_number };
}
