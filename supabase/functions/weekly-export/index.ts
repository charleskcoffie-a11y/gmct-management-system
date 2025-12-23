// Supabase Edge Function: weekly-export
// Exports the `entries` table to CSV, uploads to Storage, and emails a link

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY')
const BACKUP_BUCKET = Deno.env.get('BACKUP_BUCKET') || 'backups'
const BACKUP_EMAIL = Deno.env.get('BACKUP_EMAIL') // recipient email
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'backups@no-reply.example.com'

function toCsv(rows: any[]): string {
  const headers = [
    'id','date','member_id','member_name','type','fund','method','amount','note','class_number','created_by','updated_by','last_updated','deleted','created_at','remaining','group_name'
  ]
  const headerLine = headers.join(',')
  const lines = rows.map((r) => headers.map((h) => {
    let v = r[h]
    if (v === null || v === undefined) return ''
    // Escape quotes and commas
    const s = String(v).replace(/"/g, '""')
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s
  }).join(','))
  return [headerLine, ...lines].join('\n')
}

async function sendEmail(subject: string, text: string) {
  if (!RESEND_API_KEY || !BACKUP_EMAIL) throw new Error('Missing RESEND_API_KEY or BACKUP_EMAIL env')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: BACKUP_EMAIL,
      subject,
      text
    })
  })
  if (!res.ok) throw new Error(`Resend email failed: ${res.status} ${await res.text()}`)
}

Deno.serve(async () => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env')
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 1) Fetch all entries (adjust WHERE for last 7 days if preferred)
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .order('date', { ascending: false })
    if (error) throw new Error(`Select entries failed: ${error.message}`)

    // 2) Convert to CSV
    const csv = toCsv(data || [])
    const now = new Date()
    const yyyy = now.getUTCFullYear()
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(now.getUTCDate()).padStart(2, '0')
    const fileName = `entries_${yyyy}-${mm}-${dd}.csv`

    // 3) Upload to Storage (ensure bucket exists in advance)
    const uploadRes = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(fileName, new Blob([csv], { type: 'text/csv' }), {
        contentType: 'text/csv',
        upsert: true,
      })
    if (uploadRes.error) throw new Error(`Upload failed: ${uploadRes.error.message}`)

    // 4) Create signed URL valid for 7 days
    const { data: signed, error: signedErr } = await supabase.storage
      .from(BACKUP_BUCKET)
      .createSignedUrl(fileName, 60 * 60 * 24 * 7)
    if (signedErr) throw new Error(`Signed URL failed: ${signedErr.message}`)

    // 5) Email link
    const subject = `GMCT Entries Backup ${yyyy}-${mm}-${dd}`
    const text = `Your weekly backup is ready.\n\nFile: ${fileName}\nLink (valid 7 days): ${signed?.signedUrl}\nRows: ${(data || []).length}\n\n`+
                 `If you need permanent retention, download and store securely.`
    await sendEmail(subject, text)

    return new Response(JSON.stringify({ ok: true, fileName }), { status: 200 })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 })
  }
})
