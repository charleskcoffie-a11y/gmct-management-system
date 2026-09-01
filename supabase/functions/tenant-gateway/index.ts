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

async function requireTenantUser(request: Request, supabase: ReturnType<typeof createClient>) {
  const authorization = request.headers.get('Authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return null

  const { data: session } = await supabase
    .from('tenant_sessions')
    .select('id, credential_id, expires_at, revoked_at')
    .eq('token_hash', await sha256(token))
    .maybeSingle()
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) return null

  const { data: credential } = await supabase
    .from('tenant_credentials')
    .select('id, society_id, role, enabled')
    .eq('id', session.credential_id)
    .maybeSingle()
  if (!credential?.enabled) return null

  const { data: society } = await supabase.from('societies').select('status').eq('id', credential.society_id).maybeSingle()
  if (!society || society.status === 'archived') return null

  await supabase.from('tenant_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', session.id)
  return credential
}

async function requireSoftwareAdmin(request: Request, supabase: ReturnType<typeof createClient>) {
  const credential = await requireTenantUser(request, supabase)
  return credential?.role === 'software-admin' && credential.society_id === 'gmct' ? credential : null
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
  if (path === 'tenant-data') {
    const tenantUser = await requireTenantUser(request, supabase)
    if (!tenantUser || tenantUser.role === 'software-admin') return json({ error: 'A valid society session is required.' }, 401)

    const resource = body?.resource
    const operation = body?.operation
    if (!['members', 'entries', 'requisitions', 'weekly_history'].includes(resource)) return json({ error: 'Unsupported tenant resource.' }, 400)

    if (operation === 'list') {
      const orderColumn = resource === 'members' ? 'name' : resource === 'weekly_history' ? 'date_of_service' : resource === 'requisitions' ? 'created_at' : 'date'
      const { data, error } = await supabase.from(resource).select('*').eq('society_id', tenantUser.society_id).order(orderColumn, { ascending: resource === 'members' })
      if (error) return json({ error: `Unable to load ${resource}.` }, 500)
      return json({ data: data || [] })
    }

    const writeRoles = resource === 'members' ? ['admin', 'class-leader']
      : resource === 'weekly_history' ? ['admin', 'pastor', 'statistician']
      : ['admin', 'finance-chair', 'finance-team', 'data-entry', 'pastor']
    if (!writeRoles.includes(tenantUser.role)) return json({ error: 'Your role cannot modify this resource.' }, 403)
    if (operation === 'delete' && typeof body?.recordId === 'string') {
      const { error } = await supabase.from(resource).delete().eq('id', body.recordId).eq('society_id', tenantUser.society_id)
      if (error) return json({ error: `Unable to delete ${resource}.` }, 500)
      await supabase.from('tenant_audit_log').insert({ society_id: tenantUser.society_id, credential_id: tenantUser.id, action: `${resource}_deleted`, details: { recordId: body.recordId } })
      return json({ ok: true })
    }
    if (operation !== 'upsert' || !body?.record || typeof body.record !== 'object') return json({ error: 'Unsupported tenant operation.' }, 400)

    const record = { ...body.record, society_id: tenantUser.society_id }
    const { data, error } = await supabase.from(resource).upsert(record, { onConflict: 'id' }).select('*').single()
    if (error) return json({ error: `Unable to save ${resource}.` }, 500)
    await supabase.from('tenant_audit_log').insert({ society_id: tenantUser.society_id, credential_id: tenantUser.id, action: `${resource}_upserted`, details: { recordId: data.id } })
    return json({ data })
  }

  if (path === 'receipt-profile') {
    const tenantUser = await requireTenantUser(request, supabase)
    if (!tenantUser || tenantUser.role !== 'admin' || tenantUser.society_id === 'gmct') {
      return json({ error: 'A branch Society Administrator session is required.' }, 401)
    }

    if (body?.operation === 'load') {
      const { data: profile, error: loadError } = await supabase.from('tenant_receipt_profiles').select('*').eq('society_id', tenantUser.society_id).maybeSingle()
      if (loadError) return json({ error: 'Receipt profile storage is not ready. Run the tenant receipt profile migration.' }, 503)
      return json({ profile: profile ? {
        charityNumber: profile.charity_number,
        ministerName: profile.minister_name,
        ministerSignature: profile.minister_signature || '',
        treasurerName: profile.treasurer_name,
        treasurerSignature: profile.treasurer_signature || '',
      } : null })
    }

    const profile = body?.profile
    const charityNumber = typeof profile?.charityNumber === 'string' ? profile.charityNumber.trim() : ''
    const ministerName = typeof profile?.ministerName === 'string' ? profile.ministerName.trim() : ''
    const treasurerName = typeof profile?.treasurerName === 'string' ? profile.treasurerName.trim() : ''
    const ministerSignature = typeof profile?.ministerSignature === 'string' ? profile.ministerSignature : ''
    const treasurerSignature = typeof profile?.treasurerSignature === 'string' ? profile.treasurerSignature : ''
    if (!charityNumber || !ministerName || !treasurerName) return json({ error: 'Charity number, minister name, and treasurer name are required.' }, 400)
    if ([ministerSignature, treasurerSignature].some(image => image.length > 1400000)) return json({ error: 'Each signature image must be smaller than 1 MB.' }, 413)

    const receiptProfile = { charityNumber, ministerName, ministerSignature, treasurerName, treasurerSignature }
    const { error: updateError } = await supabase.from('tenant_receipt_profiles').upsert({
      society_id: tenantUser.society_id,
      charity_number: charityNumber,
      minister_name: ministerName,
      minister_signature: ministerSignature || null,
      treasurer_name: treasurerName,
      treasurer_signature: treasurerSignature || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'society_id' })
    if (updateError) return json({ error: 'Unable to save receipt signing authority.' }, 500)
    await supabase.from('tenant_audit_log').insert({ society_id: tenantUser.society_id, credential_id: tenantUser.id, action: 'receipt_profile_updated', details: { ministerName, treasurerName } })
    return json({ ok: true, profile: receiptProfile })
  }

  if (path === 'societies') {
    const softwareAdmin = await requireSoftwareAdmin(request, supabase)
    if (!softwareAdmin) return json({ error: 'A valid Software Admin session is required.' }, 401)

    const society = body?.society
    const id = typeof society?.id === 'string' ? society.id.trim().toLowerCase() : ''
    const code = typeof society?.societyCode === 'string' ? society.societyCode.trim().toUpperCase() : ''
    const name = typeof society?.name === 'string' ? society.name.trim() : ''
    const city = typeof society?.city === 'string' ? society.city.trim() : ''
    const province = typeof society?.province === 'string' ? society.province.trim() : ''
    const provinceCode = typeof society?.provinceCode === 'string' ? society.provinceCode.trim().toUpperCase() : ''
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !code || !name || !city || !province || !provinceCode) {
      return json({ error: 'Society ID, code, name, city, province, and province code are required.' }, 400)
    }

    const { data: createdSociety, error: createError } = await supabase.from('societies').insert({
      id,
      code,
      name,
      short_name: typeof society.shortName === 'string' && society.shortName.trim() ? society.shortName.trim() : name,
      city,
      province,
      province_code: provinceCode,
      is_primary: false,
      address: typeof society.address === 'string' && society.address.trim() ? society.address.trim() : null,
      phone: typeof society.phone === 'string' && society.phone.trim() ? society.phone.trim() : null,
      email: typeof society.email === 'string' && society.email.trim() ? society.email.trim() : null,
      features: society.features && typeof society.features === 'object' ? society.features : {},
      accent_color: typeof society.accentColor === 'string' && society.accentColor.trim() ? society.accentColor.trim() : 'indigo',
    }).select('id').single()
    if (createError || !createdSociety) {
      const conflict = createError?.code === '23505'
      return json({ error: conflict ? 'A society with that ID or code already exists.' : 'Unable to create society.' }, conflict ? 409 : 500)
    }

    await supabase.from('tenant_audit_log').insert({
      society_id: id,
      credential_id: softwareAdmin.id,
      action: 'society_created',
      details: { code, name },
    })
    return json({ ok: true, societyId: id }, 201)
  }

  if (path === 'update-society') {
    const softwareAdmin = await requireSoftwareAdmin(request, supabase)
    if (!softwareAdmin) return json({ error: 'A valid Software Admin session is required.' }, 401)

    const societyId = typeof body?.societyId === 'string' ? body.societyId.trim().toLowerCase() : ''
    const action = typeof body?.action === 'string' ? body.action : 'edit'
    if (!societyId || societyId === 'gmct') return json({ error: 'Select a branch society.' }, 400)

    if (action === 'archive' || action === 'reactivate') {
      const status = action === 'archive' ? 'archived' : 'active'
      const { error: lifecycleError } = await supabase.from('societies').update({
        status,
        archived_at: status === 'archived' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', societyId).eq('is_primary', false)
      if (lifecycleError) return json({ error: `Unable to ${action} society.` }, 500)

      if (status === 'archived') {
        const { data: credentials } = await supabase.from('tenant_credentials').select('id').eq('society_id', societyId)
        const credentialIds = (credentials || []).map(credential => credential.id)
        if (credentialIds.length) {
          await supabase.from('tenant_sessions').update({ revoked_at: new Date().toISOString() }).in('credential_id', credentialIds).is('revoked_at', null)
        }
      }
      await supabase.from('tenant_audit_log').insert({ society_id: societyId, credential_id: softwareAdmin.id, action: `society_${status}` })
      return json({ ok: true, status })
    }

    const society = body?.society
    const name = typeof society?.name === 'string' ? society.name.trim() : ''
    const shortName = typeof society?.shortName === 'string' ? society.shortName.trim() : ''
    const code = typeof society?.societyCode === 'string' ? society.societyCode.trim().toUpperCase() : ''
    const city = typeof society?.city === 'string' ? society.city.trim() : ''
    const province = typeof society?.province === 'string' ? society.province.trim() : ''
    const provinceCode = typeof society?.provinceCode === 'string' ? society.provinceCode.trim().toUpperCase() : ''
    if (!name || !shortName || !code || !city || !province || !provinceCode) return json({ error: 'Complete all required society details.' }, 400)
    const { error: editError } = await supabase.from('societies').update({
      name,
      short_name: shortName,
      code,
      city,
      province,
      province_code: provinceCode,
      address: typeof society.address === 'string' && society.address.trim() ? society.address.trim() : null,
      phone: typeof society.phone === 'string' && society.phone.trim() ? society.phone.trim() : null,
      email: typeof society.email === 'string' && society.email.trim() ? society.email.trim() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', societyId).eq('is_primary', false)
    if (editError) return json({ error: editError.code === '23505' ? 'That society code is already in use.' : 'Unable to update society.' }, editError.code === '23505' ? 409 : 500)
    await supabase.from('tenant_audit_log').insert({ society_id: societyId, credential_id: softwareAdmin.id, action: 'society_updated', details: { code, name } })
    return json({ ok: true })
  }

  if (path === 'oversight') {
    const softwareAdmin = await requireSoftwareAdmin(request, supabase)
    if (!softwareAdmin) return json({ error: 'A valid Software Admin session is required.' }, 401)

    const { data: societies, error: societiesError } = await supabase
      .from('societies')
      .select('id, code, name, city, province_code, is_primary, status, features')
      .order('is_primary', { ascending: false })
      .order('name')
    if (societiesError) return json({ error: 'Unable to load Mission oversight.' }, 500)

    const summaries = await Promise.all((societies || []).map(async society => {
      const [membersResult, entriesResult, credentialsResult] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('society_id', society.id),
        supabase.from('entries').select('amount, deleted').eq('society_id', society.id),
        supabase.from('tenant_credentials').select('id', { count: 'exact', head: true }).eq('society_id', society.id).eq('enabled', true),
      ])
      const activeEntries = (entriesResult.data || []).filter(entry => !entry.deleted)
      return {
        id: society.id,
        code: society.code,
        name: society.name,
        location: `${society.city}, ${society.province_code}`,
        isPrimary: society.is_primary,
        status: society.status || 'active',
        maxClasses: society.is_primary ? 14 : society.features?.maxClasses ?? 5,
        memberCount: membersResult.count || 0,
        entryCount: activeEntries.length,
        contributionTotal: activeEntries.reduce((total, entry) => total + Number(entry.amount || 0), 0),
        activeUserCount: credentialsResult.count || 0,
      }
    }))
    return json({ societies: summaries })
  }

  if (path === 'credentials') {
    const softwareAdmin = await requireSoftwareAdmin(request, supabase)
    if (!softwareAdmin) return json({ error: 'A valid Software Admin session is required.' }, 401)

    const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const societyId = typeof body?.societyId === 'string' ? body.societyId.trim().toLowerCase() : ''
    const role = typeof body?.role === 'string' ? body.role.trim() : ''
    const allowedRoles = ['admin', 'finance-chair', 'finance-team', 'data-entry', 'pastor', 'statistician', 'class-leader']
    const passwordIsValid = role === 'admin' ? password.length >= 8 : /^\d{6}$/.test(password)
    if (username.length < 3 || !passwordIsValid || !societyId || !allowedRoles.includes(role)) {
      return json({ error: role === 'admin' ? 'Society Administrator passwords require at least 8 characters.' : 'Regular society users require an exact 6-digit numeric PIN.' }, 400)
    }

    const { data: society } = await supabase.from('societies').select('id, status').eq('id', societyId).maybeSingle()
    if (!society || society.status === 'archived') return json({ error: 'The selected society is unavailable.' }, 404)

    const passwordSalt = createSalt()
    const { data: credential, error: createError } = await supabase.from('tenant_credentials').insert({
      username,
      society_id: societyId,
      role,
      password_salt: passwordSalt,
      password_hash: await derivePasswordHash(password, passwordSalt),
      must_change_password: false,
    }).select('id').single()
    if (createError || !credential) {
      const conflict = createError?.code === '23505'
      return json({ error: conflict ? 'That username already exists for this society.' : 'Unable to create tenant user.' }, conflict ? 409 : 500)
    }

    await supabase.from('tenant_audit_log').insert({
      society_id: societyId,
      credential_id: softwareAdmin.id,
      action: 'tenant_credential_created',
      details: { credentialId: credential.id, username, role },
    })
    return json({ ok: true, credentialId: credential.id }, 201)
  }

  if (path === 'credential-status') {
    const softwareAdmin = await requireSoftwareAdmin(request, supabase)
    if (!softwareAdmin) return json({ error: 'A valid Software Admin session is required.' }, 401)

    const societyId = typeof body?.societyId === 'string' ? body.societyId.trim().toLowerCase() : ''
    if (!societyId || societyId === 'gmct') return json({ error: 'Select a branch society.' }, 400)

    const { data: administrators, error: statusError } = await supabase
      .from('tenant_credentials')
      .select('username, enabled, updated_at')
      .eq('society_id', societyId)
      .eq('role', 'admin')
      .order('username')
    if (statusError) return json({ error: 'Unable to load society administrator status.' }, 500)
    return json({ administrators: administrators || [] })
  }

  if (path === 'reset-credential') {
    const softwareAdmin = await requireSoftwareAdmin(request, supabase)
    if (!softwareAdmin) return json({ error: 'A valid Software Admin session is required.' }, 401)

    const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const societyId = typeof body?.societyId === 'string' ? body.societyId.trim().toLowerCase() : ''
    if (username.length < 3 || password.length < 8 || !societyId || societyId === 'gmct') {
      return json({ error: 'Use a valid branch society, username, and password of at least 8 characters.' }, 400)
    }

    const { data: credential, error: credentialError } = await supabase
      .from('tenant_credentials')
      .select('id')
      .eq('username', username)
      .eq('society_id', societyId)
      .eq('role', 'admin')
      .maybeSingle()
    if (credentialError) return json({ error: 'Unable to load the society administrator.' }, 500)
    if (!credential) return json({ error: 'That society administrator account was not found.' }, 404)

    const passwordSalt = createSalt()
    const { error: updateError } = await supabase.from('tenant_credentials').update({
      password_salt: passwordSalt,
      password_hash: await derivePasswordHash(password, passwordSalt),
      enabled: true,
      must_change_password: false,
      updated_at: new Date().toISOString(),
    }).eq('id', credential.id)
    if (updateError) return json({ error: 'Unable to reset the society administrator password.' }, 500)

    const revokedAt = new Date().toISOString()
    await Promise.all([
      supabase.from('tenant_sessions').update({ revoked_at: revokedAt }).eq('credential_id', credential.id).is('revoked_at', null),
      supabase.from('tenant_audit_log').insert({
        society_id: societyId,
        credential_id: softwareAdmin.id,
        action: 'tenant_admin_password_reset',
        details: { credentialId: credential.id, username },
      }),
    ])
    return json({ ok: true, message: 'Society administrator password reset successfully.' })
  }

  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const societyId = typeof body?.societyId === 'string' ? body.societyId.trim() : ''
  if (!username || !password || !societyId) return json({ error: 'Username, password, and society are required.' }, 400)

  if (path === 'bootstrap') {
    if (societyId !== 'gmct') return json({ error: 'The first tenant administrator must belong to GMCT.' }, 400)
    if (username.length < 3 || password.length < 12) return json({ error: 'Use a username of at least 3 characters and a password of at least 12 characters.' }, 400)
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

  const { data: loginSociety } = await supabase.from('societies').select('status').eq('id', societyId).maybeSingle()
  if (!loginSociety || loginSociety.status === 'archived') return json({ error: 'This society is not currently active.' }, 403)

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