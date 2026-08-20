import 'dotenv/config';
import { sql } from './client';
import { SCHEMA_SQL } from './schema';

// Fixed UUIDs so the same data is inserted every time (idempotent with the DELETE at the top)

// Tenants
const TENANT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// Users
const ADMIN_ID  = '00000000-0000-0000-0000-000000000001';
const AGENT_A1  = '11111111-1111-1111-1111-111111111111';
const AGENT_A2  = '22222222-2222-2222-2222-222222222222';
const AGENT_B1  = '33333333-3333-3333-3333-333333333333';

// Custom Fields
const CITY_FIELD_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

// Lead IDs
const L1 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01';
const L2 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02';
const L3 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03';
const L4 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04';
const L5 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';
const LB1 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee06';
const LB2 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee07';

async function seed() {
  console.log('Applying schema...');
  await sql.unsafe(SCHEMA_SQL);

  console.log('Clearing existing seed data...');
  await sql`DELETE FROM lead_custom_field_values WHERE lead_id IN (${L1}, ${L2}, ${L3}, ${L4}, ${L5}, ${LB1}, ${LB2})`.catch(() => {});
  await sql`DELETE FROM leads WHERE id IN (${L1}, ${L2}, ${L3}, ${L4}, ${L5}, ${LB1}, ${LB2})`.catch(() => {});
  await sql`DELETE FROM custom_fields WHERE id = ${CITY_FIELD_ID}`.catch(() => {});
  await sql`DELETE FROM tenants WHERE id IN (${TENANT_A}, ${TENANT_B})`.catch(() => {});

  // Tenants
  console.log('Inserting tenants...');
  await sql`
    INSERT INTO tenants (id, name) VALUES
      (${TENANT_A}, 'Acme Corp'),
      (${TENANT_B}, 'Beta Corp')
  `;

  // Custom Fields
  console.log('Inserting custom fields...');
  await sql`
    INSERT INTO custom_fields (id, tenant_id, label, type, status) VALUES
      (${CITY_FIELD_ID}, ${TENANT_A}, 'City', 'string', TRUE)
  `;

  // Tenant A Leads
  console.log('Inserting Tenant A leads...');
  await sql`
    INSERT INTO leads (id, tenant_id, user_id, name, phone, country_code, e164, email, assigned_to, follow_up_date, created_at, updated_at)
    VALUES
      (
        ${L1}, ${TENANT_A}, ${ADMIN_ID},
        'Ram Kumar', '9000000001', '+91', '+919000000001',
        'ram@example.com', ${AGENT_A1}, '2026-08-10',
        '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00'
      ),
      (
        ${L2}, ${TENANT_A}, ${ADMIN_ID},
        'Ramesh', '9000000002', '+91', '+919000000002',
        'ramesh@example.com', ${AGENT_A1}, '2026-07-01',
        '2026-01-02 10:00:00+00', '2026-01-02 10:00:00+00'
      ),
      (
        ${L3}, ${TENANT_A}, ${ADMIN_ID},
        'Priya', '9000000003', '+91', '+919000000003',
        'priya@example.com', ${AGENT_A2}, NULL,
        '2026-01-03 10:00:00+00', '2026-01-03 10:00:00+00'
      ),
      (
        ${L4}, ${TENANT_A}, ${ADMIN_ID},
        'Anand', '9000000004', '+91', '+919000000004',
        NULL, NULL, '2026-08-15',
        '2026-01-04 10:00:00+00', '2026-01-04 10:00:00+00'
      ),
      (
        ${L5}, ${TENANT_A}, ${ADMIN_ID},
        'Sita', '9000000005', '+91', '+919000000005',
        'sita@example.com', ${AGENT_A2}, '2026-08-01',
        '2026-01-05 10:00:00+00', '2026-01-05 10:00:00+00'
      )
  `;

  // Tenant A Custom Field Values
  console.log('Inserting custom field values (Tenant A)...');
  await sql`
    INSERT INTO lead_custom_field_values (lead_id, field_id, value) VALUES
      (${L1}, ${CITY_FIELD_ID}, 'Chennai'),
      (${L2}, ${CITY_FIELD_ID}, 'Madurai'),
      (${L3}, ${CITY_FIELD_ID}, 'Chennai'),
      (${L4}, ${CITY_FIELD_ID}, 'Coimbatore'),
      (${L5}, ${CITY_FIELD_ID}, 'Chennai')
  `;

  // Tenant B Leads (must never leak to Tenant A)
  console.log('Inserting Tenant B leads...');
  await sql`
    INSERT INTO leads (id, tenant_id, user_id, name, phone, country_code, e164, email, assigned_to, follow_up_date)
    VALUES
      (
        ${LB1}, ${TENANT_B}, ${AGENT_B1},
        'Charlie Tenant B', '8000000001', '+44', '+448000000001',
        'charlie@tenantb.com', ${AGENT_B1}, NULL
      ),
      (
        ${LB2}, ${TENANT_B}, ${AGENT_B1},
        'Delta Tenant B', '8000000002', '+44', '+448000000002',
        NULL, NULL, NULL
      )
  `;

  console.log('\n✅ Seed complete!\n');
  console.log('----------------------------------------------------------');
  console.log('Reference UUIDs for curl commands:');
  console.log('----------------------------------------------------------');
  console.log(`TENANT_A_ID     = ${TENANT_A}`);
  console.log(`TENANT_B_ID     = ${TENANT_B}`);
  console.log(`ADMIN_USER_ID   = ${ADMIN_ID}`);
  console.log(`AGENT_A1_ID     = ${AGENT_A1}`);
  console.log(`AGENT_A2_ID     = ${AGENT_A2}`);
  console.log(`CITY_FIELD_ID   = ${CITY_FIELD_ID}`);
  console.log('----------------------------------------------------------');
  console.log('Leads (Tenant A):');
  console.log(`  L1 Ram Kumar  = ${L1}  assigned→ Agent A1`);
  console.log(`  L2 Ramesh     = ${L2}  assigned→ Agent A1`);
  console.log(`  L3 Priya      = ${L3}  assigned→ Agent A2`);
  console.log(`  L4 Anand      = ${L4}  assigned→ null`);
  console.log(`  L5 Sita       = ${L5}  assigned→ Agent A2`);
  console.log('----------------------------------------------------------\n');

  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
