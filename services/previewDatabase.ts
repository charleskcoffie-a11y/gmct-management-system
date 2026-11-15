const GMCT_PROJECT_REF = 'hxgojapfsqsmwveaszvn';

export function resolvePreviewDatabase(rawUrl = '', rawKey = '') {
    const pending = { url: '', key: '', ready: false };
    const key = rawKey.trim();
    if (!rawUrl.trim() || !key) return pending;
    try {
        const url = new URL(rawUrl.trim());
        if (url.protocol !== 'https:' || url.username || url.password ||
            url.hostname.toLowerCase().includes(GMCT_PROJECT_REF) ||
            (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) return pending;
        if (!key.startsWith('sb_publishable_')) {
            const payload = key.split('.')[1];
            if (!payload) return pending;
            const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
            if (claims.role !== 'anon' || claims.ref === GMCT_PROJECT_REF) return pending;
            if (url.hostname.endsWith('.supabase.co') && claims.ref !== url.hostname.split('.')[0]) return pending;
        }
        return { url: url.origin, key, ready: true };
    } catch {
        return pending;
    }
}
