/**
 * send-alert-email — Supabase Edge Function
 *
 * Triggered by a Supabase Database Webhook on INSERT to the `alerts` table
 * (or called directly from admin code for high-severity alerts).
 *
 * Required environment variables (set in Supabase Dashboard → Settings → Edge Functions):
 *   RESEND_API_KEY   — API key from https://resend.com
 *   FROM_EMAIL       — Verified sender address, e.g. "eLikas Alerts <alerts@yourdomain.com>"
 *   APP_URL          — Production URL, e.g. "https://elikas.netlify.app"
 *   ALLOWED_ORIGINS  — Comma-separated allowed CORS origins (e.g. "https://elikas.netlify.app,http://localhost:3000")
 *
 * To attach this as a DB webhook:
 *   1. Supabase Dashboard → Database → Webhooks → Create webhook
 *   2. Table: alerts, Event: INSERT
 *   3. Webhook URL: <your-supabase-project-url>/functions/v1/send-alert-email
 *   4. Add header: Authorization: Bearer <service-role-key>
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim());

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req: Request) => {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  try {
    const body = await req.json();
    // Support both direct call ({ alert: {...} }) and DB webhook ({ record: {...} })
    const alert = body.alert ?? body.record;

    if (!alert) {
      return new Response(JSON.stringify({ error: 'Missing alert payload' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Only email on high-severity alerts to avoid spam
    if (alert.level !== 'high') {
      return new Response(JSON.stringify({ skipped: true, reason: 'Not high-severity' }), {
        status: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'eLikas Alerts <alerts@elikas.ph>';
    const appUrl    = Deno.env.get('APP_URL') || 'https://elikas.netlify.app';

    if (!resendKey) {
      console.error('[send-alert-email] RESEND_API_KEY not set');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Fetch all active user emails from profiles
    const supabaseUrl        = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('email')
      .eq('is_active', true)
      .not('email', 'is', null);

    if (profilesError) {
      console.error('[send-alert-email] Failed to fetch profiles:', profilesError.message);
      return new Response(JSON.stringify({ error: 'Failed to fetch recipients' }), {
        status: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const emails = (profiles ?? []).map((p: { email: string }) => p.email).filter(Boolean);
    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No active users to notify' }), {
        status: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const levelLabel = { high: '🔴 HIGH', medium: '🟠 MEDIUM', low: '🟢 LOW' }[alert.level as string] ?? alert.level;
    const htmlBody = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#c41919;color:#fff;padding:1rem 1.5rem;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:1.3rem">⚠️ eLikas Emergency Alert</h1>
        </div>
        <div style="background:#fff;padding:1.5rem;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px">
          <p style="font-size:0.85rem;color:#888;margin-top:0">Severity: <strong>${levelLabel}</strong></p>
          <h2 style="margin:0 0 0.75rem;color:#1a1a14">${alert.title ?? 'Emergency Alert'}</h2>
          ${alert.area ? `<p style="margin:0 0 0.5rem;color:#555"><strong>Area:</strong> ${alert.area}</p>` : ''}
          ${alert.description ? `<p style="color:#444;line-height:1.6">${alert.description}</p>` : ''}
          <a href="${appUrl}/alerts" style="display:inline-block;margin-top:1rem;padding:0.6rem 1.2rem;background:#1a3a5f;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
            View Full Alert
          </a>
          <hr style="margin:1.5rem 0;border:none;border-top:1px solid #eee" />
          <p style="font-size:0.8rem;color:#aaa;margin:0">
            You are receiving this because you have an active eLikas account. 
            <a href="${appUrl}/profile" style="color:#6c9bcf">Manage notifications</a>
          </p>
        </div>
      </div>
    `;

    // Send via Resend (batch up to 50 per request to stay within limits)
    const BATCH = 50;
    let totalSent = 0;
    for (let i = 0; i < emails.length; i += BATCH) {
      const batch = emails.slice(i, i + BATCH);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: batch,
          subject: `[eLikas Alert] ${alert.title ?? 'Emergency Notification'}`,
          html: htmlBody,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[send-alert-email] Resend batch ${i}–${i + BATCH} failed:`, errText);
      } else {
        totalSent += batch.length;
      }
    }

    return new Response(JSON.stringify({ sent: totalSent }), {
      status: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-alert-email] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});
