/**
 * send-push-notification — Supabase Edge Function
 *
 * Sends Web Push (VAPID) notifications to all subscribed users.
 * Called from the admin when a high-severity alert is created,
 * or wired to the `alerts` INSERT webhook (same as send-alert-email).
 *
 * Setup steps:
 *   1. Generate VAPID keys (run once):
 *        npx web-push generate-vapid-keys
 *   2. Set the following in Supabase Dashboard → Settings → Edge Functions:
 *        VAPID_PUBLIC_KEY   — e.g. "BHxyz..."
 *        VAPID_PRIVATE_KEY  — e.g. "abc123..."
 *        VAPID_SUBJECT      — e.g. "mailto:admin@yourdomain.com"
 *        APP_URL            — e.g. "https://elikas.netlify.app"
 *        ALLOWED_ORIGINS    — Comma-separated allowed CORS origins
 *   3. Expose VAPID_PUBLIC_KEY to the frontend (store in .env as
 *        REACT_APP_VAPID_PUBLIC_KEY=<your-public-key>)
 *      and subscribe users with that key (see useNotifications hook).
 *   4. Store push subscriptions in the `push_subscriptions` table
 *      (schema included in supabase/migrations/001_initial_schema.sql).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Minimal VAPID + Web Push signing via the SubtleCrypto API available in Deno.
// This avoids importing a heavy npm package that may not load cleanly on Deno Deploy.

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

// Base64url encode
function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Decode base64url to Uint8Array
function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Build and sign a VAPID JWT
async function buildVapidJwt(audience: string, subject: string, privateKeyB64: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject })));
  const unsigned = `${header}.${claims}`;

  const keyBytes = fromB64url(privateKeyB64);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

serve(async (req: Request) => {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  try {
    const body = await req.json();
    const alert = body.alert ?? body.record;

    if (!alert) {
      return new Response(JSON.stringify({ error: 'Missing alert payload' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Only push on high-severity alerts
    if (alert.level !== 'high') {
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject    = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@elikas.ph';
    const appUrl          = Deno.env.get('APP_URL') || 'https://elikas.netlify.app';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl        = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subs, error: subsError } = await adminClient
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');

    if (subsError || !subs?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No push subscriptions' }), {
        status: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title: alert.title ?? 'eLikas Alert',
      body: alert.description ?? 'A high-severity alert has been issued.',
      tag: `alert-${alert.id}`,
      url: `${appUrl}/alerts`,
    });

    let sent = 0;
    const stale: string[] = [];

    for (const sub of subs) {
      const { endpoint, p256dh, auth: authKey } = sub;
      try {
        const parsedUrl = new URL(endpoint);
        const audience = `${parsedUrl.protocol}//${parsedUrl.host}`;
        const jwt = await buildVapidJwt(audience, vapidSubject, vapidPrivateKey);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `vapid t=${jwt},k=${vapidPublicKey}`,
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL': '86400',
          },
          body: new TextEncoder().encode(payload),
        });

        if (res.status === 201 || res.status === 200) {
          sent++;
        } else if (res.status === 410 || res.status === 404) {
          // Subscription expired — mark for removal
          stale.push(endpoint);
        } else {
          console.warn(`[send-push] Unexpected status ${res.status} for endpoint: ${endpoint}`);
        }
      } catch (e) {
        console.error('[send-push] Failed to push to endpoint:', e);
      }
    }

    // Clean up expired subscriptions
    if (stale.length > 0) {
      await adminClient.from('push_subscriptions').delete().in('endpoint', stale);
    }

    return new Response(JSON.stringify({ sent, staleRemoved: stale.length }), {
      status: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-push] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});
