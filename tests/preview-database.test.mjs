import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePreviewDatabase } from '../services/previewDatabase.ts';

const jwt = claims => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;

test('preview stays disconnected until both separate database settings exist', () => {
    assert.equal(resolvePreviewDatabase().ready, false);
    assert.equal(resolvePreviewDatabase('https://separate.supabase.co', '').ready, false);
});

test('preview rejects the live GMCT host, GMCT keys, and privileged keys', () => {
    assert.equal(resolvePreviewDatabase('https://HXGOJAPFSQSMWVEASZVN.supabase.co', 'sb_publishable_test').ready, false);
    assert.equal(resolvePreviewDatabase('https://separate.supabase.co', jwt({ role: 'anon', ref: 'hxgojapfsqsmwveaszvn' })).ready, false);
    assert.equal(resolvePreviewDatabase('https://separate.supabase.co', jwt({ role: 'service_role', ref: 'separate' })).ready, false);
    assert.equal(resolvePreviewDatabase('https://separate.supabase.co', 'sb_secret_test').ready, false);
});

test('preview accepts a separate public connection and rejects mismatched legacy project keys', () => {
    assert.equal(resolvePreviewDatabase('https://separate.supabase.co/', 'sb_publishable_test').url, 'https://separate.supabase.co');
    assert.equal(resolvePreviewDatabase('https://separate.supabase.co', jwt({ role: 'anon', ref: 'separate' })).ready, true);
    assert.equal(resolvePreviewDatabase('https://separate.supabase.co', jwt({ role: 'anon', ref: 'other' })).ready, false);
});

test('preview rejects non-HTTPS URLs and credential-bearing URLs', () => {
    for (const url of ['http://separate.supabase.co', 'https://user:pass@separate.supabase.co', 'https://separate.supabase.co/extra', 'invalid']) {
        assert.equal(resolvePreviewDatabase(url, 'sb_publishable_test').ready, false);
    }
});
