import test from 'node:test';
import assert from 'node:assert/strict';
import { installManagementDataAdapter, setManagementSociety, managementFetch } from '../services/managementClient.ts';

test('management reads use prefixed views and writes use the scoped upsert RPC', async () => {
    const calls = [];
    const client = {
        from(table) { calls.push(['from', table]); return { insert(values) { calls.push(['insert', values]); return Promise.resolve({ error: null }); } }; },
        async rpc(name, payload) { calls.push(['rpc', name, payload]); return { data: [{ id: 'member-id' }], error: null }; },
    };
    installManagementDataAdapter(client);
    setManagementSociety('ebenezer-hamilton');
    await client.from('members').insert({ name: 'Test member', society_id: 'gmct' });
    assert.equal(calls[0][1], 'cmms_members');
    assert.equal(calls[1][1].society_id, 'ebenezer-hamilton');
    const result = await client.from('members').upsert({ id: 'member-id', name: 'Test member' }).select().single();
    assert.equal(result.data.id, 'member-id');
    assert.equal(calls.at(-1)[1], 'cmms_upsert_records');
    assert.equal(calls.at(-1)[2].target_table, 'members');
});

test('every management network request includes the selected society', async () => {
    const originalFetch = globalThis.fetch;
    let sent;
    globalThis.fetch = async (_input, init) => { sent = new Headers(init.headers); return new Response('[]'); };
    try {
        setManagementSociety('bethany-brampton');
        await managementFetch('https://example.test/rest/v1/cmms_members', { headers: { Authorization: 'Bearer test-only' } });
        assert.equal(sent.get('x-cmms-society'), 'bethany-brampton');
        assert.equal(sent.get('Authorization'), 'Bearer test-only');
    } finally { globalThis.fetch = originalFetch; }
});

test('member saves can select, filter by ID and limit the returned saved rows', async () => {
    const saved = [{ id: 'other-member', name: 'Other' }, { id: 'new-member', name: 'New member' }];
    let writes = 0;
    const client = {
        from() { return {}; },
        async rpc(name, payload) {
            writes++;
            assert.equal(name, 'cmms_upsert_records');
            assert.equal(payload.target_table, 'members');
            assert.deepEqual(payload.records, saved);
            return { data: saved, error: null };
        },
    };
    installManagementDataAdapter(client);
    const result = await client.from('members').upsert(saved, { onConflict: 'id' })
        .select('*').eq('id', 'new-member').limit(1);
    assert.equal(writes, 1);
    assert.deepEqual(result.data, [saved[1]]);
    assert.equal(result.error, null);
});

test('filtered member saves preserve database errors', async () => {
    const failure = { message: 'Member save denied', code: '42501' };
    const client = { from() { return {}; }, async rpc() { return { data: null, error: failure }; } };
    installManagementDataAdapter(client);
    const result = await client.from('members').upsert({ id: 'member-id' })
        .select('*').eq('id', 'member-id').limit(1);
    assert.equal(result.data, null);
    assert.equal(result.error, failure);
});
