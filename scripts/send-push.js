#!/usr/bin/env node
/**
 * One-off script to send a test push notification to a user by email.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node scripts/send-push.js sid@watersidegroup.com
 *
 * Or with explicit URL:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/send-push.js sid@watersidegroup.com
 *
 * Get your service role key from: Supabase Dashboard → Settings → API → service_role (secret).
 * Never commit the service role key or use it in client-side code.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://svqznnairknqehojeeyy.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2] || 'sid@watersidegroup.com';

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Set it in the environment.');
    console.error('Example: SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/send-push.js ' + email);
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve user id from email (auth.users)
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    console.error('Failed to list users:', listError.message);
    process.exit(1);
  }
  const user = (listData?.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error('No user found with email:', email);
    process.exit(1);
  }

  // Get expo_push_token from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('expo_push_token')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.expo_push_token) {
    console.error('No push token for this user. They need to open the app once while signed in.');
    process.exit(1);
  }

  const token = profile.expo_push_token;
  console.log('Sending push to', token, '...');

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      to: token,
      title: 'Fireside test',
      body: 'You got a test push from Fireside.',
      sound: 'default',
      data: { type: 'test' },
    }),
  });

  const json = await res.json();
  const ticket = Array.isArray(json.data) ? json.data[0] : json.data;
  if (ticket?.status === 'error') {
    console.error('Expo API error:', ticket.message);
    process.exit(1);
  }
  if (json.errors?.length) {
    console.error('Expo API errors:', json.errors);
    process.exit(1);
  }
  if (!res.ok) {
    console.error('HTTP error', res.status, json);
    process.exit(1);
  }
  console.log('Push sent successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
