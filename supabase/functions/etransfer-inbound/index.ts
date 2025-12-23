// Supabase Edge Function: etransfer-inbound
// Receives inbound email webhooks (SendGrid/Mailgun/Resend-like), parses basic
// e-Transfer details, stores in 'etransfers' table.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY')
const INBOUND_SECRET = Deno.env.get('INBOUND_SECRET')

function parseAmount(text: string): { amount?: number; currency?: string } {
  // Try to match typical patterns like: $123.45 or CAD 123.45
  const moneyRegex = /(CAD|USD)?\s?\$?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2})?)/i
  const m = text.match(moneyRegex)
  if (!m) return {}
  const currency = (m[1] || 'CAD').toUpperCase()
  const num = parseFloat((m[2] || '').replace(/,/g, ''))
  if (isNaN(num)) return {}
  return { amount: num, currency }
}

function headerToString(v: unknown): string | undefined {
  if (!v) return undefined
  try { return String(v) } catch { return undefined }
}

Deno.serve(async (req) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Missing Supabase env')
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Basic secret validation
    const auth = req.headers.get('x-inbound-secret') || req.headers.get('x-sendgrid-signature') || ''
    if (INBOUND_SECRET && auth && INBOUND_SECRET !== auth) {
      return new Response('Forbidden', { status: 403 })
    }

    const contentType = req.headers.get('content-type') || ''

    let body: any = {}
    if (contentType.includes('application/json')) {
      body = await req.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData()
      body = Object.fromEntries(form.entries())
    } else {
      const txt = await req.text()
      body = { raw: txt }
    }

    // Normalize fields from common providers
    // SendGrid Inbound provides subject, from, text, html
    const subject = headerToString(body.subject) || headerToString(body.headers?.subject) || ''
    const from = headerToString(body.from) || headerToString(body.envelope?.from) || ''
    const text = headerToString(body.text) || headerToString(body.plain) || headerToString(body.raw) || ''

    const { amount, currency } = parseAmount(`${subject}\n${text}`)

    // Attempt parse sender name/email
    let senderEmail: string | undefined
    let senderName: string | undefined
    const emailMatch = from.match(/([^<]+)?<([^>]+)>/) || from.match(/(.+@.+\..+)/)
    if (emailMatch) {
      if (emailMatch.length > 2) {
        senderName = emailMatch[1]?.trim().replace(/"/g, '')
        senderEmail = emailMatch[2]?.trim()
      } else {
        senderEmail = emailMatch[1]
      }
    }

    const memo = (text || '').slice(0, 500)

    const { error } = await supabase.from('etransfers').insert({
      received_at: new Date().toISOString(),
      amount: amount ?? null,
      currency: currency ?? 'CAD',
      sender_name: senderName ?? null,
      sender_email: senderEmail ?? null,
      memo,
      raw_subject: subject,
      raw_text: (text || '').slice(0, 5000),
      reconciled: false,
    })
    if (error) throw new Error('Insert failed: ' + error.message)

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 })
  }
})
