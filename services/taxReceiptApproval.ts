import type { SupabaseClient } from '@supabase/supabase-js';

export function taxReceiptStatus(enabled: boolean, donorAddress?: string) {
    const official = enabled === true && !!donorAddress?.trim();
    return {
        official,
        title: official ? 'OFFICIAL RECEIPT FOR INCOME TAX PURPOSES' : 'DRAFT - NOT VALID FOR TAX PURPOSES',
        reason: !enabled ? 'Administrator approval is required.' : !donorAddress?.trim() ? 'Donor mailing address is missing.' : '',
    };
}

export async function loadTaxReceiptApproval(client: SupabaseClient | null, societyId: string): Promise<boolean> {
    if (!client) throw new Error('Unable to verify tax receipt approval.');
    const { data, error } = await client.from('app_settings').select('official_tax_receipts_enabled')
        .eq('society_id', societyId).eq('id', 'app_settings').maybeSingle();
    if (error) throw error;
    return data?.official_tax_receipts_enabled === true;
}
