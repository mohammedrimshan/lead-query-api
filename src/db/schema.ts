
export const SCHEMA_SQL = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- tenants table (kept minimal, just for FK integrity)
  CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Leads
  CREATE TABLE IF NOT EXISTS leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    name            TEXT NOT NULL,
    phone           TEXT NOT NULL,
    country_code    TEXT NOT NULL DEFAULT '+91',
    e164            TEXT NOT NULL,
    email           TEXT,
    assigned_to     UUID,
    follow_up_date  DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- indexes (see README for rationale)
  CREATE INDEX IF NOT EXISTS idx_leads_tenant_id
    ON leads(tenant_id);

  CREATE INDEX IF NOT EXISTS idx_leads_tenant_assigned
    ON leads(tenant_id, assigned_to);

  CREATE INDEX IF NOT EXISTS idx_leads_tenant_created
    ON leads(tenant_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_leads_tenant_followup
    ON leads(tenant_id, follow_up_date);

  -- Custom field definitions per tenant
  CREATE TABLE IF NOT EXISTS custom_fields (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('string', 'number', 'date', 'boolean')),
    status      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_custom_fields_tenant
    ON custom_fields(tenant_id);

  -- EAV: one row per (lead, field)
  CREATE TABLE IF NOT EXISTS lead_custom_field_values (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    field_id    UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
    value       TEXT NOT NULL,
    UNIQUE (lead_id, field_id)
  );

  -- covering index for EXISTS subqueries
  CREATE INDEX IF NOT EXISTS idx_lcfv_field_value_lead
    ON lead_custom_field_values(field_id, value, lead_id);
`;
