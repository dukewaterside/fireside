#!/usr/bin/env node
/**
 * Create Fireside accounts for subcontractors. Run once with:
 *   SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/create-subcontractors.js
 *
 * Passwords are Fireside01, Fireside02, ... (see output). All accounts are set to status=active.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://svqznnairknqehojeeyy.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUBCONTRACTORS = [
  { first_name: 'Rex', last_name: 'Caulder', phone: '603-348-7144', email: 'office2@caulerconstruction.com', business: 'Caulder Construction', role: 'subcontractor', trade: 'excavation' },
  { first_name: 'Andrew', last_name: 'Cullen', phone: '603-630-4563', email: 'cullen@metrocast.net', business: 'Cullen Concrete', role: 'subcontractor', trade: 'foundation' },
  { first_name: 'James', last_name: 'DeGrace', phone: '603-387-1314', email: 'degracecontracting@yahoo.com', business: 'DeGrace Contracting', role: 'subcontractor', trade: 'foundation' },
  { first_name: 'Matt', last_name: 'King', phone: '603-393-5122', email: 'mattking024@yahoo.com', business: 'King Foundation Sealing', role: 'subcontractor', trade: 'foundation_sealing' },
  { first_name: 'Cleber', last_name: 'De Melo', phone: '508-282-7244', email: 'customhomebuildinginc@outlook.com', business: 'Custom Home Building', role: 'subcontractor', trade: 'framing' },
  { first_name: 'Savio', last_name: 'Andres', phone: '978-349-1550', email: 'saviooivasinar05261998@gmail.com', business: 'SAM New Construction', role: 'subcontractor', trade: 'siding' },
  { first_name: 'Brandon', last_name: 'Murray', phone: '603-548-1646', email: 'brandon@bdmplumbingmechanicals.com', business: 'BDM Plumbing', role: 'subcontractor', trade: 'plumbing' },
  { first_name: 'Joey', last_name: 'Silva', phone: '978-702-6714', email: 'office@jjheatac.com', business: 'J&J HVAC', role: 'subcontractor', trade: 'hvac' },
  { first_name: 'Tom', last_name: 'Sabourn', phone: '603-348-7041', email: 'tom@sabournelectric.com', business: 'Sabourn Electric', role: 'subcontractor', trade: 'electrical' },
  { first_name: 'Rick', last_name: 'Hartley', phone: '603-792-0001', email: 'rick@completeav.ur', business: 'Complete AV', role: 'subcontractor', trade: 'it' },
  { first_name: 'Jake', last_name: 'Avakian', phone: '508-388-7857', email: 'jacob@vineyardhome.com', business: 'Vineyard Home', role: 'subcontractor', trade: 'it' },
  { first_name: 'Marco', last_name: 'Pierrondi', phone: '774-387-7361', email: 'marcopierrondi@gmail.com', business: 'Cape Cod Counterworks', role: 'subcontractor', trade: 'countertops' },
  { first_name: 'Brent', last_name: 'Buffington', phone: '603-387-7361', email: 'bbuffington@graniteglass.com', business: 'Granite State Glass', role: 'subcontractor', trade: 'shower_glass_doors' },
  { first_name: 'Junio', last_name: 'Silveira', phone: '508-203-0608', email: 'silvermassgeneralflooring@gmail.com', business: 'Silver Mass General Flooring', role: 'subcontractor', trade: 'flooring' },
  { first_name: 'Nick', last_name: 'Leighton', phone: '603-677-2314', email: 'nleighton@overheaddooroptions.com', business: 'Overhead Door Options', role: 'subcontractor', trade: 'garage_doors' },
];

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Set it in the environment.');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results = [];
  const emails = [];

  for (let i = 0; i < SUBCONTRACTORS.length; i++) {
    const row = SUBCONTRACTORS[i];
    const password = `Fireside${String(i + 1).padStart(2, '0')}`;
    const email = row.email.trim().toLowerCase();

    try {
      const { data: existing } = await supabase.auth.admin.listUsers();
      const userExists = (existing?.users || []).some((u) => u.email?.toLowerCase() === email);
      if (userExists) {
        console.warn(`User already exists: ${email} — skipping (password unchanged).`);
        results.push({ email, password: '(existing)', name: `${row.first_name} ${row.last_name}`, business: row.business });
        emails.push(email);
        continue;
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: row.first_name,
          last_name: row.last_name,
          phone: row.phone,
          role: row.role,
          trade: row.trade,
        },
      });

      if (authError) {
        console.error(`Failed to create ${email}:`, authError.message);
        continue;
      }
      emails.push(email);
      results.push({ email, password, name: `${row.first_name} ${row.last_name}`, business: row.business });
      console.log(`Created: ${row.first_name} ${row.last_name} (${email})`);
    } catch (err) {
      console.error(`Error creating ${email}:`, err);
    }
  }

  if (emails.length > 0) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ status: 'active' })
      .in('email', emails);
    if (updateError) {
      console.warn('Could not set status=active on some profiles:', updateError.message);
    } else {
      console.log('Set status=active for all created/present profiles.');
    }
  }

  console.log('\n--- CREDENTIALS ---\n');
  console.log('Email | Password | Name | Business');
  console.log('------|----------|------|----------');
  for (const r of results) {
    console.log(`${r.email} | ${r.password} | ${r.name} | ${r.business}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
