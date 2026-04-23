-- ========================================
-- Round Zero Multitenancy Foundation (Step 1)
-- Generated: 2026-04-23
-- Via: Supabase MCP apply_migration (already applied to project gedxzunoyzmvbqgwjalx)
-- Organizations seeded: CHANGE (parent) -> DFX (child)
-- CHANGE organization_id: 01cf7a5e-6971-4ae1-918d-8e5981780a95
-- DFX organization_id:    14e907a7-65a3-4891-9a3c-20ea0a7c14fd
-- ========================================

-- Step 2: organizations table
CREATE TABLE IF NOT EXISTS organizations (
  organization_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES organizations(organization_id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_parent ON organizations(parent_id);
CREATE INDEX IF NOT EXISTS idx_organizations_code ON organizations(code);

COMMENT ON TABLE organizations IS 'マルチテナント組織マスタ (#30)';

-- Step 3: Initial seed data (CHANGE -> DFX)
-- change社名は「株式会社change」(前株、小文字change)
DO $$
DECLARE
  change_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE code = 'CHANGE') THEN
    INSERT INTO organizations (code, name, parent_id)
    VALUES ('CHANGE', '株式会社change', NULL)
    RETURNING organization_id INTO change_id;
    
    INSERT INTO organizations (code, name, parent_id)
    VALUES ('DFX', 'DFX合同会社', change_id);
  END IF;
END $$;

-- Step 4-A: Add organization_id to master tables (10)
ALTER TABLE stores            ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);
ALTER TABLE staff             ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);
ALTER TABLE operators         ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);
ALTER TABLE suppliers         ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);
ALTER TABLE prize_masters     ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);
ALTER TABLE billing_contracts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);
ALTER TABLE machines          ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);
ALTER TABLE locations         ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);
ALTER TABLE machine_manuals   ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);
ALTER TABLE machine_models    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);

-- Step 4-B: Add organization_id to transaction tables (4)
ALTER TABLE meter_readings     ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);
ALTER TABLE billing_events     ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);
ALTER TABLE stocktake_sessions ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);
ALTER TABLE audit_logs         ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(organization_id);

-- Step 5: Backfill all existing rows with DFX organization
DO $$
DECLARE
  dfx_id uuid;
BEGIN
  SELECT organization_id INTO dfx_id FROM organizations WHERE code = 'DFX';
  IF dfx_id IS NULL THEN
    RAISE EXCEPTION 'DFX organization not found';
  END IF;
  UPDATE stores            SET organization_id = dfx_id WHERE organization_id IS NULL;
  UPDATE staff             SET organization_id = dfx_id WHERE organization_id IS NULL;
  UPDATE operators         SET organization_id = dfx_id WHERE organization_id IS NULL;
  UPDATE suppliers         SET organization_id = dfx_id WHERE organization_id IS NULL;
  UPDATE prize_masters     SET organization_id = dfx_id WHERE organization_id IS NULL;
  UPDATE billing_contracts SET organization_id = dfx_id WHERE organization_id IS NULL;
  UPDATE machines          SET organization_id = dfx_id WHERE organization_id IS NULL;
  UPDATE locations         SET organization_id = dfx_id WHERE organization_id IS NULL;
  UPDATE machine_manuals   SET organization_id = dfx_id WHERE organization_id IS NULL;
  UPDATE machine_models    SET organization_id = dfx_id WHERE organization_id IS NULL;
  UPDATE meter_readings     SET organization_id = dfx_id WHERE organization_id IS NULL;
  UPDATE billing_events     SET organization_id = dfx_id WHERE organization_id IS NULL;
  UPDATE stocktake_sessions SET organization_id = dfx_id WHERE organization_id IS NULL;
  UPDATE audit_logs         SET organization_id = dfx_id WHERE organization_id IS NULL;
END $$;

-- Step 6-A: NOT NULL constraints (12 tables, skip stocktake_sessions)
ALTER TABLE stores             ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE staff              ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE operators          ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE suppliers          ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE billing_contracts  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE machines           ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE locations          ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE machine_manuals    ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE machine_models     ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE meter_readings     ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE billing_events     ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE audit_logs         ALTER COLUMN organization_id SET NOT NULL;

-- Step 6-B: NOT NULL on prize_masters (2178 rows)
ALTER TABLE prize_masters ALTER COLUMN organization_id SET NOT NULL;

-- Step 7: Performance indexes
CREATE INDEX IF NOT EXISTS idx_stores_org            ON stores(organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_org             ON staff(organization_id);
CREATE INDEX IF NOT EXISTS idx_machines_org          ON machines(organization_id);
CREATE INDEX IF NOT EXISTS idx_prize_masters_org     ON prize_masters(organization_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_org    ON meter_readings(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_org    ON billing_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org        ON audit_logs(organization_id);
