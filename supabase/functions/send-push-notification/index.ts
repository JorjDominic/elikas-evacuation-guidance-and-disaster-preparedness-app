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

// Build and sign a VAPID JWT.
// Uses JWK import so the raw 32-byte private scalar works on Deno/WebCrypto
// (importing with 'raw' only works for *public* keys in the Web Crypto spec).
async function buildVapidJwt(
  audience: string,
  subject: string,
  privateKeyB64: string,
  publicKeyB64: string,   // needed to reconstruct the JWK (x, y coords)
): Promise<string> {
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject })));
  const unsigned = `${header}.${claims}`;

  // Public key is 65-byte uncompressed point: 0x04 || x (32 bytes) || y (32 bytes)
  const pub = fromB64url(publicKeyB64);
  const jwk = {
    kty: 'EC', crv: 'P-256',
    x: b64url(pub.slice(1, 33)),
    y: b64url(pub.slice(33, 65)),
    d: privateKeyB64,
    key_ops: ['sign'], ext: true,
  };
  const signingKey = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, signingKey, enc.encode(unsigned)
  );
  return `${unsigned}.${b64url(sig)}`;
}

// ── RFC 8291 aes128gcm Web Push encryption ───────────────────────────────────
// Without this, push services (Chrome/FCM, Firefox) reject or ignore payloads.

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

async function hkdf(
  salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8)
  );
}

async function encryptPayload(
  plaintext: string,
  p256dh: string,   // subscriber's public key (base64url)
  authStr: string,  // subscriber's auth secret (base64url)
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const recipientPub = fromB64url(p256dh);
  const authSecret   = fromB64url(authStr);

  // 1. Ephemeral sender ECDH key pair
  const senderKP = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  );
  const senderPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderKP.publicKey));

  // 2. ECDH → shared secret
  const recipientCK = await crypto.subtle.importKey(
    'raw', recipientPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: recipientCK }, senderKP.privateKey, 256)
  );

  // 3. Derive IKM per RFC 8291 §3.3
  //    IKM = HKDF(auth_secret, sharedSecret, "WebPush: info\x00" || recipientPub || senderPub, 32)
  const ikm = await hkdf(
    authSecret, sharedSecret,
    concat(enc.encode('WebPush: info\x00'), recipientPub, senderPubRaw),
    32,
  );

  // 4. Random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5. Derive CEK (16 bytes) and NONCE (12 bytes) per RFC 8188
  const cek   = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\x00'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\x00'),     12);

  // 6. AES-128-GCM encrypt: plaintext || 0x02 (padding delimiter, no padding)
  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      cekKey,
      concat(enc.encode(plaintext), new Uint8Array([2])),
    )
  );

  // 7. aes128gcm header: salt(16) || rs(4 BE) || idlen(1) || keyid(65) || ciphertext
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false); // record size = 4096
  header[20] = 65;                                        // keyid = uncompressed P-256 point
  header.set(senderPubRaw, 21);
  return concat(header, ciphertext);
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
        const jwt = await buildVapidJwt(audience, vapidSubject, vapidPrivateKey, vapidPublicKey);

        // Encrypt the payload per RFC 8291 using the subscriber's keys
        const encryptedBody = await encryptPayload(payload, p256dh, authKey);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `vapid t=${jwt},k=${vapidPublicKey}`,
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL': '86400',
          },
          body: encryptedBody,
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
