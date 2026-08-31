import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_KEY')
const SESSION_HOURS = 12

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256(value: string) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

async function derivePasswordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 210000, hash: 'SHA-256' }, key, 256)
  return toHex(bits)
}

function secureEquals(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

function createSalt() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes.buffer)
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json({ error: 'Tenant gateway is not configured.' }, 503)

  const path = new URL(request.url).pathname.split('/').pop()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  if (request.method === 'GET') {
    if (path === 'status') {
      const [{ count, error }, { count: softwareAdminCount, error: softwareAdminError }] = await Promise.all([
        supabase.from('tenant_credentials').select('id', { count: 'exact', head: true }),
        supabase.from('tenant_credentials').select('id', { count: 'exact', head: true }).eq('society_id', 'gmct').eq('role', 'software-admin'),
      ])
      if (error || softwareAdminError) return json({ error: 'Unable to load tenant security status.' }, 500)
      return json({ ok: true, initialized: (count || 0) > 0, softwareAdminReady: (softwareAdminCount || 0) > 0, mode: 'staged' })
    }
    return json({ ok: true, mode: 'staged', message: 'The tenant gateway is deployed but not yet connected to the live application.' })
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const body = await request.json().catch(() => null)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const societyId = typeof body?.societyId === 'string' ? body.societyId.trim() : ''
  if (!username || !password || !societyId) return json({ error: 'Username, password, and society are required.' }, 400)
  if (username.length < 3 || password.length < 12) return json({ error: 'Use a username of at least 3 characters and a password of at least 12 characters.' }, 400)

  if (path === 'bootstrap') {
    if (societyId !== 'gmct') return json({ error: 'The first tenant administrator must belong to GMCT.' }, 400)
    const { count, error: countError } = await supabase.from('tenant_credentials').select('id', { count: 'exact', head: true })
    if (countError) return json({ error: 'Unable to initialize tenant security.' }, 500)
    if ((count || 0) > 0) return json({ error: 'Tenant security has already been initialized.' }, 409)

    const passwordSalt = createSalt()
    const { data: credential, error: createError } = await supabase.from('tenant_credentials').insert({
      username,
      society_id: 'gmct',
      role: 'admin',
      password_salt: passwordSalt,
      password_hash: await derivePasswordHash(password, passwordSalt),
      must_change_password: false,
    }).select('id').single()
    if (createError || !credential) return json({ error: 'Unable to create the GMCT tenant administrator.' }, 500)
    await supabase.from('tenant_audit_log').insert({ society_id: 'gmct', credential_id: credential.id, action: 'bootstrap_admin_created' })
    return json({ ok: true, message: 'GMCT tenant administrator created. The bootstrap route is now closed.' }, 201)
  }
  if (path !== 'login') return json({ error: 'Unknown gateway action.' }, 404)

  const { data: credential, error } = await supabase
    .from('tenant_credentials')
    .select('id, username, society_id, role, password_salt, password_hash, enabled, must_change_password')
    .eq('username', username)
    .eq('society_id', societyId)
    .maybeSingle()

  if (error) return json({ error: 'Unable to validate credentials.' }, 500)
  if (!credential || !credential.enabled || !secureEquals(await derivePasswordHash(password, credential.password_salt), credential.password_hash)) {
    return json({ error: 'Invalid username, password, or society.' }, 401)
  }

  const sessionToken = crypto.randomUUID() + crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString()
  const { error: sessionError } = await supabase.from('tenant_sessions').insert({
    credential_id: credential.id,
    token_hash: await sha256(sessionToken),
    expires_at: expiresAt,
  })
  if (sessionError) return json({ error: 'Unable to create session.' }, 500)

  await supabase.from('tenant_audit_log').insert({ society_id: credential.society_id, credential_id: credential.id, action: 'login' })
  return json({ token: sessionToken, expiresAt, user: { username: credential.username, societyId: credential.society_id, role: credential.role, mustChangePassword: credential.must_change_password } })
})